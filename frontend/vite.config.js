import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vitePrerender from 'vite-plugin-prerender';
import { version } from './package.json';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const commonConfig = {
    plugins: [
      react({
        // Add babel plugin for removing prop-types in production
        babel: {
          plugins: [
            ...(mode === 'production' ? [['babel-plugin-transform-react-remove-prop-types', { removeImport: true }]] : [])
          ],
        },
      }),
      // Add prerender plugin only for build command
      ...(command === 'build' ? [
        vitePrerender({
          // Where the built files live
          staticDir: path.join(__dirname, 'dist'),
          // Where to write the prerendered files (defaults to staticDir)
          outputDir: path.join(__dirname, 'dist'),
          // Which HTML to use as entrypoint
          indexPath: path.join(__dirname, 'dist', 'index.html'),
          // Routes to prerender
          routes: ['/'],
          renderer: new vitePrerender.PuppeteerRenderer({
            headless: true,
            // Wait for any content inside root
            renderAfterElementExists: '#root > *',
            // Fallback wait in ms
            renderAfterTime: 1000,
            // Block 3rd party requests to speed up and avoid failures
            skipThirdPartyRequests: true,
            // Log browser console messages during prerender to diagnose errors
            consoleHandler: (route, msg) => {
              console.log(`[prerender][${route}] console.${msg.type()}: ${msg.text()}`);
            },
          })
        })
      ] : []),
    ],
    // Define global constants
    define: {
      'import.meta.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.REACT_APP_VERSION': JSON.stringify(version),
      // Add other environment variables that were previously accessed via import.meta.env
      // For example, if you had import.meta.env.REACT_APP_API_KEY, you'd add:
      // 'import.meta.env.REACT_APP_API_KEY': JSON.stringify(import.meta.env.REACT_APP_API_KEY)
      // Or, preferably, rename them to VITE_ and access them via import.meta.env.VITE_API_KEY
    },
    server: {
      // From craco.config.js: devServer.headers
      headers: {
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
      port: 3000, // Or your preferred port
      open: true, // Automatically open in browser
    },
    build: {
      outDir: 'dist', // CRA default output folder
      sourcemap: true, // Enable source maps for debugging
      rollupOptions: {
        output: {
          // Mimic CRA's hashed filenames (Vite does this by default but path can be adjusted)
          // assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
          // entryFileNames: 'static/js/[name]-[hash].js',
          // chunkFileNames: 'static/js/[name]-[hash].js',

          // Attempt to replicate craco's splitChunks / manualChunks
          manualChunks: (id) => {
            // Create separate chunks for each Prism language module
            const prismLangMatch = id.match(/[\\/]node_modules[\\/]react-syntax-highlighter[\\/]dist[\\/]esm[\\/]languages[\\/]prism[\\/]([^.]+)\.js$/);
            if (prismLangMatch) {
              return `prism-${prismLangMatch[1]}`;
            }
            // Create separate chunks for each Refractor language module
            const refractorLangMatch = id.match(/[\\/]node_modules[\\/]refractor[\\/]lang[\\/]([^.]+)\.js$/);
            if (refractorLangMatch) {
              return `refractor-${refractorLangMatch[1]}`;
            }
            // Ensure refractor core (non-language parts) goes into its own chunk
            if (id.includes('node_modules/refractor/') && !id.includes('/lang/')) {
              return 'refractor-core';
            }
            if (id.includes('node_modules/react-syntax-highlighter')) {
              return 'react-syntax-highlighter'; // Group all of RSH
            }
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) {
                return 'framework';
              }
              if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('remark-emoji') || id.includes('remark-math') || id.includes('rehype-raw')) {
                return 'markdown';
              }
              if (id.includes('rehype-katex') || id.includes('katex')) {
                return 'katex';
              }
              if (id.includes('@primer/octicons-react') || id.includes('react-icons')) {
                return 'icons';
              }
              if (id.includes('firebase')) {
                return 'firebase';
              }
              if (id.includes('lodash') || id.includes('date-fns') || id.includes('web-vitals')) {
                return 'utils';
              }
              // Fallback for other node_modules
              const packageNameMatch = id.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
              if (packageNameMatch && packageNameMatch[1]) {
                const packageName = packageNameMatch[1].replace('@', '');
                return `vendor-${packageName}`;
              }
              return 'vendor';
            }
          },
        },
      },
      // Replicate Terser options for production builds
      minify: mode === 'production' ? 'terser' : 'esbuild',
      terserOptions: mode === 'production' ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log'],
        },
      } : undefined,
    },
    // To match CRA's behavior of serving assets from the public directory
    // and setting the build output to `build`
    publicDir: 'public', 
  };

  if (command === 'serve') { // Dev specific config
    return {
      ...commonConfig,
      // Dev specific overrides if any
    };
  } else { // Build specific config
    return {
      ...commonConfig,
      // Build specific overrides
      // Example: Customizing filename with version like in craco (more complex in Vite)
      // build: {
      //   ...commonConfig.build,
      //   rollupOptions: {
      //     ...commonConfig.build.rollupOptions,
      //     output: {
      //       ...commonConfig.build.rollupOptions.output,
      //       entryFileNames: `static/js/[name].[hash].v${version.replace(/\./g, '_')}.js`,
      //       chunkFileNames: `static/js/[name].[hash].chunk.v${version.replace(/\./g, '_')}.js`,
      //       assetFileNames: `static/assets/[name].[hash].v${version.replace(/\./g, '_')}[extname]`,
      //     }
      //   }
      // }
    };
  }
}); 