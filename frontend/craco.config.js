let BundleAnalyzerPlugin;
try {
  BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
} catch (error) {
  console.warn('webpack-bundle-analyzer not found. Bundle analysis will be disabled.');
  BundleAnalyzerPlugin = null;
}
let ESLintPlugin;
try {
  ESLintPlugin = require('eslint-webpack-plugin').ESLintPlugin;
} catch (error) {
  console.warn('eslint-webpack-plugin not found. ESLint will be disabled.');
  ESLintPlugin = null;
}
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const Critters = require('critters-webpack-plugin');
const { version } = require('./package.json');
// Plugins for inlining runtime chunks
const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');

module.exports = {
  devServer: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    }
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Alias React to Preact for smaller builds
      webpackConfig.resolve = {
        ...(webpackConfig.resolve || {}),
        alias: {
          ...(webpackConfig.resolve.alias || {}),
          'react': 'preact/compat',
          'react-dom': 'preact/compat',
          'react-dom/test-utils': 'preact/test-utils',
          'react/jsx-runtime': 'preact/jsx-runtime'
        }
      };
      if (env === 'production') {
        // Use relative asset URLs to fix MIME type issues when serving static files
        webpackConfig.output.publicPath = './';
        webpackConfig.optimization = {
          chunkIds: 'named',
          moduleIds: 'deterministic',
          ...webpackConfig.optimization,
          runtimeChunk: { name: 'runtime' },
          splitChunks: {
            chunks: 'all',
            minSize: 20000,
            maxSize: 50000,
            maxInitialRequests: 15,
            maxAsyncRequests: 15,
            cacheGroups: {
              // Framework/UI libraries (should be cached long-term)
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                name: 'framework',
                chunks: 'all',
                priority: 40,
              },
              // Markdown processing packages
              markdown: {
                test: /[\\/]node_modules[\\/](react-markdown|remark-gfm|remark-emoji|remark-math|rehype-raw)[\\/]/,
                name: 'markdown',
                chunks: 'all',
                priority: 30,
              },
              // Math rendering
              katex: {
                test: /[\\/]node_modules[\\/](rehype-katex|katex)[\\/]/,
                name: 'katex',
                chunks: 'all',
                priority: 30,
              },
              // Syntax highlighting
              syntaxHighlighter: {
                test: /[\\/]node_modules[\\/](react-syntax-highlighter)[\\/]/,
                name: 'syntax-highlighter',
                chunks: 'all',
                priority: 30,
              },
              // Icons packages
              icons: {
                test: /[\\/]node_modules[\\/](@primer\/octicons-react|react-icons)[\\/]/,
                name: 'icons',
                chunks: 'all',
                priority: 25,
              },
              // Firebase related
              firebase: {
                test: /[\\/]node_modules[\\/](firebase)[\\/]/,
                name: 'firebase',
                chunks: 'all', 
                priority: 20,
              },
              // Utility libraries
              utils: {
                test: /[\\/]node_modules[\\/](lodash|date-fns|web-vitals)[\\/]/,
                name: 'utils',
                chunks: 'all',
                priority: 15,
              },
              // Other vendor libs group by name
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                chunks: 'all',
                priority: 10,
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
              // CSS files
              styles: {
                test: /\.css$/,
                name: 'styles',
                chunks: 'all',
                enforce: true,
                priority: 20,
              },
              // Custom chunks defined by webpackChunkName
              namedChunks: {
                test: (module) => {
                  // Check for webpackChunkName in comments
                  const name = module.nameForCondition && module.nameForCondition();
                  return name && name.match(/webpackChunkName/) ? true : false;
                },
                name: (module) => {
                  // Extract the chunk name from the comment
                  const name = module.nameForCondition && module.nameForCondition();
                  if (!name) return 'dynamic';
                  
                  const nameMatch = name.match(/webpackChunkName:\s*["']([^"']+)["']/);
                  return nameMatch ? nameMatch[1] : 'dynamic';
                },
                chunks: 'all',
                priority: 50, // Highest priority to override all other rules
              },
              // Small modules bundled together
              // smallChunks: {
              //   // Merge all modules smaller than 10KB into this bundle
              //   test: module => module.size() < 10000,
              //   name: 'small-chunks',
              //   chunks: 'all',
              //   priority: -5, // Low priority to run after other groups
              //   reuseExistingChunk: true,
              //   enforce: true
              // }
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

        // add version-based cache busting to filenames
        const ver = version.replace(/\./g, '_');
        webpackConfig.output.filename = `static/js/[name].[contenthash:10].v${ver}.js`;
        webpackConfig.output.chunkFilename = `static/js/[name].[contenthash:10].chunk.v${ver}.js`;
        webpackConfig.plugins.forEach(plugin => {
          if (plugin.constructor.name === 'MiniCssExtractPlugin') {
            plugin.options.filename = `static/css/[name].[contenthash:10].v${ver}.css`;
            plugin.options.chunkFilename = `static/css/[name].[contenthash:10].chunk.v${ver}.css`;
          }
        });
        // Inline small runtime chunks into HTML to avoid extra round-trips
        webpackConfig.plugins.push(
          new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/])
        );
        // Add gzip and brotli compression of assets
        webpackConfig.plugins.push(
          // new CompressionPlugin({ filename: '[path][base].gz', algorithm: 'gzip', test: /\.(js|css|html|svg)$/, threshold: 10240, minRatio: 0.8 }),
          // new CompressionPlugin({ filename: '[path][base].br', algorithm: 'brotliCompress', compressionOptions: { level: 11 }, test: /\.(js|css|html|svg)$/, threshold: 10240, minRatio: 0.8 })
        );
        // Inline critical CSS for above-the-fold content
        webpackConfig.plugins.push(
          new Critters({
            preload: false,
            noscriptFallback: true
          })
        );

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
      ['@babel/preset-env', { useBuiltIns: 'usage', corejs: 3 }],
      ['@babel/preset-react', {
        runtime: 'automatic'
      }]
    ],
    plugins: [
      'lodash',
      '@babel/plugin-syntax-dynamic-import',
      process.env.REACT_APP_ENV === 'production' && ['babel-plugin-transform-react-remove-prop-types', {
        removeImport: true,
        ignoreFilenames: ['node_modules'],
      }],
      process.env.REACT_APP_ENV === 'production' && 'babel-plugin-transform-remove-console',
    ].filter(Boolean)
  }
};
