# generate password Command

To generate a password for the database, run `smol <coreName> generate password`. This will write the password to the core's config json. If there is already a password defined, this command will not overwrite it.

This is useful for generating passwords for local databases when using `smol <coreName> init`. Obviously, it's not useful to generate a password for a database that has already been created or is currently in production.
