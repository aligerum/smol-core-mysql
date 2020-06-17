const smol = require('smol')

module.exports = {
  exec: async update => {
    for (let coreName of update.coreNames) {
      let coreConfig = smol.config(coreName)
      if (coreConfig.protected || coreConfig.host != 'localhost') continue
      console.log(update.colors.yellow(`Migrating ${coreName}...`))
      update.run(`npx smol ${coreName} migrate`)
    }
  },
}
