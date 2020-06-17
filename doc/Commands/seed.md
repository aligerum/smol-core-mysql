# seed Command

When testing an app, test data is needed. Rather than having to manually create dummy data, the MySQL core provides a seed system that can populate the data via automation.

# Making Seeds

To make a seed file, run `smol make <coreName> seed <seedName>`. The seed name is typically the name of the table you want to seed. Seeds can seed multiple tables though, in the case of needing related data such as a user and each user's profile image and blog posts.

For example, if you run `smol make testDb seed user`, you can then edit the created file at `core/testDb/seed/user.js`:

```js
const smolCoreMysql = require('smol-core-mysql')
const User = smolCoreMysql.model('appDb/user')

module.exports = {
  description: 'Seed user table',
  exec: async seed => {

    // create models
    let users = []
    for (let i=0; i<seed.count; i++) {

      // create user
      let user = new User({
        firstName: seed.faker.name.firstName(),
        lastName: seed.faker.name.lastName(),
      })
      users.push(user)

    }

    // save
    await User.save(users)

  }
}
```

The `description` field is used when running `smol help mysql seed`. Here, you can see a list of all available seeds.

The `seed` object passed into the `exec` function provides a `count` value. When `smol testDb seed user` is called, this will be the number 1, so 1 user will be created. If `smol testDb seed user 100` is called, 100 users will be created.

This count is passed in rather than doing 1 at a time so a single database query can produce the sample users, rather than having to do 100 individual queries.

The `seed` object also provides a `faker` object which uses the `faker` npm package (see faker npm doc). This allows you to produce randomly generated fake data such as email addresses, names, addresses, phone numbers, etc.
