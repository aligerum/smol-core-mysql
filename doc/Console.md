# Console

When using `smol console`, each mysql core will be available as an object within the global scope by name. For example, if you have a mysql core named `testDb`, a variable named `testDb` will be an object.

That object will have a `models` object within it. The keys of that object are the names of models defined for that core.

For example, if you have `testDb/model/user.js` and `testDb/model/image.js`, you will have an object like this available in the console:

```js
testDb: {
  models: {
    user: (User model),
    image: (Image model),
  }
}
```
