# Schema

Tables can be defined by using the smolCoreMysql.Schema class. The Schema class can be used anywhere, but it is typically only used within migrations. All examples in this doc will use a core named `testDb`.

```js
// create a table
await new Schema('testDb').create('user', table => {
  table.id('id')
  table.string('firstName')
  table.string('lastName')
  table.string('email')
  table.boolean('isDisabled').default(false)
})

// modify an existing table
await new Schema('testDb').table('user', table => {
  table.string('firstName', 50).change()
  table.integer('loginCount').default(0)
  table.dropColumn('isDisabled')
})

// create a pivot table
await new Schema('testDb').pivot('user', 'role', table => {
  table.date('expiresAt')
})

// drop a table
await new Schema('testDb').drop('user')

// check if a table exists
if (await Schema('testDb').exists('user')) doStuff()
```

Note that within migrations, the `schema` object that is passed in is an instance of `Schema` created by running `new Schema(smol.coreName)`.

The table object provided to the create function allows you add columns using chained properties starting with the column type.

# Types

- bit(name, digits)
- boolean(name)
- date(name)
- datetime(name)
- decimal(name, totalDigits, decimalDigits), decimal(name, 'n.nn')
- id([name]) (shortcut for unsigned, primary, increment)
- integer(name, length)
- mediumInteger(name, length)
- reference(name) (shortcut for unsigned integer)
- smallInteger(name, length)
- string(name[, length])
- text(name)
- timestamp(name)
- tinyInteger(name, length)

# Options

- default(defaultValue)
- increment()
- nullable()
- primary()
- unsigned()

# Pivot Tables

The `Schema.pivot` function expects the names of the two tables, and automatically concatenates them in alphabetical order and creates columns for their relations. The definition function is optional if there are no pivot columns to add. Example:

```js
// pivot function
await new Schema('testDb').pivot('image', 'comment', table => {
  table.boolean('isApproved').default(false)
})

// is equivalent to this
await new Schema('testDb').create('commentImage', table => {
  table.id()
  table.reference('commentId')
  table.reference('imageId')
  table.boolean('isApproved').default(false)
})
```

# Timestamps

You can use `table.timestamps()` to add timestamp columns to the table. For example:

```js
// timestamps()
await Schema.create('user', table => {
  table.timestamps()
})

// is equivalent to this
await Schema.create('user', table => {
  table.timestamp('createdAt').nullable().default(null)
  table.timestamp('updatedAt').nullable().default(null)
})
```

These columns will be automatically updated when saving the model to the database (see Model documentation).
