const moment = require('moment')
const mysql = require('mysql')
const smol = require('smol')

let DB = class {

  constructor(name) {
    this.coreName = name
    this.coreConfig = smol.config(name)
    this.connectionDef = {
      host: this.coreConfig.host,
      user: this.coreConfig.user,
      password: this.coreConfig.pass,
      database: this.coreConfig.name,
      multipleStatements: true,
      typeCast: function (field, next) {
        if (['TINY', 'BIT'].includes(field.type) && field.length === 1) return (field.string() === '1')
        return next()
      }
    }
  }

  // return an integer count from a select statement
  async count(query, params) {
    return await this.query(query, params, 'count')
  }

  // convert a value into a date that can be inserted into the database
  static date(date) {

    // return null for ''
    if (!date) return null

    // fix single digit dates
    date = date.replace(/^[0-9]\//, s => `0${s}`).replace(/\/[0-9]\//, s => `/0${s.slice(1)}`)

    // fix single digit times
    date = date.replace(/[^0-9][0-9]:/g, s => `${s[0]}0${s.slice(1)}`).replace(/:[0-9][^0-9]/g, s => `:0${s.slice(1)}`).replace(/:[0-9][^0-9]/g, s => `:0${s.slice(1)}`)

    // MM/DD/YYYY -> YYYY-MM-DD
    date = date.replace(/([0-9]{2})\/([0-9]{2})\/([0-9]{4})/, '$3-$1-$2')

    // fix AM and PM
    date = date.replace(/([0-9]{2})(:[0-9]{2}:[0-9]{2}) (am|pm)/i, (s, hours, rest, meridiem) => {
      hours = parseInt(hours)
      if (meridiem.toLowerCase() == 'am' && hours == 12) hours = 0
      else if (meridiem.toLowerCase() == 'pm' && hours < 12) hours += 12
      if (hours < 10) hours = `0${hours}`
      return `${hours}${rest}`
    })

    // format date
    return moment(date).format('YYYY-MM-DD HH:mm:ss')

  }

  // delete a record and return the results
  async delete(query, params) {
    return await this.query(query, params, 'delete')
  }

  // escape a query
  static escape(query, params) {
    query = query.replace(/\:\:(\w+)/g, (s, key) => params.hasOwnProperty(key) ? mysql.escapeId(params[key]) : s)
    query = query.replace(/\:(\w+)/g, (s, key) => {
      let replacement = typeof params[key] == 'string' ? params[key].replace(/\r\n/g, '\n').replace(/\r/g, '\n') : params[key]
      return params.hasOwnProperty(key) ? mysql.escape(replacement) : s
    })
    return query
  }

  // insert record and return insert id
  async insert(query, params) {
    return await this.query(query, params, 'insert')
  }

  // perform multiple queries
  async multiple(func) {

    // get queries
    let db = {
      count(...options) { return ['count', ...options] },
      delete(...options) { return ['delete', ...options] },
      insert(...options) { return ['insert', ...options] },
      query(...options) { return ['query', ...options] },
      select(...options) { return ['select', ...options] },
      update(...options) { return ['update', ...options] },
    }
    let queryDefs = func(db)

    // perform query
    let results = await this.perform(Object.values(queryDefs))

    // package results
    let returnResults = Array.isArray(queryDefs) ? [] : {}
    for (let i=0; i < Object.keys(queryDefs).length; i++) returnResults[Object.keys(queryDefs)[i]] = results[i]
    return returnResults

  }

  // perform list of queries
  async perform(queries) {

    return new Promise((resolve, reject) => {

      // escape queries
      let escapedQueries = []
      for (let query of queries) escapedQueries.push(this.constructor.escape(query[1], query[2]))

      // connect to db
      let conn = mysql.createConnection(this.connectionDef)
      conn.connect(err => {
        if (err) throw err

        // perform query and close connection

        if (this.coreConfig.outputQueries) console.log(escapedQueries.join('; '))
        conn.query(escapedQueries.join('; '), (err, results) => {
          if (err) throw err
          conn.end()
          if (queries.length < 2) results = [results]
          let returnResults = []
          for (let i=0; i < results.length; i++) {
            let returnResult = results[i]
            if (queries[i][0] == 'count') returnResult = returnResult[0]['count(*)']
            else if (queries[i][0] == 'insert') returnResult = returnResult.insertId
            else if (queries[i][0] == 'delete') returnResult = returnResult.affectedRows
            returnResults.push(returnResult)
          }
          resolve(returnResults)
        })

      })
    })

  }

  // run query on connection
  async query(query, params={}, type) {

    // allow second argument to be type when no params specified
    if (typeof params == 'string') {
      type = params
      params = {}
    }

    // create list of queries
    let results = await this.perform([[type, query, params]])
    return results[0]

  }

  // return records from select statement
  async select(query, params) {
    return await this.query(query, params, 'select')
  }

  // update a record and return the results
  async update(query, params) {
    return await this.query(query, params, 'update')
  }

}

module.exports = DB
