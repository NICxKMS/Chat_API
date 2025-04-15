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
        // Optimize chunks for initial load
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
            }),
            new CssMinimizerPlugin({
              minimizerOptions: {
                preset: ['default', { discardComments: { removeAll: true } }]
              }
            })
          ],
          // Configure initial chunk loading
          runtimeChunk: {
            name: 'runtime', // Extract runtime into separate chunk
          },
          splitChunks: {
            chunks: 'all',
            minSize: 20000,
            maxSize: 70000,
            minChunks: 1,
            maxAsyncRequests: 15,
            maxInitialRequests: 8,
            cacheGroups: {
              // Critical UI - highest priority
              criticalUI: {
                test: module => {
                  return module && module.context &&
                  (
                    /[\\/]src[\\/]components[\\/](layout|common)[\\/]/.test(module.context) ||
                    /[\\/]src[\\/]features[\\/](layout|common)[\\/]/.test(module.context) ||
                    (module.resource && /Layout\.js/.test(module.resource)) ||
                    (module.resource && /Spinner\.js/.test(module.resource)) ||
                    (module.resource && /index\.css/.test(module.resource))
                  );
                },
                name: 'critical-ui',
                chunks: 'all',
                priority: 40,
                enforce: true,
                reuseExistingChunk: true
              },
              // CSS handling - high priority for initial render
              styles: {
                name: 'styles',
                test: /\.css$/,
                chunks: 'all',
                enforce: true,
                priority: 30,
              },
              // Core React bundle - needed for any UI rendering
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types)[\\/]/,
                name: 'vendor-react',
                chunks: 'all',
                priority: 25,
                enforce: true
              },
              // Firebase auth - may be needed early 
              firebase: {
                test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
                name: 'vendor-firebase',
                chunks: 'all',
                priority: 15,
                enforce: true
              },
              // UI components - may be visible in initial render
              ui: {
                test: /[\\/]node_modules[\\/](react-icons|@primer|react-virtualized|react-window)[\\/]/,
                name: 'vendor-ui',
                chunks: 'all',
                priority: 20,
                enforce: true
              },
              // Markdown components - typically needed after initial UI is visible
              markdown: {
                test: /[\\/]node_modules[\\/](react-markdown|rehype|remark|react-syntax-highlighter)[\\/]/,
                name: 'vendor-markdown',
                chunks: 'all',
                priority: 10,
                enforce: true
              },
              // Main node_modules catch-all
              vendors: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: -10,
                reuseExistingChunk: true,
              },
              // App code by type/feature
              app: {
                test: /[\\/]src[\\/]/,
                name: chunk => {
                  if (chunk.context) {
                    const module = chunk.context.match(/[\\/]src[\\/](.*?)([\\/]|$)/);
                    const directory = module && module[1];
                    
                    if (directory === 'components') {
                      const componentType = chunk.context.match(/[\\/]components[\\/](.*?)([\\/]|$)/);
                      return `app.${componentType ? componentType[1] : 'components'}`;
                    }
                    
                    return `app.${directory || 'core'}`;
                  }
                  return 'app.unknown';
                },
                chunks: 'all',
                priority: 5,
                minSize: 0,
                enforce: true
              },
              // Default catch-all
              default: {
                minChunks: 2,
                priority: -40,
                reuseExistingChunk: true,
                minSize: 50000
              }
            }
          }
        };

        // Add bundle analyzer if requested
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