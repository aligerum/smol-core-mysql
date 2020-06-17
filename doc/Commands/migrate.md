# migrate Command

In order to easily create local databases from scratch for testing, and to make the deployment process of rolling out on production servers easy, smol provides a database migration system.

The system works by storing database migration files within `core/<coreName>/migration`. Each migration file contains changes to the database as individual steps. These steps can then be run locally to create a database for testing.

These same steps can be run on production servers to initially create their database. Then, new migrations can be created and tested locally. When they are ready to go into production, the migrations are then pulled down to the production server via git, then the newly added migrations are run, bringing the production database up to date.

# Making Migrations

To make a migration, use `smol make <coreName> migration <migrationName>`. This file has an `up` function and a `down` function. These methods are run when migrating forward (up) and backward (down). This allows to to make changes to a live database and undo those changes forward and backward in individual steps.

Because migrations are sequential, they will automatically be prefixed with the timestamp of their creation. This will ensure they're run in the appropriate order. Also, it is important to never change migrations after they've been committed into code versioning, otherwise each instance of the database will become out of sync.

Here's an example of a typical migration called `2020-05-26-031502-create-image-table` which was created by running `smol make testDb migration "create image table"`. Note that the `schema` object passed in targets the proper core's database (see Schema doc).

```js
module.exports = {

  // perform migration
  up: async schema => {

    // create table
    await schema.create('image', table => {
      table.id()
      table.reference('userId')
      table.string('name')
      table.string('filepath')
      table.integer('filesize')
      table.integer('width')
      table.integer('height')
    })

  },

  // roll back migration
  down: async schema => {

    // drop table
    await schema.drop('image')

  },

}
```

# Migrating

To see which migrations have occurred, run `smol <coreName> migrate status`. This will give a list of each migration and the date the migration was run as well as a listing of all migrations that have not been run yet.

To migrate all unmigrated migrations, run `smol <coreName> migrate`. To roll back all performed migrations, run `smol <coreName> migrate drop`. To roll back all migrations and migrate all, run `smol <coreName> migrate fresh`.

To go forward or backward a single step, use `smol <coreName> migrate up` and `smol <coreName> migrate down`. You can also define a specific number of steps by running `smol <coreName> migrate up 5` or `smol <coreName> migration down 5`.

Migrations are not performed on any databases that have `protected: true` in their config or are not on `localhost`. This is to prevent accidental destruction of data.

Also, when in production mode, migrations will not occur unless in maintenance mode or `--force` is passed to the `migrate` command.

For a complete definition of all methods available to the `schema` object, see the Schema doc.
