const Model = require('../class/Model')

module.exports = path => Model.models[path.split('/')[0]][path.split('/')[1]]
