const fs = require('fs')
const smol = require('smol')

module.exports = {
  description: 'Create database and user in mysql from config',
  exec: async command => {

    // get config
    let coreConfig = smol.config(smol.coreName)

    // can't create databases remotely
    if (coreConfig.host != 'localhost') {
      console.log(command.colors.yellow(`Cannot init database on ${coreConfig.host}`))
      process.exit(1)
    }

    // create database
    try {
      command.run('mkdir -p output')
      let template = fs.readFileSync(`${__dirname}/../template/init.sql`, 'utf-8')
      fs.writeFileSync('output/init.sql', smol.string.replace(template, {
        '\\$database': coreConfig.name,
        '\\$user': coreConfig.user,
        '\\$password': coreConfig.pass,
      }))
      command.run('mysql < output/init.sql')
      console.log(command.colors.green(`Database and user created for ${smol.coreName}`))
    } catch (err) {
      console.log(command.colors.yellow('Could not create mysql database.') + ' Do you have permission?')
    }

    // remove temporary mysql file
    if (fs.existsSync('output/init.sql')) command.run('rm output/init.sql')

  },
}
