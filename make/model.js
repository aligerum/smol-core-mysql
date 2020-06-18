const smol = require('smol')

module.exports = {
  description: 'Database model',
  files: [
    {
      from: 'model.js',
      to: filename => `model/${filename}.js`,
      parse: template => {
        return smol.string.replace(template.content, {
          modelName: smol.string.studlyCase(template.filename),
          tableName: template.filename,
        })
      }
    }
  ]
}
