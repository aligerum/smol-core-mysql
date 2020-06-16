const fs = require('fs')
const smol = require('smol')

module.exports = {
  description: 'Generate database password',
  args: [
    '-f,--force: Overwrite existing password',
  ],
  exec: async command => {

    // get core config
    let coreConfig = smol.config(smol.coreName)

    // don't overwrite if password already exists
    if (!command.args.force && coreConfig.pass && coreConfig.pass != 'secret') {
      console.log(command.colors.yellow(`Password already exists`))
      process.exit(1)
    }

    // generate password
    let password = smol.string.generate({
      chars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@$^*-_=+'
    })
    coreConfig.pass = password

    // save config
    command.run(`mkdir -p ${process.cwd()}/config`)
    fs.writeFileSync(`${process.cwd()}/config/${smol.coreName}.json`, JSON.stringify(coreConfig, null, 2))
    console.log(command.colors.green(`Generated password for ${smol.coreName}`))

  },
}
