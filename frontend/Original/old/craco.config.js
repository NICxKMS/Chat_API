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
  devServer: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          runtimeChunk: { name: 'runtime' },
          splitChunks: {
            chunks: 'all',
            minSize: 15000,
            maxSize: 100000,
            minRemainingSize: 0,
            enforceSizeThreshold: 15000,
            maxInitialRequests: 10,
            maxAsyncRequests: 10,
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                chunks: 'all',
                priority: -10,
                name(module, chunks, cacheGroupKey) {
                  // Get the package name from module context
                  const packageNameMatch = module.context.match(/[\\\\/]node_modules[\\\\/](.*?)([\\\\/]|$)/);
                  const packageName = packageNameMatch && packageNameMatch[1]
                    ? packageNameMatch[1].replace('@', '')
                    : 'vendor';
                  // e.g. vendors.react or vendors.lodash
                  return `${cacheGroupKey}.${packageName}`;
                },
              },
              styles: {
                test: /\\.css$/,
                name: 'styles',
                chunks: 'all',
                enforce: true
              },
              smallChunks: {
                // Merge all modules smaller than 5KB into this bundle
                test: module => module.size() < 10000,
                name: 'small-chunks',
                chunks: 'all',
                priority: -5,            // run before vendor (-10)
                reuseExistingChunk: true,
                enforce: true
              }
            }
          },
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
            }),
            new CssMinimizerPlugin()
          ]
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
  }
};
