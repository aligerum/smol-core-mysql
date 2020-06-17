const smol = require('smol')

module.exports = {
  description: 'Database model',
  files: [
    {
      from: 'model.js',
      to: filename => `model/${filename}.js`,
      parse: template => {
        return smol.string.replace(template.content, {
          tableName: template.filename
        })
      }
    }
  ]
}
