import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  const shouldAnalyze = env.ANALYZE === 'true';

  return {
    plugins: [
      react({
        // Include .js files for JSX transformation
        include: '**/*.{jsx,js}',
        // Use automatic JSX runtime
        jsxRuntime: 'automatic',
        // Babel plugins for optimization
        babel: {
          plugins: [
            ['babel-plugin-transform-react-remove-prop-types', { mode: 'remove', removeImport: true }],
            isProduction && ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }],
            ['babel-plugin-lodash'],
          ].filter(Boolean),
        },
      }),
      // Compression plugin for gzip
      isProduction && compression({
        algorithm: 'gzip',
        exclude: [/\.(br)$/, /\.(gz)$/],
      }),
      // Compression plugin for brotli
      isProduction && compression({
        algorithm: 'brotliCompress',
        exclude: [/\.(br)$/, /\.(gz)$/],
      }),
      // Bundle analyzer
      shouldAnalyze && visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),

    resolve: {
      alias: {
        // Alias React to Preact for smaller builds
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react/jsx-runtime': 'preact/jsx-runtime',
        // Fallback for missing refractor language files
        'refractor/lang/armasm.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/arturo.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/awk.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/bbj.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/bqn.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/cilkc.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/cilkcpp.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/cooklang.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/cue.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/gettext.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/gradle.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/linker-script.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/mata.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/metafont.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/odin.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/plant-uml.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/rescript.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/stata.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/supercollider.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
        'refractor/lang/wgsl.js': path.resolve(__dirname, 'src/utils/empty-module.js'),
      },
    },

    build: {
      outDir: 'build',
      sourcemap: env.GENERATE_SOURCEMAP === 'true',
      minify: isProduction ? 'terser' : false,
      cssCodeSplit: true,
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        mangle: {
          safari10: true,
        },
      } : undefined,
      rollupOptions: {
        // Reduce the number of chunks
        maxParallelFileOps: 20,
        output: {
          manualChunks: (id) => {
            // Firebase bundle
            if (id.includes('firebase')) {
              return 'firebase';
            }
            // Markdown and syntax highlighting bundle
            if (id.includes('react-markdown') || 
                id.includes('react-syntax-highlighter') || 
                id.includes('rehype') || 
                id.includes('remark') ||
                id.includes('katex') ||
                id.includes('unified')) {
              return 'markdown';
            }
            // React virtualization libraries
            if (id.includes('react-virtuoso') || 
                id.includes('react-window') || 
                id.includes('react-virtualized-auto-sizer')) {
              return 'virtualization';
            }
            // Icons bundle
            if (id.includes('react-icons') || id.includes('@primer/octicons-react')) {
              return 'icons';
            }
            // All other node_modules go into vendor
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            // Group all application components together
            if (id.includes('/src/components/')) {
              return 'components';
            }
            // Group all contexts together
            if (id.includes('/src/contexts/')) {
              return 'contexts';
            }
            // Group all hooks together
            if (id.includes('/src/hooks/')) {
              return 'hooks';
            }
            // Group all utilities together
            if (id.includes('/src/utils/')) {
              return 'utils';
            }
          },
          // Use content hash for better caching
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
              return `static/media/[name]-[hash][extname]`;
            }
            if (/\.css$/i.test(assetInfo.name)) {
              return `static/css/[name]-[hash][extname]`;
            }
            return `static/[ext]/[name]-[hash][extname]`;
          },
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
    },

    server: {
      port: 3000,
      open: true,
      headers: {
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },

    preview: {
      port: 3001,
    },

    // Worker configuration
    worker: {
      format: 'es',
      plugins: () => [],
    },

    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'firebase',
        'katex',
        'lodash.debounce',
        'lodash.throttle',
      ],
      exclude: [
        // Exclude workers from optimization
        'src/workers/modelProcessor.js',
        'src/workers/streamProcessor.js',
        'src/workers/texProcessor.js',
      ],
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },

    define: {
      // Define process.env for compatibility with some libraries
      'process.env': {},
    },

    esbuild: {
      // Enable JSX in .js files
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
  };
});
