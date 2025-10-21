# Vite Migration Guide

This project has been successfully migrated from Create React App (CRA) with CRACO to Vite.

## What Changed

### 1. Build Tool
- **Before:** Create React App with CRACO for customization
- **After:** Vite for faster builds and HMR

### 2. Configuration Files
- **Removed:** `craco.config.js`
- **Added:** `vite.config.js` and `vitest.config.js`

### 3. Entry Point
- **Before:** `public/index.html` with `%PUBLIC_URL%` placeholders
- **After:** Root-level `index.html` with direct paths and module script

### 4. Environment Variables
- **Before:** `REACT_APP_*` prefix, accessed via `process.env.REACT_APP_*`
- **After:** `VITE_*` prefix, accessed via `import.meta.env.VITE_*`

### 5. Worker Imports
- **Before:** Using `worker-loader` with webpack
- **After:** Vite's native worker support with `?worker` suffix

### 6. Testing
- **Before:** Jest with react-scripts
- **After:** Vitest for faster test execution

## Breaking Changes to Address

### Environment Variables
All files using `process.env.REACT_APP_*` need to be updated to `import.meta.env.VITE_*`:
- ✅ `src/firebaseConfig.js` - Updated
- ✅ `src/contexts/ApiContext.js` - Updated
- ⚠️ Check for any other files that may reference environment variables

### Dynamic Imports
Webpack magic comments like `/* webpackChunkName: "..." */` are ignored by Vite but harmless. They can be optionally removed.

## Installation

To complete the migration, install the new dependencies:

```bash
npm install
```

This will:
- Remove old CRA and CRACO dependencies
- Install Vite and related plugins
- Install Vitest for testing

## Available Scripts

### Development
```bash
npm run dev        # Start development server (port 3000)
npm start          # Alias for npm run dev
```

### Production Build
```bash
npm run build      # Build for production
npm run preview    # Preview production build (port 3001)
```

### Testing
```bash
npm run test              # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run test:ci          # Run tests once (CI mode)
```

### Analysis
```bash
npm run build:analyze    # Build with bundle analysis
```

### Linting
```bash
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
```

## Performance Improvements

Vite provides significant performance improvements:

1. **Faster Dev Server Start:** Uses native ES modules, no bundling needed
2. **Instant HMR:** Hot Module Replacement is nearly instantaneous
3. **Optimized Production Builds:** Uses Rollup for efficient bundling
4. **Better Code Splitting:** Automatic chunk optimization

## Configuration Features

### Vite Config Highlights
- ✅ React to Preact aliasing (smaller bundle size)
- ✅ Compression (gzip + brotli)
- ✅ Bundle visualization (when ANALYZE=true)
- ✅ Terser minification
- ✅ Smart chunk splitting (firebase, markdown, icons, vendor)
- ✅ Worker support
- ✅ Refractor language fallbacks

### Build Optimization
- Content-based hashing for cache optimization
- Automatic code splitting
- Tree shaking
- Dead code elimination
- Console removal in production

## Known Issues & Solutions

### Issue: `process.env` not defined
**Solution:** Use `import.meta.env` instead

### Issue: Workers not loading
**Solution:** Import workers with `?worker` suffix: `import Worker from './worker.js?worker'`

### Issue: Public assets not found
**Solution:** Place assets in `public/` folder and reference without `/public/` prefix

## Migration Checklist

- [x] Create `vite.config.js`
- [x] Create `vitest.config.js`
- [x] Move `index.html` to root
- [x] Update environment variable prefixes in `.env` files
- [x] Update `firebaseConfig.js` to use `import.meta.env`
- [x] Update `ApiContext.js` to use `import.meta.env`
- [x] Update worker imports to use `?worker` suffix
- [x] Update `package.json` dependencies and scripts
- [x] Create `setupTests.js` for Vitest
- [x] Add empty module for refractor fallbacks
- [ ] Remove old files after testing:
  - `craco.config.js`
  - `public/index.html` (replaced by root `index.html`)

## Testing the Migration

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Test production build:**
   ```bash
   npm run build
   npm run preview
   ```

4. **Run tests:**
   ```bash
   npm run test
   ```

## Rollback Plan

If you need to rollback:
1. Restore `package.json` from git
2. Restore `.env` files
3. Restore `src/firebaseConfig.js` and `src/contexts/ApiContext.js`
4. Delete `vite.config.js`, `vitest.config.js`, and root `index.html`
5. Run `npm install`

## Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Migrating from CRA to Vite](https://vitejs.dev/guide/migration.html)

## Next Steps

After verifying the migration works correctly:
1. Delete `craco.config.js`
2. Delete `public/index.html` (keep the manifest.json and other assets)
3. Remove any webpack-specific chunk name comments (optional)
4. Update CI/CD pipelines if needed
5. Update deployment configuration to use `npm run build` (should still work)
