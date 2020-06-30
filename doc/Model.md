# Models

Models are used for pulling data from the database and manipulating that data. You can create models by calling `smol make <coreName> model <modelName>`, for example: `smol make testDb model user`.

# Static Data

Each model requires a `table` key corresponding to the database table the model's data is stored in. The `primaryKey` value is assumed to be `id` if not defined. This column name is used when querying a model by id with methods like `User.find(1)`.

If the model's `timestamps` is set to `true`, it expects to have a `createdAt` and `updatedAt` field on the table. When `model.save()` is called, it will automatically update these values. You can add these fields from `Schema` by using `table.timestamps()`.

You can also set the `timestamps` field on the model to an object with an `updatedAt` and `createdAt` key indicating custom names for the columns, and those columns will be automatically updated on create/update.

You may also define a `dates` array that is a list of column names that should be handled as dates. When querying data from the database, date columns (such as timestamps, datetimes, and dates) are automatically converted to a JavaScript date.

When saving into the database, it's useful to call `DB.date()` on the value being inserted to properly convert it to a valid date string first. All columns defined in the date array are automatically converted before inserting.

# Model Definitions

In addition to the required static data, you can define static functions, instance functions, getters, and setters. Note that accessing column names within getters and setters requires direct access to `attributes`, so for a column named `firstName`, `this.firstName` will not work, but `this.attributes.firstName` will. For example:

```js
module.exports = class User {

  static table = 'user'
  static primaryKey = 'userId'
  static timestamps = true
  static dates = []
  static relationships = {}

  greet() {
    console.log(`Hello, ${this.firstName}!`)
  }

  get fullName() {
    return `${this.attributes.firstName} ${this.attributes.lastName}`
  }

  set fullName(value) {
    this.attributes.firstName = value.split(' ')[0]
    this.attributes.lastName = value.split(' ').reverse()[0]
  }

  static async showStatus() {
    console.log(`The ${this.table} table has ${await this.count()} rows`)
  }

}
```

# Accessing Model Classes

Models can be accessed by their model name within the smolCoreMysql.Model class. For example, to access the model defined within `core/testDb/model/image`:

```js
const Image = require('smol-core-mysql').Model.models.testDb.image
```

This is useful for getting a full list of available models by iterating through the `models` object, but for convenience, you can use the `models()` shortcut method. For example:

```js
const smolCoreMysql = require('smol-core-mysql')
const Image = smolCoreMysql.model('testDb/image')
```

# Querying Data

You can get data from the database by building queries using the Model class.

```js
const User = require('smol-core-mysql').model('testDb/user')

let user = await User.where('email', 'user@example.com').first()
user = User.find(1)
let users = await User.where('email', 'user@example.com').get()
users = await User.get()
```

# Data and Saving

You can also save data to the database by changing column names on the Model.

```js
let user = new User
user.firstName = 'John'
user.lastName = 'Doe'
user.email = 'johnd@example.com'
user.password = await smol.hash.make(req.password)
await user.save()
```

`model.save()` is an asynchronous function. You can also define all of this data directly in the constructor:

```js
user = new User({firstName: 'John', lastName: 'Doe'})
await user.save()
```

You may also insert multiple model instances at once by passing either an array or an object, where the results will be instances of that model mapped to each key or index.

```js
// insert as array
let users = await User.insert([
  {firstName: 'John', lastName: 'Doe'},
  {lastName: 'Jane', lastName: 'Doe'},
])

console.log(users[0].firstName) // outputs 'John'

// insert as object
let users = await User.insert({
  john: {firstName: 'John', lastName: 'Doe'},
  jane: {firstName: 'Jane', lastName: 'Doe'},
})

console.log(users.john.firstName) // outputs 'John'
```

As a shortcut, you can assign multiple values to an array using `.assign()`. This doesn't save the model to the database, it just updates the values on the model instance and returns the model instance. The optional second argument defines which specific keys to assign. For example:

```js
let values = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
}

// assign all to models
let user = await User.find(1)
user.assign(values)

// or, only assign first and last name and then save
await user.assign(values, ['firstName', 'lastName']).save()
```

You can also save multiple models at once after modifying them. You can also mix models within the array of models to be saved (save a User and an Image for instance). If the mixed models are on different databases, this will of course require one query per database.

```js
// get users
let user1 = User.find(1)
let user2 = User.find(2)

// modify models
user1.firstName = 'Fred'
user2.firstName = 'Bob'

// save both with the same query
await User.save([user1, user2])

// this does the same thing, and you can even mix model types within the array
await Model.save([user1, user2])

// you can even mix inserts and updates
let user1 = User.find(1)
user1.firstName = 'Fred'
let user2 = new User({firstName: 'Bob', lastName: 'Johnson'})
await User.save([user1, user2])
```

# User Data

For convenience, you can assign extra data to a model instance without having it saved to the database by using `model.userData`. For example:

```js
// this will cause an error because wasEmailSent is not a column on the user table
let users = await User.get()
for (let user of user) {
  try {
    await Email.component('test').send()
    user.wasEmailSent = true
  } catch (err) {
    user.wasEmailSent = false
  }
}
await Model.save(users)

// this will work, as the data in userData is not saved to the database
let users = await User.get()
for (let user of user) {
  try {
    await Email.component('test').send()
    user.userData.wasEmailSent = true
  } catch (err) {
    user.userData.wasEmailSent = false
  }
}
await Model.save(users)
```

# Relationships

Relationships are defined on Models using the `relationships` static key on the class. The definition is composed of two tables (starting with this Model's table), then the equivalent columns between the two tables within parenthesis.

For instance: `images: 'user(id userId)image'` defines the relationship where the `user` table and `image` table are related where the `userId` column on the `image` table is equal to the `id` column on the `user` table.

You can then access the other table like so:

```js
let user = await User.find(1)
let images = await user.images.get()
```

Accessing the `images` key provides a Query object you can define that is already narrowed down to that specific user's images. Note that you can name these relationship keys whatever you want.

## One to Many and Many to One

A one-to-many relationship is defined where two tables are defined, with one table having a column that points to the other. The column typically points to the other table's `id` column, but it's not required.

For example, you want to have a user be able to have a lot of uploaded images:

- On User Model: `images: 'user(id userId)image'`
- On Image Model: `user: '1 image(userId id)user'`

The `1` at the beginning of the Image Model's relationship definition is to indicate that there is only 1 Model that should be returned since an Image can't have multiple users in this case.

Note that adding a `1` to the beginning of the model will disallow you from defining which columns you want to get and will require you to `await` accessing it. For instance:

```js
let image = await Image.find(1)
let user = await image.user

// if you don't add a 1, you can specify the columns
let user = await image.user.first(['firstName', 'lastName'])
```

## Many to Many

To allow two Models to relate to one another in a many-to-many relationship, you must have a pivot table between them. For example, Users can have many Roles, and Roles can have many Users.

Define the relationship using the pivot table:

- On User Model: `roles: 'user(id userId)roleUser(roleId id)role'`
- On Role Model: `users: 'role(id roleId)roleUser(userId id)user'`

# Pivot Models, Pivot Queries, and Pivot Data

The pivot table can be accessed using the `pivot` getter on the query. For example:

```js
let user = await User.find(1)

// find a role by name
let role = user.roles.whereName('admin').first()

// get all pivot table data
let roleUsers = user.roles.pivot.get()
```

You may either create pivot models in `platform/api/model`, or they will be automatically generated during the query. This allows you to update rows and even create new rows on the pivot table just as if it were a normal model.

```js

// create a new RoleUser model
let roleUser = new user.roles.pivot.model()
roleUser.userId = 1
roleUser.roleId = 1
roleUser.save()

// create a new RoleUser model automatically related to the user
let roleUser = user.roles.pivot.new()

// update a pivot row
let user = User.find(1)
let roleUser = user.roles.pivot.where('roleId', 1).first()
roleUser.expiresAt = '2019-01-01'
roleUser.save()
```

You can also add and remove pivot rows without using models.

```js
// add a role by id
user.roles.add(1, {expiresAt: '2019-01-01'})

// add a role using an instance
user.roles.add(role, {expiresAt: '2019-01-01'})

// remove a role by the pivot row's id
user.roles.remove(1)
```

Note that removal is by the _pivot row's id_, not the related model's (role's) id.

# Queries

The Query class can be used to build queries without having to write SQL. To Query a table, you must specify the database, table, and (if the primary key is not 'id', the primary key). For example, if you have a `user` table with a `userId` primary key:

```js
const Query = require('smol-core-mysql').Query

let users = await new Query('testDb', 'user', 'userId').where('firstName', 'John').where('lastName', 'Doe').get()

// if the primaryKey column name is 'id'
let users = await new Query('testDb', 'user').where('firstName', 'John').where('lastName', 'Doe').get()
```

If you have a Model class defined for the core and table specified in the query, the returned results will be instances of that Model class. If you do not, a new Model class will be dynamically generated at returned, so you can still run functions like `save()`.

```js
const User = require('smol-core-mysql').Model.models.testDb.user

let users = await new Query(User).where('firstName', 'John').where('lastName', 'Doe').get()
```

Even more convenient is using the Model directly, which will automatically generate a new Query object and return its results as Model instances. This has the advantage of being able to modify the results and call `.save()` and other methods on them.

```js
const User = require('smol-core-mysql').Model.models.testDb.user

let user = await User.find(1)
let user = await User.where('email', 'johndoe@example.com').first()
let users = await User.where('firstName', 'John').where('lastName', 'Doe').get()
```

Columns may be passed to any of the actions to get just those columns you need, rather than returning the entire model, saving bandwidth and time.

| Action | Description |
| --- | --- |
| count() | Count the number of results and return that number |
| delete() | Delete the results and return number deleted |
| find(id, columns) | Return a single model with that id |
| get(columns) | Return a list of matched models |
| first(columns) | Return the first from the list of matched models |

# Where Clauses

Where clauses use a variety of different syntaxes:

```js
let coupons = await Coupon.where('type', '=', 'free').get()
coupons = await Coupon.where('type', 'free').get() // shorthand for above
coupons = await Coupon.where('expiresAt', '<', moment()).get()
coupons = await Coupon.where('type', 'in' ['free', 'discount']).get()
coupons = await Coupon.whereIn('type', ['free', 'discount']).get() // shorthand for above
coupons = await Coupon.where('type', 'not in', ['free', 'discount']).get()
coupons = await Coupon.whereNotIn('type', ['free', 'discount']).get() // shorthand for above
```
