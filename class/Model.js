const DB = require('./DB')
const fs = require('fs')
const moment = require('moment')
const Query = require('./Query')
const smol = require('smol')

let proxyDef = {

  // trap for constructor
  construct(target, args) {
    return new Proxy(new target(...args), proxyDef)
  },

  // trap for accessor
  get(target, prop, receiver) {

    // get the attribute value first
    if (target.attributes && target.attributes.hasOwnProperty(prop)) return target.attributes[prop]

    // get the actual value
    let value = target[prop]

    // if prop is a symbol or exists, return whatever that value is
    if (typeof prop == 'symbol' || value !== undefined) return value

    // if prop starts with 'where', change to a query
    if (prop.substr(0, 5) == 'where') return queryValue => receiver.where(prop.substr(5), queryValue)

    // if prop is a relationship
    if (target.constructor.relationships && target.constructor.relationships[prop]) {
      let relationshipDef = target.constructor.relationships[prop]

      // determine relationship tables and keys
      let objects = []
      let tokens = relationshipDef.split(' ')
      let isFirst
      for (let token of tokens) {
        let items = token.split(/[/(/)]/)
        if (items[0] == '1') {
          isFirst = true
          items.shift()
        }
        if (items.length == 2 && !objects.length) objects.push({table: items[0], column: items[1]})
        else if (items.length == 2 && objects.length) objects.push({table: items[1], column: items[0]})
        else if (items.length == 3) objects.push({table: items[1], leftColumn: items[0], rightColumn: items[2]})
      }

      // return query for relationship
      let query
      if (objects.length == 2) query = new Query(target.constructor.coreName, objects[1].table).where(objects[1].column, target.attributes[objects[0].column])
      if (objects.length == 3) query = new Query(target.constructor.coreName, objects[2].table).setPivot(objects[0].table, target.attributes[objects[0].column], objects[0].column, objects[1].table, objects[1].rightColumn, objects[1].leftColumn, objects[2].column)
      if (isFirst) return query.first()
      return query

    }

    // return value
    return value

  },

  // trap for setter
  set(target, prop, value, receiver) {
    let descriptor = Object.getOwnPropertyDescriptor(target.constructor.prototype, prop)
    if (!descriptor && !target.hasOwnProperty(prop)) target.attributes[prop] = value
    else target[prop] = value
    return true
  },

}

let Model = class {

  // constructor
  constructor(def) {
    this.attributes = {}
    this.userData = null
    if (def) for (let column of Object.keys(def)) this.attributes[column] = def[column]
  }

  // assign multiple values to model
  assign(values, columns) {
    if (!columns) columns = Object.keys(values)
    for (let column of columns) if (values.hasOwnProperty(column)) this[column] = values[column]
    return this
  }

  // get count of all
  static async count() {
    return new Query(this).count()
  }

  // delete a row by id
  static async delete(id) {
    return await new DB(this.coreName).query('delete from ::table where ::_id = :id', {table: this.table, _id: this.primaryKey, id})
  }

  // delete an instance
  async delete() {
    console.log(this.constructor)
    return await new DB(this.constructor.coreName).query('delete from ::table where ::_id = :id', {table: this.constructor.table, _id: this.constructor.primaryKey, id: this.attributes[this.constructor.primaryKey]})
  }

  // delete all
  static async deleteAll() {
    return await new DB(this.coreName).query('delete from ::table where 1=1', {table: this.table})
  }

  // find a row by id
  static async find(id, columns) {
    return new Query(this).find(id, columns)
  }

  // get first in table
  static async first(columns) {
    return new Query(this).first(columns)
  }

  // get all from table
  static async get(columns) {
    return new Query(this).get(columns)
  }

  // create or save one or more models simultaneously
  static async insert(defs) {

    // perform queries all at once
    let results = await new DB(this.coreName).multiple(db => {

      // determine timestamps
      let timestamp = moment().format('YYYY-MM-DD HH:mm:ss')

      // determine queries to be run
      let queries = Array.isArray(defs) ? [] : {}
      for (let defKey of Object.keys(defs)) {
        let def = defs[defKey]

        // add timestamps
        if (this.timestamps) {
          let timestampColumns = typeof this.timestamps == 'object' ? this.timestamps : {}
          if (!timestampColumns.createdAt) timestampColumns.createdAt = 'createdAt'
          if (!timestampColumns.updatedAt) timestampColumns.updatedAt = 'updatedAt'
          def[timestampColumns.createdAt] = timestamp
          def[timestampColumns.updatedAt] = timestamp
        }

        // set attributes
        let params = {}
        for (let column of Object.keys(def).filter(column => column != this.primaryKey)) {
          let value = def[column]
          if (this.dates && this.dates.includes(column) && typeof value == 'string') value = DB.date(value)
          params[`_${column}`] = column
          params[column] = value
        }

        // determine query
        let sets = Object.keys(def).filter(column => column != this.primaryKey).map(column => `::_${column} = :${column}`)
        queries[defKey] = db.insert(`insert into ${this.table} set ${sets.join(', ')}`, params)

      }

      return queries

    })

    // return results
    Object.keys(results).forEach(key => {
      let target = {}
      target[target.constructor.primaryKey] = results[key]
      results[key] = new this(Object.assign(target, defs[key]))
    })
    return results

  }

  // wrap a model in a proxy
  static proxify(model) {
    return new Proxy(model, proxyDef)
  }

  // save multiple
  static async save(models) {

    // create timestamp
    let timestamp = moment().format('YYYY-MM-DD HH:mm:ss')

    // determine databases to query
    let coreNames = models.map(model => model.constructor.coreName)
    coreNames = coreNames.filter((coreName, index) => coreNames.indexOf(coreName) == index)

    // query each database once
    for (let coreName of coreNames) {
      let dbModels = models.filter(model => model.constructor.coreName == coreName)
      let results = await new DB(coreName).multiple(db => {
        let queries = []

        // save each model
        for (let model of dbModels) {

          // update timestamps
          if (model.constructor.timestamps) {
            let timestampColumns = typeof model.constructor.timestamps == 'object' ? model.constructor.timestamps : {}
            if (!timestampColumns.createdAt) timestampColumns.createdAt = 'createdAt'
            if (!timestampColumns.updatedAt) timestampColumns.updatedAt = 'updatedAt'
            if (!model[model.primaryKey]) model[timestampColumns.createdAt] = timestamp
            model[timestampColumns.updatedAt] = timestamp
          }

          // set attributes
          let params = {}
          for (let column of Object.keys(model.attributes).filter(column => column != model.constructor.primaryKey)) {
            let value = model.attributes[column]
            if (model.constructor.dates && model.constructor.dates.includes(column) && typeof value == 'string') value = DB.date(value)
            params[`_${column}`] = column
            params[column] = value
          }
          let sets = Object.keys(model.attributes).filter(column => column != model.constructor.primaryKey).map(column => `::_${column} = :${column}`)

          // determine query
          let query
          if (model[model.constructor.primaryKey]) query = db.update(`update ${model.constructor.table} set ${sets} where ${model.constructor.primaryKey} = ${model[model.constructor.primaryKey]}`, params)
          else query = db.insert(`insert into ${model.constructor.table} set ${sets.join(', ')}`, params)
          queries.push(query)

        }

        // return queries to be run
        return queries

      })

      // update ids on models
      dbModels.forEach((model, index) => {
        if (!model[model.constructor.primaryKey]) model[model.constructor.primaryKey] = results[index]
      })

    }

    // return models
    return models

  }

  // save model to database
  async save() {

    // update timestamps
    if (this.constructor.timestamps) {
      let timestamp = moment().format('YYYY-MM-DD HH:mm:ss')
      let timestampColumns = typeof this.constructor.timestamps == 'object' ? this.constructor.timestamps : {}
      if (!timestampColumns.createdAt) timestampColumns.createdAt = 'createdAt'
      if (!timestampColumns.updatedAt) timestampColumns.updatedAt = 'updatedAt'
      if (!this[this.constructor.primaryKey]) this[timestampColumns.createdAt] = timestamp
      this[timestampColumns.updatedAt] = timestamp
    }

    // set attributes
    let params = {'_table': this.constructor.table}
    for (let column of Object.keys(this.attributes).filter(column => column != this.constructor.primaryKey)) {
      let value = this.attributes[column]
      if (this.constructor.dates && this.constructor.dates.includes(column) && typeof value == 'string') value = DB.date(value)
      params[`_${column}`] = column
      params[column] = value
    }
    let sets = Object.keys(this.attributes).filter(column => column != this.constructor.primaryKey).map(column => `::_${column} = :${column}`)

    // determine query
    let query
    if (this[this.constructor.primaryKey]) query = DB.escape(`update ::_table set ${sets} where ${this.constructor.primaryKey} = ${this[this.constructor.primaryKey]}`, params)
    else query = DB.escape(`insert into ::_table set ${sets.join(', ')}`, params)

    // save new or update
    if (!this[this.constructor.primaryKey]) this[this.constructor.primaryKey] = await new DB(this.constructor.coreName).insert(query)
    else await new DB(this.constructor.coreName).update(query)

    // return self
    return this

  }

  // return where query
  static where(...options) {
    return new Query(this).where(...options)
  }

  // return where in query
  static whereIn(...options) {
    return new Query(this).whereIn(...options)
  }

}

// get all cores
Model.models = {}
Model.tables = {}
if (fs.existsSync(`${process.cwd()}/core`)) {
  for (let coreName of fs.readdirSync(`${process.cwd()}/core`)) {

    // only get mysql cores
    let coreJson = require(`${process.cwd()}/core/${coreName}/core.json`)
    if (coreJson.type != 'mysql' || !fs.existsSync(`${process.cwd()}/core/${coreName}/model`)) continue

    // add model to lists
    Model.models[coreName] = {}
    Model.tables[coreName] = {}
    for (let modelName of fs.readdirSync(`${process.cwd()}/core/${coreName}/model`).map(model => model.slice(0, -3))) {
      let def = require(`${process.cwd()}/core/${coreName}/model/${modelName}`)
      let model = class extends Model {}
      let descriptors = Object.getOwnPropertyDescriptors(def.prototype)
      for (let descriptorName of Object.keys(descriptors).filter(key => key != 'constructor')) Object.defineProperty(model.prototype, descriptorName, descriptors[descriptorName])
      for (let key of Object.getOwnPropertyNames(def).filter(key => !['name', 'length', 'prototype'].includes(key))) model[key] = def[key]
      for (let key of Object.getOwnPropertyNames(def.prototype).filter(key => !Object.keys(descriptors).includes(key))) model.prototype[key] = def.prototype[key]
      model.coreName = coreName
      model.table = def.table || modelName
      model.primaryKey = def.primaryKey || 'id'
      model.dates = def.dates || []
      model.timestamps = def.timestamps || false
      model = Model.proxify(model)
      Model.models[coreName][modelName] = model
      Model.tables[coreName][model.table] = model
    }

  }
}

module.exports = Model
