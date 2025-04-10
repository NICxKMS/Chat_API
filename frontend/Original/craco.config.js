const path = require('path');
let BundleAnalyzerPlugin;
try {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
} catch (error) {
  console.warn('webpack-bundle-analyzer not found. Bundle analysis will be disabled.');
  BundleAnalyzerPlugin = null;
}
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          usedExports: true,
          minimize: true,
          minimizer: [
            new TerserPlugin({
              terserOptions: {
                compress: {
                  drop_console: true,
                  drop_debugger: true,
                  pure_funcs: ['console.log']
                }
              }
            })
          ],
          splitChunks: {
            chunks: 'all',
            minSize: 20000,
            maxSize: 244000,
            minChunks: 1,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            cacheGroups: {
              defaultVendors: {
                test: /[\\/]node_modules[\\/]/,
                priority: -10,
                reuseExistingChunk: true,
                name(module) {
                  const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                  return `npm.${packageName ? packageName.replace(/[^a-zA-Z0-9]/g, '_') : 'vendor'}`;
                },
              },
              reactVendor: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'vendor-react',
                chunks: 'all',
                priority: 10,
                enforce: true
              },
              firebaseVendor: {
                test: /[\\/]node_modules[\\/]firebase[\\/]/,
                name: 'vendor-firebase',
                chunks: 'all',
                priority: 5,
                enforce: true
              },
              commons: {
                name: 'commons',
                chunks: 'initial',
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true
              },
              sharedAsync: {
                name: 'shared-async',
                chunks: 'async',
                minChunks: 2,
                priority: -30,
                reuseExistingChunk: true
              },
              default: {
                minChunks: 2,
                priority: -40,
                reuseExistingChunk: true
              },
            }
          }
        };

        if (process.env.ANALYZE === 'true' && BundleAnalyzerPlugin) {
          webpackConfig.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              reportFilename: 'bundle-report.html',
              generateStatsFile: true,
              statsFilename: 'stats.json'
            })
          );
        } else if (process.env.ANALYZE === 'true') {
           console.warn('Analysis requested (ANALYZE=true), but webpack-bundle-analyzer is not installed or failed to load.');
        }
      }
      return webpackConfig;
    }
  },
  babel: {
    presets: [
      '@babel/preset-env',
      ['@babel/preset-react', {
        runtime: 'automatic'
      }]
    ],
    plugins: [
      '@babel/plugin-syntax-dynamic-import',
      process.env.REACT_APP_ENV === 'production' && ['babel-plugin-transform-react-remove-prop-types', {
        removeImport: true,
        ignoreFilenames: ['node_modules'],
      }],
      process.env.REACT_APP_ENV === 'production' && 'babel-plugin-transform-remove-console',
    ].filter(Boolean)
  },
  devServer: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
};