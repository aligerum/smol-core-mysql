const faker = require('faker')
const fs = require('fs')
const smol = require('smol')
const smolConfig = smol.config()

// determine available seeds
let helpItems = {}
if (fs.existsSync(`${process.cwd()}/core`)) {
  for (let coreName of fs.readdirSync(`${process.cwd()}/core`)) {
    let coreJson = require(`${process.cwd()}/core/${coreName}/core.json`)
    let seedPath = `${process.cwd()}/core/${coreName}/seed`
    if (coreJson.type != 'mysql' || !fs.existsSync(seedPath) || !fs.readdirSync(seedPath).length) continue
    helpItems[`${coreName} Seeds`] = fs.readdirSync(seedPath).map(file => `${file.slice(0, -3)}: ${require(process.cwd() + '/core/' + coreName + '/seed/' + file).description || 'No description provided'}`)
  }
}

module.exports = {
  description: 'Seed database with sample data',
  args: [
    'name?: Name of seed to run',
    'count#?: Number of items to seed (default 1)',
    '-f,--force: Force to seed even when app is in production',
  ],
  help: {
    'Note': 'If no name is provided, will run all seeds',
  },
  helpItems,
  exec: async command => {

    // require confirmation when in production
    if (smolConfig.mode == 'production' && !command.args.force) {
      if (!await command.confirm(`${command.colors.red('App is in production!')} Are you sure you want to seed?`)) {
        console.log(command.colors.yellow('Seed canceled'))
        process.exit(1)
      }
    }

    // accept only count specified
    if (!command.args.count && !isNaN(parseInt(command.args.name))) {
      command.args.count = command.args.name
      command.args.name = null
    }

    // determine count
    let count = command.args.count || 1

    // load seeds
    let seedPath = `${process.cwd()}/core/${smol.coreName}/seed`
    let seeds = []
    if (command.args.name) {
      if (!fs.existsSync(`${seedPath}/${command.args.name}.js`)) {
        console.log(command.colors.yellow(`Seed "${command.args.name}" not found`))
        process.exit(1)
      }
      seeds.push({name: command.args.name, def: require(`${seedPath}/${command.args.name}`)})
    } else if (fs.existsSync(seedPath)) {
      for (let seed of fs.readdirSync(seedPath)) seeds.push({name: seed, def: require(`${seedPath}/${seed}`)})
    }
    if (!seeds.length) return console.log(command.colors.yellow(`No seeds available`))

    // perform seeds
    for (let seed of seeds) {
      if (seed.def.description) console.log(command.colors.yellow(`${seed.def.description} (${seed.name})...`))
      else console.log(command.colors.yellow(`Seeding ${seed.name}...`))
      await seed.def.exec({count: command.args.count, faker})
      if (seed.def.description) console.log(command.colors.green(`${seed.def.description} (${seed.name}) complete`))
      else console.log(command.colors.green(`Seeded ${seed.name}...`))
    }

  }
}
