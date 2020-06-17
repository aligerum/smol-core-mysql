let Model = require('../class/Model')

module.exports = (path, props) => {
  let coreName = path.split('/')[0]
  let modelName = path.split('/')[1]
  let def = require(`${process.cwd()}/core/${coreName}/model/${modelName}`)
  let model = class extends Model {
    static coreName = coreName
    static table = def.table || modelName
    static primaryKey = def.primaryKey || 'id'
    static dates = def.dates || []
    static timestamps = def.timestamps || false
  }
  if (props && props.static) for (let propName of Object.keys(props.static)) Model[propName] = props.static[propName]
  if (props && props.instance) for (let propName of Object.keys(props.instance)) Model.prototype[propName] = props.instance[propName]
  return Model.proxify(model)
}
