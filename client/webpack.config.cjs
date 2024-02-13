const path = require('path');

module.exports = {
  entry: './javascript/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
