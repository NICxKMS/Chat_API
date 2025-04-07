const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Only apply production optimizations in production mode
      if (env === 'production') {
        // Enable source maps for production build
        webpackConfig.devtool = 'source-map';
        
        // Split chunks optimization
        webpackConfig.optimization.splitChunks = {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          automaticNameDelimiter: '~',
          enforceSizeThreshold: 50000,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
              name(module) {
                const packageName = module.context.match(
                  /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                )[1];
                return `vendor.${packageName.replace('@', '')}`;
              },
            },
            common: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
              name: 'common',
            },
            styles: {
              name: 'styles',
              test: /\.css$/,
              chunks: 'all',
              enforce: true,
            },
          },
        };

        // Optimize CSS
        webpackConfig.optimization.minimizer.push(
          new CssMinimizerPlugin({
            minimizerOptions: {
              preset: [
                'default',
                {
                  discardComments: { removeAll: true },
                },
              ],
            },
          })
        );

        // Add Terser optimization
        webpackConfig.optimization.minimizer.push(
          new TerserPlugin({
            terserOptions: {
              parse: {
                ecma: 8,
              },
              compress: {
                ecma: 5,
                warnings: false,
                comparisons: false,
                inline: 2,
                drop_console: true,
              },
              mangle: {
                safari10: true,
              },
              output: {
                ecma: 5,
                comments: false,
                ascii_only: true,
              },
            },
            parallel: true,
          })
        );
      } else {
        // Development optimizations
        webpackConfig.devtool = 'eval-source-map';
        
        // Disable some development optimizations for faster startup
        webpackConfig.optimization.removeAvailableModules = false;
        webpackConfig.optimization.removeEmptyChunks = false;
        
        // Increase performance budget for development
        webpackConfig.performance = {
          hints: false,
          maxEntrypointSize: 512000,
          maxAssetSize: 512000
        };
      }

      return webpackConfig;
    },
  },
  babel: {
    presets: [
      [
        '@babel/preset-env',
        {
          modules: false,
          useBuiltIns: 'usage',
          corejs: 3,
        },
      ],
      '@babel/preset-react',
    ],
    plugins: [
      '@babel/plugin-syntax-dynamic-import',
      [
        'babel-plugin-named-asset-import',
        {
          loaderMap: {
            svg: {
              ReactComponent: '@svgr/webpack?-svgo,+titleProp,+ref![path]',
            },
          },
        },
      ],
    ],
  },
};