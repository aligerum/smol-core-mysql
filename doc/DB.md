# DB

The DB class provides a way to directly interact with the database without the use of models or query builders. The Model, Schema, and Query class all use the DB class internally. For these examples, a core named `testDb` will be used.

# MySQL Methods

All arguments except `query` are optional.

| Method | Description |
| --- | --- |
| `count(query, params)` | Perform query and return the count as an integer |
| `delete(query, params)` | Perform query and return number of deleted rows |
| `insert(query, params)` | Perform query and return the new row's id |
| `query(query, params, type)` | Perform query and return results. See below for details. |
| `select(query, params)` | Perform query and return results |
| `update(query, params)` | Perform query |

All methods here (except `query`) are aliases for the `query` method. For example, `new DB('testDb').select('select * from user where name = :name', {name: 'fred'})` is equivalent to calling `new DB.query('select * from user where name = :name', {name: 'fred'}, 'select')`. If you have no parameters, you can pass the type as the second argument: `new DB('testDb').query('select * from user', 'select')`.

# Specifying Database Core

You must specify the database core to use when instantiating the DB object. This determines which config to use for creating the connection.

```js
const DB = require('smol-core-mysql').DB

let userRows = await new DB('testDb').select('select * from user')
```

# Parameters and Identifiers

When handling user or variable input, it is important not to directly insert the data into the statement to prevent sql injection attacks. Instead, you may define named parameters and identifiers within the query and supply an object with values to be escaped and insert.

```js
let userRows = await new DB('testDb').select('select * from ::tableName where firstName = :name', {
  tableName: 'user',
  firstName: 'John',
})
```

You may also manually escape parameters and identifiers by using `DB.escape()`:

```js
let query = DB.escape('select * from ::tableName where firstName = :name', {
  tableName: 'user',
  firstName: 'John',
})
let users = await new DB('testDb').select(query)
```

# Dates

Dates pulled from the database are automatically converted to Date objects. When inserting, it's useful to first convert dates that may be invalid into valid datestrings. For instance: `1/2/15 1:12:32 PM` isn't a valid MySQL date and trying to insert it will cause an error. Running `DB.date('1/2/15 1:12:32 PM')` will return `2015-01-02 13:12:32`.

When using Models, you can set the column names you want this to happen for automatically when calling `Model.insert()` or `model.save()` by defining them in the Model's `dates` array.

# Multiple Queries

When running many queries, it's useful to perform multiple queries at once without having to wait for the results of each, then unpack the results later. To do this, you can provide an object of multiple queries to perform and return.

The `db` object provided by `DB.multiple` represents a collection of queries that will be performed in a single trip to the database.

```js

// perform results
let results = await new DB('testDb').multiple(db => {
  return {
    users: db.select('select * from user limit 1'),
    images: db.select('select * from image'),
    videoCount: db.count('select count(*) from video'),
  }
})

// display results
console.log(`The first user's email is ${results.users[0].email}`)
console.log(`We have ${results.images.length} images`)
console.log(`Database has ${results.videoCount} videos`)
```

Rather than an object with names, you can provide an array and access each result via array index.

```js
let results = await new DB('testDb').multiple(db => {
  return [
    db.insert(`insert into users (name) values (:name)`, {name: 'John'}),
    db.insert(`insert into users (name) values (:name)`, {name: 'Mark'}),
  ]
})
```
