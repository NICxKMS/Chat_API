let BundleAnalyzerPlugin;
try {
  BundleAnalyzerPlugin =
    require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
} catch (error) {
  console.warn(
    "webpack-bundle-analyzer not found. Bundle analysis will be disabled."
  );
  BundleAnalyzerPlugin = null;
}
let ESLintPlugin;
try {
  ESLintPlugin = import("eslint-webpack-plugin").then(module => module.default);
} catch (error) {
  console.warn("eslint-webpack-plugin not found. ESLint will be disabled.");
  ESLintPlugin = null;
}
const isWorker = (path) => path.includes('Processor.js');

const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const Critters = require("critters-webpack-plugin");
const { version } = require("./package.json");
// Plugins for inlining runtime chunks
const HtmlWebpackPlugin = require("html-webpack-plugin");
const InlineChunkHtmlPlugin = require("react-dev-utils/InlineChunkHtmlPlugin");

module.exports = {
  devServer: {
    headers: {
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Inline all worker scripts into the main bundle (no separate worker files)
      webpackConfig.module.rules.unshift({
        test: /src[\\/]workers[\\/].*\.js$/,
        use: [
          {
            loader: require.resolve('worker-loader'),
            options: {
              inline: 'no-fallback',
              esModule: false,
            },
          },
        ],
      });
      // Ensure correct public path in development (fix importScripts path for workers)
      webpackConfig.output.publicPath = "/";
      // Alias React to Preact for smaller builds
      webpackConfig.resolve = {
        ...(webpackConfig.resolve || {}),
        alias: {
          ...(webpackConfig.resolve.alias || {}),
          react: "preact/compat",
          "react-dom": "preact/compat",
          "react-dom/test-utils": "preact/test-utils",
          "react/jsx-runtime": "preact/jsx-runtime",
        },
      };
      if (env === "production") {
        // Use relative asset URLs to fix MIME type issues when serving static files
        // webpackConfig.output.publicPath = "./";
        webpackConfig.optimization = {
          chunkIds: "named",
          moduleIds: "deterministic",
          // runtimeChunk: { name: "runtime" }, // inline runtime to avoid separate runtime chunk
          runtimeChunk: false,
          splitChunks: {
            chunks: "all",
            minSize: 16000, // ~5KB gzipped - minimum chunk size
            maxSize: 90000, // ~25KB gzipped - maximum chunk size
            minChunks: 1,
            maxInitialRequests: 20, // Increased to allow more initial chunks
            maxAsyncRequests: 10, // Increased to allow more async chunks
            cacheGroups: {
              // Bundle all worker modules into a single worker-bundle file
              workerBundles: {
                test: (module) => module.resource && /src[\\/]workers[\\/]/.test(module.resource),
                name: "worker-bundle",
                chunks: "all",
                enforce: true,
                minSize: 0,
                maxSize: Infinity,
                priority: 100,
              },
              // Framework/UI libraries (should be cached long-term)
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                name: "framework",
                chunks: "all",
                priority: 40,
                enforce: true,
              },
              worker: {
                test(module) {
                  return module.resource && isWorker(module.resource);
                },
                chunks: 'all',
                name: 'worker-bundle',
                enforce: true,
                minSize: 0,
                maxSize: Infinity,
              },
              // Markdown processing packages
              markdown: {
                test: /[\\/]node_modules[\\/](react-markdown|emojilib|remark-gfm|remark-emoji|remark-math|rehype-raw|unified|remark-parse|rehype-stringify|.*msat.*|.*micromark.*|.*unist.*|.*gfm.*)[\\/]/,
                name: "markdown",
                chunks: "all",
                priority: 30,
                minSize: 80000,
                maxSize: 85000,
                enforce: true,
              },
              
              // Math rendering
              katex: {
                test: /[\\/]node_modules[\\/](rehype-katex|katex)[\\/]/,
                name: "katex",
                chunks: "all",
                priority: 30,
                enforce: true,
              },
              // Syntax highlighting
              syntaxHighlighter: {
                test: /[\\/]node_modules[\\/](react-syntax-highlighter|rehype-highlight)[\\/]/,
                name: "syntax-highlighter",
                chunks: "all",
                priority: 30,
                minSize: 200000,
                maxSize: 1000000,
                enforce: true,
              },
              // // Icons packages
              // icons: {
              //   test: /[\\/]node_modules[\\/](@primer\/octicons-react|react-icons)[\\/]/,
              //   name: "icons",
              //   chunks: "all",
              //   priority: 25,
              //   enforce: true,
              // },
              // Firebase related
              firebase: {
                test: /[\\/]node_modules[\\/](firebase)[\\/]/,
                name: "firebase",
                chunks: "all",
                priority: 20,
                minSize: 200000,
                enforce: true,
              },
              // Virtualization libraries
              // virtualization: {
              //   test: /[\\/]node_modules[\\/](react-virtuoso|react-window|react-virtualized-auto-sizer)[\\/]/,
              //   name: "virtualization",
              //   chunks: "all",
              //   priority: 25,
              //   enforce: true,
              // },
              // Utility libraries
              // utils: {
              //   test: /[\\/]node_modules[\\/](lodash|date-fns|web-vitals|clsx|prop-types)[\\/]/,
              //   name: "utils",
              //   chunks: "all",
              //   priority: 15,
              //   enforce: true,
              // },
              // Small vendor chunks (merge into 10KB gzipped bundles)
              // smallVendor: {
              //   test: /[\\/]node_modules[\\/]/,
              //   chunks: "all",
              //   priority: 5,
              //   name: "bundled-vendor",
              //   minSize: 0, // Include even very small modules
              //   maxSize: 33000, // Bundle target size
              //   enforce: true, // Force splitting even if global limits are not met
              // },
              // Medium vendor chunks (10-25KB gzipped)
              // mediumVendor: {
              //   test: /[\\/]node_modules[\\/]/,
              //   chunks: "all",
              //   priority: 8,
              //   name(module, chunks, cacheGroupKey) {
              //     const packageNameMatch = module.context.match(
              //       /[\\\\/]node_modules[\\\\/](.*?)([\\\\/]|$)/
              //     );
              //     const packageName =
              //       packageNameMatch && packageNameMatch[1]
              //         ? packageNameMatch[1].replace("@", "").replace("/", "-")
              //         : "vendor";
              //     return `vendor-${packageName}`;
              //   },
              //   minSize: 33000, // ~10KB gzipped
              //   maxSize: 80000, // ~25KB gzipped
              //   minChunks: 2,
              //   enforce: true,
              // },
              // Add refractor-specific vendor splitting (cap at ~6KB gzipped)
              refractorVendor: {
                test: /[\\/]node_modules[\\/]refractor[\\/]/,
                name: "vendor-refractor",
                chunks: "all",
                priority: 21,
                minSize: 80000,
                maxSize: 100000, // ~6KB gzipped
                enforce: true,
              },
              // Combined vendor bundle for all remaining node_modules packages
              vendorBundle: {
                test: /[\\/]node_modules[\\/]/,
                name: "vendor-bundle",
                chunks: "all",
                minSize: 300000,
                maxSize: 500000,
                priority: 10,
                enforce: true,
              },
              // CSS files
              styles: {
                test: /\.css$/,
                name: "styles",
                chunks: "all",
                minSize: 100000,
                maxSize: 200000,
                enforce: true,
                priority: 30,
              },
              // // Small application chunks (merge into 10KB gzipped bundles)
              // smallAppChunks: {
              //   test: /[\\/]src[\\/]/,
              //   chunks: "all",
              //   priority: 2,
              //   name: "bundled-app",
              //   minSize: 0,
              //   maxSize: 33000, // ~10KB gzipped - bundle target size
              //   minChunks: 1,
              //   enforce: true,
              // },
              // Medium application chunks (10-25KB gzipped)
              // mediumAppChunks: {
              //   test: /[\\/]src[\\/]/,
              //   chunks: "all",
              //   priority: 6,
              //   name(module, chunks, cacheGroupKey) {
              //     // Extract meaningful names from file paths
              //     const path = module.resource || module.identifier();
              //     if (path.includes("/components/")) {
              //       const componentMatch = path.match(/\/components\/([^\/]+)/);
              //       return componentMatch
              //         ? `app-${componentMatch[1]}`
              //         : "app-components";
              //     }
              //     if (path.includes("/contexts/")) return "app-contexts";
              //     if (path.includes("/hooks/")) return "app-hooks";
              //     if (path.includes("/utils/")) return "app-utils";
              //     return "app-misc";
              //   },
              //   minSize: 50000, // ~10KB gzipped
              //   maxSize: 80000, // ~25KB gzipped
              //   enforce: true,
              // },
              // Large application chunks (>25KB gzipped) - Split into smaller pieces
              largeAppChunks: {
                test: /[\\/]src[\\/]/,
                chunks: "all",
                priority: 10,
                name(module, chunks, cacheGroupKey) {
                  const path = module.resource || module.identifier();
                  if (path.includes("/components/")) {
                    const componentMatch = path.match(
                      /\/components\/([^\/]+)\/([^\/]+)/
                    );
                    return componentMatch
                      ? `app-${componentMatch[1]}-${componentMatch[2]}`
                      : "app-large-components";
                  }
                  return "app-large";
                },
                minSize: 50000, // ~15KB gzipped
                maxSize: 70000, // Force splitting above 25KB gzipped
                enforce: true,
              },
              // Custom chunks defined by webpackChunkName - Highest priority
              namedChunks: {
                test: (module) => {
                  const name =
                    module.nameForCondition && module.nameForCondition();
                  return name && name.match(/webpackChunkName/) ? true : false;
                },
                name: (module) => {
                  const name =
                    module.nameForCondition && module.nameForCondition();
                  if (!name) return "dynamic";
                  const nameMatch = name.match(
                    /webpackChunkName:\s*["']([^"']+)["']/
                  );
                  return nameMatch ? nameMatch[1] : "dynamic";
                },
                chunks: "all",
                priority: 50,
                enforce: true,
              },
              // Default fallback for any remaining chunks
              default: {
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true,
                name: "common",
                maxSize: 80000, // ~25KB gzipped maximum
              },
            },
          },
          usedExports: true,
          minimize: true,
          minimizer: [
            new TerserPlugin({
              // Only minify JS files
              test: /\.m?js(\?.*)?$/i,
              exclude: /\.css$/i,
              terserOptions: {
                compress: {
                  drop_console: true,
                  drop_debugger: true,
                  pure_funcs: ["console.log"],
                  passes: 2, // Multiple passes for better optimization
                },
                mangle: {
                  safari10: true,
                },
              },
            }),
            new CssMinimizerPlugin({
              // Only minify CSS files
              test: /\.css$/i,
            }),
          ],
        };
        // add version-based cache busting to filenames
        const ver = version.replace(/\./g, "_");
        webpackConfig.output.filename = `static/js/[name].[contenthash:10].v${ver}.js`;
        webpackConfig.output.chunkFilename = `static/js/[name].[contenthash:10].chunk.v${ver}.js`;
        webpackConfig.plugins.forEach((plugin) => {
          if (plugin.constructor.name === "MiniCssExtractPlugin") {
            // plugin.options.filename = `static/css/[name].[contenthash:10].v${ver}.css`;
            // plugin.options.chunkFilename = `static/css/[name].[contenthash:10].chunk.v${ver}.css`;
          }
        });
        // Inline small runtime chunks into HTML to avoid extra round-trips
        webpackConfig.plugins.push(
          new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/])
        );
        // Add gzip and brotli compression of assets
        webpackConfig.plugins
          .push
          // new CompressionPlugin({ filename: '[path][base].gz', algorithm: 'gzip', test: /\.(js|css|html|svg)$/, threshold: 10240, minRatio: 0.8 }),
          // new CompressionPlugin({ filename: '[path][base].br', algorithm: 'brotliCompress', compressionOptions: { level: 11 }, test: /\.(js|css|html|svg)$/, threshold: 10240, minRatio: 0.8 })
          ();
        // Inline critical CSS for above-the-fold content
        webpackConfig.plugins.push(
          new Critters({
            preload: false,
            noscriptFallback: true,
          })
        );

        if (process.env.ANALYZE === "true" && BundleAnalyzerPlugin) {
          webpackConfig.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: "static",
              reportFilename: "bundle-report.html",
              generateStatsFile: true,
              statsFilename: "stats.json",
              defaultSizes: "parsed", // Show uncompressed sizes
              statsOptions: {
                all: true
              },
            })
          );
        } else if (process.env.ANALYZE === "true") {
          console.warn(
            "Analysis requested (ANALYZE=true), but webpack-bundle-analyzer is not installed or failed to load."
          );
        }
      }
      return webpackConfig;
    },
  },
  babel: {
    presets: [
      ["@babel/preset-env", { useBuiltIns: "usage", corejs: 3 }],
      [
        "@babel/preset-react",
        {
          runtime: "automatic",
        },
      ],
    ],
    plugins: [
      "lodash",
      "@babel/plugin-syntax-dynamic-import",
      process.env.REACT_APP_ENV === "production" && [
        "babel-plugin-transform-react-remove-prop-types",
        {
          removeImport: true,
          ignoreFilenames: ["node_modules"],
        },
      ],
      process.env.REACT_APP_ENV === "production" &&
        "babel-plugin-transform-remove-console",
    ].filter(Boolean),
  },
};
