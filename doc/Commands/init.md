# init Command

For convenience in setting up a development database, you can enter details for a local database, then run `smol <coreName> init` to create the database, database user, and permissions for that database locally without having to log into mysql. You will then need to run the database migrations.

An example initial setup when starting local development:

```
$ smol make config --edit
Created config/someDb.json
```

Now set the `protected` key to false and put in whatever you want to name the new database and the name of the new database user to create and save it.

```json
{
  "name": "someDb",
  "host": "localhost",
  "user": "someDbUser",
  "pass": "secret",
  "protected": false,
  "migrationTable": "migration",
  "outputQueries": false
}
```

```
$ smol someDb generate password
Generated password for someDb
$ smol someDb init
Database and user created for someDb
$ smol migrate
```
