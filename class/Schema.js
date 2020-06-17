const DB = require('./DB')
const smol = require('smol')

let Column = class {

  // column constructor
  constructor(type, name, prop, propB) {
    this.type = type
    this.name = name
    this.isIncrement = false
    this.isNullable = false
    this.isPrimary = false
    this.isUnsigned = false
    this.hasDefault = false
    if (type == 'bit') this.digits = prop || 1
    if (type == 'string') this.length = prop || 255
    if (type == 'tinyint') this.length = prop || 3
    if (type == 'int') this.length = prop || 11
    if (type == 'smallint') this.length = prop || 6
    if (type == 'mediumint') this.length = prop || 8
    if (['decimal', 'float'].includes(type)) {
      if (typeof prop == 'string') {
        this.maxDigits = prop.length - 1
        this.postDecimalDigits = this.maxDigits - (prop.length - prop.indexOf('.'))
      } else {
        this.maxDigits = prop || 2
        this.postDecimalDigits = propB || 2
      }
    }
  }

  // assign default value to column
  default(value) {
    this.default = value
    this.hasDefault = true
    return this
  }

  // set column to automatically increment
  increment() {
    this.isIncrement = true
    return this
  }

  // allow column to be null
  nullable() {
    this.isNullable = true
    return this
  }

  // set column as primary key
  primary() {
    this.isPrimary = true
    return this
  }

  // set number as unsigned
  unsigned() {
    this.isUnsigned = true
    return this
  }

}

let Table = class {

  // table constructor
  constructor(name) {
    this.name = name
    this.columns = []
    this.dropColumns = []
  }

  // add a column to the table
  addColumn(type, name, prop, propB) {
    let column = new Column(type, name, prop, propB)
    this.columns.push(column)
    return column
  }

  // drop column
  dropColumn(name) {
    this.dropColumns.push(name)
  }

  // generate query based on columns
  getQuery(action) {
    let tokens = []
    for (let column of this.columns) {
      let token
      if (column.type == 'bit') token = `${column.name} bit(${column.digits})`
      else if (['decimal', 'float'].includes(column.type)) token = `${column.name} ${column.type}(${column.maxDigits},${column.postDecimalDigits})`
      else if (['tinyint', 'smallint', 'mediumint', 'int'].includes(column.type)) token = `${column.name} ${column.type}(${column.length})`
      else if (column.type == 'string') token = `${column.name} varchar(${column.length})`
      else if (['blob', 'boolean', 'date', 'datetime', 'longblob', 'mediumblob', 'timestamp', 'tinyblob', 'text'].includes(column.type)) token = `${column.name} ${column.type}`
      if (column.isUnsigned) token += ' unsigned'
      if (column.isIncrement) token += ' auto_increment'
      if (!column.isNullable) token += ' not null'
      else if (column.type == 'timestamp') token += ' null'
      if (column.hasDefault) {
        if (column.default === null || column.default === true || column.default === false) token += ` default ${column.default}`
        else if (['boolean', 'bit', 'tinyint', 'smallint', 'mediumint', 'int'].includes(column.type)) token += ` default ${column.default}`
        else if (['date', 'datetime', 'timestamp'].includes(column.type) && column.default.toLowerCase() == 'current_timestamp') token += ` default ${column.default}`
        else if (column.type == 'string') token += ` default "${column.default}"`
        else token += ` default ('${column.default}')`
      }
      tokens.push(token)
      if (column.isPrimary) tokens.push(`primary key (${column.name})`)
    }
    if (action == 'create') return `create table ${this.name} (${tokens.join(', ')})`
    if (action == 'alter') {
      let query = `alter table ${this.name} `
      if (tokens.length) query += tokens.map(token => `add ${token}`).join(', ')
      if (tokens.length && this.dropColumn.length) query += '; '
      if (this.dropColumns.length) query += this.dropColumns.map(column => `drop ${column}`).join(', ')
      return query
    }
  }

  // add timestamp columns
  timestamps() {
    this.addColumn('timestamp', 'createdAt').nullable().default(null)
    this.addColumn('timestamp', 'updatedAt').nullable().default(null)
  }

  // add specific column types
  bit(name, digits) { return this.addColumn('bit', name, digits) }
  blob(name) { return this.addColumn('blob') }
  boolean(name) { return this.addColumn('boolean', name) }
  date(name) { return this.addColumn('date', name) }
  datetime(name) { return this.addColumn('datetime', name) }
  decimal(name, maxDigits, postDecimalDigits) { return this.addColumn('decimal', name, maxDigits, postDecimalDigits) }
  float(name, maxDigits, postDecimalDigits) { return this.addColumn('float', name, maxDigits, postDecimalDigits) }
  id(name) { return this.addColumn('int', name || 'id').unsigned().primary().increment() }
  integer(name, length) { return this.addColumn('int', name, length) }
  longBlob(name) { return this.addColumn('longblob', name) }
  mediumBlob(name) { return this.addColumn('mediumblob', name) }
  mediumInteger(name, length) { return this.addColumn('mediumint', name, length) }
  reference(name) { return this.addColumn('int', name).unsigned() }
  smallInteger(name, length) { return this.addColumn('smallint', name, length) }
  string(name, length) { return this.addColumn('string', name, length) }
  text(name) { return this.addColumn('text', name) }
  timestamp(name) { return this.addColumn('timestamp', name) }
  tinyBlob(name) { return this.addColumn('tinyblob', name) }
  tinyInteger(name, length) { return this.addColumn('tinyint', name, length) }

}

module.exports = class Schema {

  // set core
  constructor(name) {
    this.coreName = name
    this.coreConfig = smol.config(name)
  }

  // create a table
  async create(name, definitionFunction) {
    let table = new Table(name)
    definitionFunction(table)
    let query = table.getQuery('create')
    return new DB(this.coreName).query(query)
  }

  // drop table
  async drop(name) {
    return new DB(this.coreName).query(`drop table ${name}`)
  }

  // return true if a table exists
  async exists(name) {
    let query = `select count(*) from information_schema.tables where table_schema = '${this.coreConfig.name}' and table_name = '${name}'`
    let result = await new DB(this.coreName).query(query)
    return !!result[0]['count(*)']
  }

  // create pivot table
  async pivot(tableA, tableB, definitionFunction) {
    let names = [tableA, tableB].sort()
    let tableName = smol.string.camelCase(names.sort().join('_'))
    let table = new Table(tableName)
    table.id()
    table.reference(`${names[0]}Id`)
    table.reference(`${names[1]}Id`)
    if (definitionFunction) definitionFunction(table)
    let query = table.getQuery('create')
    return new DB(this.coreName).query(query)
  }

  // alter a table
  async table(name, definitionFunction) {
    let table = new Table(name)
    definitionFunction(table)
    let query = table.getQuery('alter')
    return new DB(this.coreName).query(query)
  }

}
