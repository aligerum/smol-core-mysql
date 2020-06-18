const DB = require('./DB')
const fs = require('fs')
const smol = require('smol')

module.exports = class {

  // create new query for a specific table
  constructor(coreName, table, primaryKey) {
    const Model = require('./Model')
    if (typeof coreName != 'string') {
      this.model = coreName
      coreName = this.model.coreName
      table = this.model.table
      primaryKey = this.model.primaryKey
    }
    if (!this.model) {
      if (!Model.tables[coreName][table]) {
        let def = class extends Model {
          static coreName = coreName
          static table = table
          static primaryKey = primaryKey || 'id'
          static dates = []
          static timestamps = false
        }
        Model.tables[coreName][table] = Model.proxify(def)
      }
      this.model = Model.tables[coreName][table]
    }
    this.wheres = []
    this.joins = []
    this.coreName = coreName
    this.table = table
    this.primaryKey = primaryKey || 'id'
    this.pivotInfo = null
    this.isPivot = false
    this.isCount = false
    this.isFirst = false
    this.isDelete = false
  }

  // add a row to the pivot table
  async add(id, pivotData) {

    // ensure is targeting pivot table
    if (!this.isPivot) return await this.pivot.add(id, pivotData)

    // if passed model instead of numerical id, get model's id
    if (typeof id != 'number') id = id[id.constructor.primaryKey]

    // create new pivot table entry
    let newPivot = new this.model
    newPivot[this.pivotInfo.setPivotColumn] = this.pivotInfo.relatedValue
    newPivot[this.pivotInfo.unsetPivotColumn] = id
    for (let name in pivotData) newPivot[name] = pivotData[name]

    // save and return
    return await newPivot.save()

  }

  // get count
  async count() {
    this.isCount = true
    return await this.exec()
  }

  // run delete
  async delete() {
    this.isDelete = true
    return await this.exec()
  }

  // execute query based on all inputs
  async exec(columns = ['*']) {

    // handle pivot
    if (this.pivotInfo && !this.isPivot) this.join(this.pivotInfo.pivotTable, this.pivotInfo.unsetPivotColumn, this.table, this.pivotInfo.column).join(this.pivotInfo.relatedTable, this.pivotInfo.relatedColumn, this.pivotInfo.pivotTable, this.pivotInfo.setPivotColumn, 'this').where(this.pivotInfo.setPivotColumn, this.pivotInfo.relatedValue)
    else if (this.pivotInfo) this.where(this.pivotInfo.setPivotColumn, this.pivotInfo.relatedValue)

    // determine statement
    if (!Array.isArray(columns)) columns = [columns]
    if (this.joins.length) columns = columns.map(column => DB.escape('::table.::column', {table: this.table, column}))
    columns = columns.join(', ')
    let query = ''
    if (this.isCount) query += `select count(*) from ${this.table}`
    else if (this.isDelete) query += `delete from ${this.table}`
    else query += `select ${columns} from ${this.table}`

    // add joins
    for (let join of this.joins) query += ` inner join ${join}`

    // add where clauses
    if (this.wheres.length) query += ` where ${this.wheres.join(' and ')}`

    // get only 1 if first()
    if (this.isFirst) query += ' limit 1'

    // determine query type
    let type = 'select'
    if (this.isCount) type = 'count'
    else if (this.isDelete) type = 'delete'

    // get results
    let results = await new DB(this.coreName).query(query, type)
    if (this.isCount || this.isDelete) return results

    // cast to models
    let rows = []
    for (let result of results) {
      let model = new this.model
      for (let column of Object.keys(result)) model[column] = result[column]
      rows.push(model)
    }

    // return requested data
    if (this.isFirst) return rows[0] || null
    return rows

  }

  // find a row by id
  async find(id, columns) {
    return this.where(this.primaryKey, id).first(columns)
  }

  // perform the query and get the first item
  async first(columns) {
    this.isFirst = true
    return await this.exec(columns)
  }

  // get the results for the query
  async get(columns) {
    return await this.exec(columns)
  }

  // add join
  join(onTable, onColumn, relatedTable, relatedColumn, asTable) {
    let query = '::onTable on ::onTable.::onColumn = ::relatedTable.::relatedColumn'
    let params = {onTable, onColumn, relatedTable, relatedColumn}
    if (asTable) {
      query = '::onTable as ::asTable on ::asTable.::onColumn = ::relatedTable.::relatedColumn'
      params.asTable = asTable
    }
    this.joins.push(DB.escape(query, params))
    return this
  }

  // create a new pivot model table with the correct id
  new(init) {
    if (!this.isPivot) return this.pivot.new(init)
    let model = new this.model(init)
    model[this.pivotInfo.setPivotColumn] = this.pivotInfo.relatedValue
    return model
  }

  // change the query to a pivot query
  get pivot() {
    this.table = this.pivotInfo.pivotTable
    this.isPivot = true
    return this
  }

  // remove a row from the pivot table
  async remove(id, pivotData) {
    if (!this.isPivot) return await this.pivot.remove(id)
    return await new DB(this.coreName).query('delete from ::table where id = :id', {table: this.pivotInfo.pivotTable, id})
  }

  // set pivot info
  setPivot(relatedTable, relatedValue, relatedColumn = 'id', pivotTable, unsetPivotColumn, setPivotColumn, column = 'id') {
    if (!pivotTable) pivotTable = smol.string.camelCase([this.table, relatedTable].sort().join('_'))
    if (!unsetPivotColumn) unsetPivotColumn = `${relatedTable}Id`
    if (!setPivotColumn) setPivotColumn = `${this.table}Id`
    this.pivotInfo = {
      table: this.table,
      column,
      relatedTable,
      relatedValue,
      relatedColumn,
      pivotTable,
      unsetPivotColumn,
      setPivotColumn,
    }
    return this
  }

  // define a where clause
  where(key, rel, value) {

    // handle only two arguments
    if (value === undefined) {
      value = rel
      rel = '='
    }
    if (rel == '!=') rel = '<=>'

    // add where
    if (value == null) this.wheres.push(DB.escape(`::key ${ rel == '<=>' ? 'is not' : 'is' } null`, {key}))
    else if (rel == 'in') this.wheres.push(DB.escape(`::key in (:value)`, {key, value}))
    else this.wheres.push(DB.escape(`::key ${rel} :value`, {key, value}))

    // return query object
    return this

  }

  // define a where-in clause
  whereIn(key, values) {
    return this.where(key, 'in', values)
  }

}
