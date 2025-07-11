const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup.ts',
    content: './src/content.ts',
    background: './src/background.ts'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'src/manifest.json', 
          to: 'manifest.json' 
        },
        {
          from: 'src/icons',
          to: 'icons',
          noErrorOnMissing: true
        }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'src/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    })
  ],
  
  optimization: {
    splitChunks: false
  },
  
  devtool: 'source-map'
}; 