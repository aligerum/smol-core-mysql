const smol = require('smol')

module.exports = {
  description: 'Database model',
  files: [
    {
      from: 'seed.js',
      to: filename => `seed/${filename}.js`,
      parse: template => {
        return smol.string.replace(template.content, {
          coreName: template.core,
          modelName: template.filename,
          ModelName: `${template.filename[0].toUpperCase()}${template.filename.slice(1)}`,
        })
      }
    }
  ]
}
