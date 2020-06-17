const smolCoreMysql = require('smol-core-mysql')
const ModelName = smolCoreMysql.model('coreName/modelName')

module.exports = {
  description: 'Seed modelName table',
  exec: async seed => {

    // create models
    let modelNames = []
    for (let i=0; i<seed.count; i++) {
      let modelName = new ModelName({
        // set attributes here
      })
      modelNames.push(modelName)
    }

    // save
    await ModelName.save(modelNames)

  }
}
