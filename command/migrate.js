const DB = require('../class/DB')
const fs = require('fs')
const moment = require('moment')
const smol = require('smol')
const Schema = require('../class/Schema')

module.exports = {
  description: 'Migrate database tables',
  args: [
    'action?=: Action to perform',
    'steps?#: Number of steps to migrate (default 1)',
    // '-d,--dry: Show queries that would be run without running them',
    '-f,--force: Force to migrate even when app is in production, protected, or not on localhost',
  ],
  help: {
    Notes: 'Specify no action or steps to migrate all the way forward'
  },
  argValues: {
    action: [
      'down: Roll back <steps> migrations',
      'drop: Drop all tables',
      'fresh: Drop all tables and migrate from scratch',
      'status: List all migrations and show current',
      'up: Migrate forward <steps> migrations',
    ],
  },
  exec: async command => {

    // get config
    let smolConfig = smol.config()
    let coreConfig = smol.config(smol.coreName)

    // prevent damage to remote/protected databases
    if ((coreConfig.host != 'localhost' || coreConfig.protected) && !command.args.force && command.args.action != 'status') {
      let reason = coreConfig.host != 'localhost' ? 'not on localhost' : 'protected'
      console.log(command.colors.yellow(`Canceled migration (${reason})`))
      process.exit(1)
    }

    // require confirmation when in production mode
    if (smolConfig.mode == 'production' && !smolConfig.maintenanceMode && !command.args.force && command.args.action != 'status') {
      if (!await command.confirm(command.colors.red('App is in production! Are you sure you want to migrate?'))) {
        console.log(command.colors.yellow('Canceled migration (app in production)'))
        process.exit(1)
      }
    }

    // drop all tables
    if (['fresh', 'drop'].includes(command.args.action)) {
      let tables = await new DB(smol.coreName).query(`select table_name from information_schema.tables where table_schema = :database`, {database: coreConfig.name})
      for (let table of tables) await new Schema(smol.coreName).drop(table.table_name)
      console.log(command.colors.green(`Dropped all tables from ${smol.coreName}`))
      if (command.args.action == 'drop') return
    }

    // init
    if (!await new Schema(smol.coreName).exists(coreConfig.migrationTable)) {
      await new Schema(smol.coreName).create(coreConfig.migrationTable, table => {
        table.string('name').primary()
        table.datetime('migratedAt').nullable().default(null)
      })
      console.log(command.colors.green(coreConfig.migrationTable == 'migration' ? 'Created migration table' : `Created migration table (${coreConfig.migrationTable})`))
    }

    // get status
    let allMigrations = []
    if (fs.existsSync(`${process.cwd()}/core/${smol.coreName}/migration`)) allMigrations = fs.readdirSync(`${process.cwd()}/core/${smol.coreName}/migration`).map(item => item.slice(0, -3))
    let completedMigrationDefs = await new DB(smol.coreName).query(`select * from ${coreConfig.migrationTable}`)
    let completedMigrations = completedMigrationDefs.map(item => item.name)
    let newMigrations = allMigrations.filter(item => !completedMigrations.includes(item))

    // status
    if (command.args.action == 'status') {
      if (!allMigrations.length) return console.log(`${smol.coreName} has no migrations`)
      let migrationNameLength = allMigrations.length ? allMigrations.reduce((a, b) => a.length > b.length ? a : b).length : 4
      if (migrationNameLength) migrationNameLength -= 18
      console.log(command.colors.dim(` ✓  ${'Name'.padEnd(migrationNameLength, ' ')}  Date Migrated`))
      for (let migration of allMigrations) {
        if (completedMigrations.includes(migration)) {
          let migratedAt = moment(completedMigrationDefs.find(completedMigration => completedMigration.name == migration).migratedAt)
          console.log(` ✓  ${smol.string.spaceCase(migration.slice(18)).padEnd(migrationNameLength, ' ')}  ${migratedAt.format('MMM')} ${migratedAt.format('D').padStart(2, ' ')} ${migratedAt.format('YYYY')} ${migratedAt.format('h').padStart(2, ' ')}:${migratedAt.format('mma')}`)
        } else {
          console.log(`    ${smol.string.spaceCase(migration.slice(18)).padEnd(migrationNameLength, ' ')}`)
        }
      }
      return
    }

    // determine number of steps backward
    let steps
    if (command.args.action == 'down') {
      steps = command.args.steps || 1
      steps = Math.min(steps, completedMigrations.length)
      if (!steps) return console.log('Nothing to roll back')
    }

    // migrate backward
    if (steps) {
      for (let i = 0; i < steps; i++) {
        let migration = completedMigrations[completedMigrations.length - i - 1]
        let displayName = smol.string.spaceCase(migration.slice(18)).toLowerCase()
        console.log(command.colors.yellow(`Rolling back ${displayName}...`))
        let migrationDef = require(`${process.cwd()}/core/${smol.coreName}/migration/${migration}`)
        await migrationDef.down(new Schema(smol.coreName))
        await await new DB(smol.coreName).insert(`delete from ${coreConfig.migrationTable} where name = :name`, {name: migration})
        console.log(command.colors.green(`Rolled back ${displayName}`))
      }
      return
    }

    // determine number of steps forward
    steps = null
    if (!command.args.action || ['up', 'fresh'].includes(command.args.action)) {
      if (!command.args.action) steps = Infinity
      if (!steps) steps = command.args.steps
      if (!steps) steps = command.args.action == 'up' ? 1 : Infinity
      steps = Math.min(steps, newMigrations.length)
      if (!steps) return console.log('Already up to date')
    }

    // migrate forward
    if (steps) {
      for (let i = 0; i < steps; i++) {
        let migration = newMigrations[i]
        let displayName = smol.string.spaceCase(migration.slice(18)).toLowerCase()
        console.log(command.colors.yellow(`Migrating ${displayName}...`))
        let migrationDef = require(`${process.cwd()}/core/${smol.coreName}/migration/${migration}`)
        await migrationDef.up(new Schema(smol.coreName))
        await new DB(smol.coreName).insert(`insert into ${coreConfig.migrationTable} (name, migratedAt) values (:name, :migratedAt)`, {name: migration, migratedAt: moment().format('YYYY-MM-DD HH:mm:ss')})
        console.log(command.colors.green(`Migrated ${displayName}`))
      }
      return
    }

  }
}
