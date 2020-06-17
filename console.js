const fs = require('fs')
const modelScript = require('./script/model')

module.exports = (coreName, core, context) => {

  // load all models
  core.models = {}
  if (fs.existsSync(`${process.cwd()}/core/${coreName}/model`)) {
    for (let modelName of fs.readdirSync(`${process.cwd()}/core/${coreName}/model`).map(item => item.slice(0, -3))) core.models[modelName] = modelScript(`${coreName}/${modelName}`)
  }

}
