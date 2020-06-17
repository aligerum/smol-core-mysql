const moment = require('moment')
const smol = require('smol')

module.exports = {
  description: 'Database migration',
  files: [
    {
      from: 'migration.js',
      to: filename => `migration/${moment().format('YYYY-MM-DD-HHmmss')}-${smol.string.kabobCase(filename)}.js`,
    },
  ],
}
