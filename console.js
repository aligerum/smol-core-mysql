const Model = require('./class/Model')

module.exports = (coreName, core, context) => {
  core.models = Model.models[coreName]
}
