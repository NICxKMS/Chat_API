#!/usr/bin/env node

/**
 * Comprehensive Chunk Optimization Script
 * Analyzes and optimizes webpack bundles using multiple strategies
 * Now focuses on GZIPPED sizes for realistic network transfer optimization
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { analyzeChunks } = require('./analyze-chunks');

// Configuration - Updated for gzipped sizes
const BUILD_DIR = path.join(__dirname, '../build');
const SRC_DIR = path.join(__dirname, '../src');
const OPTIMIZATION_REPORT = path.join(BUILD_DIR, 'optimization-report.json');

// Gzipped size thresholds
const SMALL_GZIPPED_THRESHOLD = 5000;  // 5KB gzipped - merge into bundles
const BUNDLE_TARGET_SIZE_GZIPPED = 10000;  // 10KB gzipped - target bundle size
const MAX_CHUNK_SIZE_GZIPPED = 25000;  // 25KB gzipped - maximum chunk size

/**
 * Calculate gzipped size of content
 */
function getGzippedSize(content) {
  if (typeof content === 'string') {
    content = Buffer.from(content, 'utf8');
  }
  return zlib.gzipSync(content).length;
}

/**
 * Estimate gzipped size from raw size (typical JS compression ratio)
 */
function estimateGzippedSize(rawSize) {
  // JavaScript typically compresses to 25-35% of original size
  return Math.round(rawSize * 0.3);
}

/**
 * Main optimization function
 */
async function optimizeChunks() {
  console.log('🚀 Starting comprehensive chunk optimization (GZIPPED FOCUS)...\n');

  try {
    // Step 1: Analyze current bundle
    console.log('📊 Step 1: Analyzing current bundle...');
    await analyzeChunks();

    // Step 2: Analyze component dependencies
    console.log('\n🔍 Step 2: Analyzing component dependencies...');
    const componentAnalysis = analyzeComponentDependencies();

    // Step 3: Generate optimization strategies
    console.log('\n💡 Step 3: Generating optimization strategies...');
    const strategies = generateOptimizationStrategies(componentAnalysis);

    // Step 4: Apply optimizations
    console.log('\n⚙️ Step 4: Applying optimizations...');
    await applyOptimizations(strategies);

    // Step 5: Generate report
    console.log('\n📋 Step 5: Generating optimization report...');
    generateOptimizationReport(componentAnalysis, strategies);

    console.log('\n✅ Optimization complete! Check the optimization report for details.');

  } catch (error) {
    console.error('❌ Optimization failed:', error.message);
    process.exit(1);
  }
}

/**
 * Analyze component dependencies and sizes with gzipped estimates
 */
function analyzeComponentDependencies() {
  console.log('   Scanning component files and calculating gzipped sizes...');
  
      const analysis = {
      components: [],
      totalFiles: 0,
      totalRawSize: 0,
      totalGzippedSize: 0,
      smallComponents: [], // < 5KB gzipped - merge into bundles
      mediumComponents: [], // 5-10KB gzipped - good size
      largeComponents: [], // 10-40KB gzipped - acceptable
      hugeComponents: [], // > 40KB gzipped - needs splitting
      dependencies: new Map(),
    };

  const scanDirectory = (dir, basePath = '') => {
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const relativePath = path.join(basePath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.')) {
        scanDirectory(fullPath, relativePath);
      } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
        const rawSize = stat.size;
        const content = fs.readFileSync(fullPath, 'utf8');
        const gzippedSize = getGzippedSize(content);
        
        const componentInfo = {
          path: relativePath,
          rawSize,
          gzippedSize,
          compressionRatio: gzippedSize > 0 ? (rawSize / gzippedSize).toFixed(2) : 0,
          imports: extractImports(content),
          exports: extractExports(content),
          isLazy: content.includes('lazy(') || content.includes('import('),
          hasWebpackChunkName: content.includes('webpackChunkName'),
        };

        analysis.components.push(componentInfo);
        analysis.totalFiles++;
        analysis.totalRawSize += rawSize;
        analysis.totalGzippedSize += gzippedSize;

        // Categorize by gzipped size
        if (gzippedSize < SMALL_GZIPPED_THRESHOLD) {
          analysis.smallComponents.push(componentInfo);
        } else if (gzippedSize < BUNDLE_TARGET_SIZE_GZIPPED) {
          analysis.mediumComponents.push(componentInfo);
        } else if (gzippedSize < MAX_CHUNK_SIZE_GZIPPED) {
          analysis.largeComponents.push(componentInfo);
        } else {
          analysis.hugeComponents.push(componentInfo);
        }

        // Track dependencies
        componentInfo.imports.forEach(imp => {
          if (!analysis.dependencies.has(imp)) {
            analysis.dependencies.set(imp, []);
          }
          analysis.dependencies.get(imp).push(relativePath);
        });
      }
    });
  };

  scanDirectory(SRC_DIR);

  const overallCompression = analysis.totalGzippedSize > 0 ? 
    (analysis.totalRawSize / analysis.totalGzippedSize).toFixed(2) : 0;

  console.log(`   Found ${analysis.totalFiles} component files`);
  console.log(`   Total raw size: ${(analysis.totalRawSize / 1024).toFixed(1)}KB`);
  console.log(`   Total gzipped size: ${(analysis.totalGzippedSize / 1024).toFixed(1)}KB`);
  console.log(`   Overall compression: ${overallCompression}x`);
  console.log(`   Small components (< 5KB gzipped): ${analysis.smallComponents.length}`);
  console.log(`   Medium components (5-10KB gzipped): ${analysis.mediumComponents.length}`);
  console.log(`   Large components (10-40KB gzipped): ${analysis.largeComponents.length}`);
  console.log(`   Huge components (> 40KB gzipped): ${analysis.hugeComponents.length}`);

  return analysis;
}

/**
 * Extract import statements from file content
 */
function extractImports(content) {
  const imports = [];
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Extract export statements from file content
 */
function extractExports(content) {
  const exports = [];
  const exportRegex = /export\s+(?:default\s+)?(?:const\s+|let\s+|var\s+|function\s+|class\s+)?(\w+)/g;
  
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  return exports;
}

/**
 * Generate optimization strategies based on gzipped size analysis
 */
function generateOptimizationStrategies(analysis) {
  const strategies = {
    bundleSmallComponents: [],
    optimizeMediumComponents: [],
    splitHugeComponents: [],
    optimizeDependencies: [],
    addLazyLoading: [],
    improveChunkNames: [],
    improveCompression: [],
  };

  // Strategy 1: Bundle small components together (< 5KB gzipped into 10KB bundles)
  if (analysis.smallComponents.length > 1) {
    const groups = groupComponentsByFeature(analysis.smallComponents, 'small');
    strategies.bundleSmallComponents = groups;
  }

  // Strategy 2: Optimize medium components (5-10KB gzipped - already good size)
  if (analysis.mediumComponents.length > 0) {
    strategies.optimizeMediumComponents = analysis.mediumComponents.map(component => ({
      component: component.path,
      rawSize: component.rawSize,
      gzippedSize: component.gzippedSize,
      suggestion: 'Already optimal size (5-10KB gzipped)',
    }));
  }

  // Strategy 3: Split huge components (> 40KB gzipped)
  analysis.hugeComponents.forEach(component => {
    strategies.splitHugeComponents.push({
      component: component.path,
      rawSize: component.rawSize,
      gzippedSize: component.gzippedSize,
      suggestion: 'Split into smaller chunks or add aggressive lazy loading',
    });
  });

  // Strategy 4: Optimize dependencies
  const heavyDependencies = Array.from(analysis.dependencies.entries())
    .filter(([dep, users]) => users.length > 3 && isHeavyDependency(dep))
    .map(([dep, users]) => ({ 
      dependency: dep, 
      users, 
      estimatedGzippedSize: estimateGzippedSize(users.length * 1000), // Rough estimate
      suggestion: 'Extract to separate chunk' 
    }));
  
  strategies.optimizeDependencies = heavyDependencies;

  // Strategy 5: Add lazy loading to large/huge components without it
  const nonLazyComponents = [...analysis.largeComponents, ...analysis.hugeComponents]
    .filter(c => !c.isLazy && !c.path.includes('index.js'));
  strategies.addLazyLoading = nonLazyComponents;

  // Strategy 6: Improve chunk names
  const componentsWithoutChunkNames = analysis.components.filter(c => 
    c.isLazy && !c.hasWebpackChunkName
  );
  strategies.improveChunkNames = componentsWithoutChunkNames;

  // Strategy 7: Improve compression for poorly compressed files
  const poorlyCompressed = analysis.components.filter(c => 
    parseFloat(c.compressionRatio) < 2.5 && c.gzippedSize > 1000 // Focus on files > 1KB gzipped with poor compression
  );
  strategies.improveCompression = poorlyCompressed;

  return strategies;
}

/**
 * Group components by feature/directory with gzipped size consideration
 */
function groupComponentsByFeature(components, sizeCategory) {
  const groups = {};
  
  components.forEach(component => {
    const parts = component.path.split('/');
    const feature = parts[1] || 'common'; // Get feature from path like 'components/chat/...'
    
    if (!groups[feature]) {
      groups[feature] = [];
    }
    groups[feature].push(component);
  });

  return Object.entries(groups)
    .filter(([, components]) => components.length > 1)
    .map(([feature, components]) => ({
      feature,
      sizeCategory,
      components,
      totalRawSize: components.reduce((sum, c) => sum + c.rawSize, 0),
      totalGzippedSize: components.reduce((sum, c) => sum + c.gzippedSize, 0),
      avgCompressionRatio: (components.reduce((sum, c) => sum + parseFloat(c.compressionRatio), 0) / components.length).toFixed(2),
      suggestion: `Bundle ${components.length} ${sizeCategory} ${feature} components together`,
    }));
}

/**
 * Check if a dependency is heavy/should be split
 */
function isHeavyDependency(dep) {
  const heavyDeps = [
    'react-markdown',
    'react-syntax-highlighter',
    'katex',
    'firebase',
    'react-icons',
    'react-virtuoso',
  ];
  
  return heavyDeps.some(heavy => dep.includes(heavy));
}

/**
 * Apply optimization strategies
 */
async function applyOptimizations(strategies) {
  const optimizations = [];

  // Generate webpack config optimizations
  if (strategies.bundleSmallComponents.length > 0) {
    console.log('   📦 Generating small component bundling config...');
    optimizations.push(generateComponentBundlingConfig(strategies.bundleSmallComponents, 'small'));
  }

  if (strategies.optimizeDependencies.length > 0) {
    console.log('   🔧 Generating dependency optimization config...');
    optimizations.push(generateDependencyOptimizationConfig(strategies.optimizeDependencies));
  }

  // Generate code suggestions
  if (strategies.addLazyLoading.length > 0) {
    console.log('   ⚡ Generating lazy loading suggestions...');
    generateLazyLoadingSuggestions(strategies.addLazyLoading);
  }

  if (strategies.improveChunkNames.length > 0) {
    console.log('   🏷️ Generating chunk naming suggestions...');
    generateChunkNamingSuggestions(strategies.improveChunkNames);
  }

  if (strategies.improveCompression.length > 0) {
    console.log('   🗜️ Generating compression improvement suggestions...');
    generateCompressionSuggestions(strategies.improveCompression);
  }

  return optimizations;
}

/**
 * Generate webpack config for component bundling based on gzipped sizes
 */
function generateComponentBundlingConfig(groups, sizeCategory) {
  const cacheGroups = {};

  groups.forEach(group => {
    const groupName = `${sizeCategory}-${group.feature}`;
    const maxSize = sizeCategory === 'tiny' ? 1500 : 3000; // Raw size limits
    
    cacheGroups[groupName] = {
      test: new RegExp(`[\\\\/]src[\\\\/]components[\\\\/]${group.feature}[\\\\/]`),
      name: groupName,
      chunks: 'all',
      priority: sizeCategory === 'tiny' ? 8 : 6,
      maxSize: maxSize,
      enforce: true,
    };
  });

  return {
    type: 'webpack-config',
    description: `${sizeCategory} component bundling configuration (gzipped optimized)`,
    config: { cacheGroups },
  };
}

/**
 * Generate webpack config for dependency optimization
 */
function generateDependencyOptimizationConfig(dependencies) {
  const cacheGroups = {};

  dependencies.forEach(({ dependency }) => {
    const safeName = dependency.replace(/[@\/]/g, '-');
    cacheGroups[`vendor-${safeName}`] = {
      test: new RegExp(`[\\\\/]node_modules[\\\\/]${dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]`),
      name: `vendor-${safeName}`,
      chunks: 'all',
      priority: 20,
      enforce: true,
    };
  });

  return {
    type: 'webpack-config',
    description: 'Dependency optimization configuration',
    config: { cacheGroups },
  };
}

/**
 * Generate lazy loading suggestions with gzipped size info
 */
function generateLazyLoadingSuggestions(components) {
  console.log('\n📝 LAZY LOADING SUGGESTIONS (GZIPPED SIZES):');
  console.log('='.repeat(60));

  components.forEach(component => {
    console.log(`\n🔄 ${component.path}`);
    console.log(`   Size: ${(component.gzippedSize / 1024).toFixed(1)}KB gzipped (${(component.rawSize / 1024).toFixed(1)}KB raw)`);
    console.log(`   Compression: ${component.compressionRatio}x`);
    console.log('   Add lazy loading:');
    console.log('   ```javascript');
    console.log(`   const ${getComponentName(component.path)} = lazy(() => import(/* webpackChunkName: "${getChunkName(component.path)}" */ './${component.path}'));`);
    console.log('   ```');
  });
}

/**
 * Generate chunk naming suggestions
 */
function generateChunkNamingSuggestions(components) {
  console.log('\n🏷️ CHUNK NAMING SUGGESTIONS:');
  console.log('='.repeat(50));

  components.forEach(component => {
    console.log(`\n📛 ${component.path} (${(component.gzippedSize / 1024).toFixed(1)}KB gzipped)`);
    console.log('   Add webpack chunk name:');
    console.log('   ```javascript');
    console.log(`   import(/* webpackChunkName: "${getChunkName(component.path)}" */ './${component.path}')`);
    console.log('   ```');
  });
}

/**
 * Generate compression improvement suggestions
 */
function generateCompressionSuggestions(components) {
  console.log('\n🗜️ COMPRESSION IMPROVEMENT SUGGESTIONS:');
  console.log('='.repeat(60));

  components.forEach(component => {
    console.log(`\n📉 ${component.path}`);
    console.log(`   Current: ${component.compressionRatio}x compression (${(component.gzippedSize / 1024).toFixed(1)}KB gzipped)`);
    console.log('   Suggestions:');
    
    if (parseFloat(component.compressionRatio) < 2.0) {
      console.log('   - Enable better minification');
      console.log('   - Remove unused imports and code');
      console.log('   - Consider tree shaking optimization');
    } else if (parseFloat(component.compressionRatio) < 2.5) {
      console.log('   - Review for redundant code patterns');
      console.log('   - Consider splitting into smaller modules');
    }
  });
}

/**
 * Get component name from path
 */
function getComponentName(filePath) {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.(js|jsx)$/, '');
}

/**
 * Generate chunk name from component path
 */
function getChunkName(filePath) {
  const parts = filePath.split('/').filter(part => part !== 'components');
  return parts.join('-').replace(/\.(js|jsx)$/, '').toLowerCase();
}

/**
 * Generate comprehensive optimization report with gzipped focus
 */
function generateOptimizationReport(analysis, strategies) {
  const report = {
    timestamp: new Date().toISOString(),
    analysis: {
      totalFiles: analysis.totalFiles,
      totalRawSize: analysis.totalRawSize,
      totalGzippedSize: analysis.totalGzippedSize,
      overallCompressionRatio: (analysis.totalRawSize / analysis.totalGzippedSize).toFixed(2),
      smallComponents: analysis.smallComponents.length,
      mediumComponents: analysis.mediumComponents.length,
      largeComponents: analysis.largeComponents.length,
      hugeComponents: analysis.hugeComponents.length,
      dependencies: analysis.dependencies.size,
    },
    strategies: {
      bundleSmallComponents: strategies.bundleSmallComponents.length,
      splitHugeComponents: strategies.splitHugeComponents.length,
      optimizeDependencies: strategies.optimizeDependencies.length,
      addLazyLoading: strategies.addLazyLoading.length,
      improveChunkNames: strategies.improveChunkNames.length,
      improveCompression: strategies.improveCompression.length,
    },
    recommendations: generateRecommendations(analysis, strategies),
    estimatedSavings: calculateEstimatedSavings(analysis, strategies),
  };

  fs.writeFileSync(OPTIMIZATION_REPORT, JSON.stringify(report, null, 2));
  console.log(`📋 Optimization report saved to: ${OPTIMIZATION_REPORT}`);

  // Print summary
  console.log('\n📊 OPTIMIZATION SUMMARY (GZIPPED FOCUS):');
  console.log('='.repeat(60));
  console.log(`📁 Total files analyzed: ${report.analysis.totalFiles}`);
  console.log(`📦 Total gzipped size: ${(report.analysis.totalGzippedSize / 1024).toFixed(1)}KB`);
  console.log(`🗜️ Overall compression: ${report.analysis.overallCompressionRatio}x`);
  console.log(`📦 Component groups to bundle: ${report.strategies.bundleSmallComponents}`);
  console.log(`⚡ Components to lazy load: ${report.strategies.addLazyLoading}`);
  console.log(`🔧 Dependencies to optimize: ${report.strategies.optimizeDependencies}`);
  console.log(`💾 Estimated gzipped size reduction: ${report.estimatedSavings.gzippedSizeReduction}KB`);
  console.log(`🚀 Estimated load time improvement: ${report.estimatedSavings.loadTimeImprovement}ms`);
  console.log(`🌐 Network request reduction: ${report.estimatedSavings.httpRequestReduction} requests`);
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(analysis, strategies) {
  const recommendations = [];

  if (strategies.bundleSmallComponents.length > 0) {
    const totalBundleGroups = strategies.bundleSmallComponents.length;
    recommendations.push({
      priority: 'high',
      type: 'bundling',
      message: `Bundle ${totalBundleGroups} groups of small components to reduce HTTP requests`,
      impact: 'Reduces initial load time by 15-30% and improves caching',
    });
  }

  if (strategies.addLazyLoading.length > 0) {
    const totalLazyGzipped = strategies.addLazyLoading.reduce((sum, c) => sum + c.gzippedSize, 0);
    recommendations.push({
      priority: 'high',
      type: 'lazy-loading',
      message: `Add lazy loading to ${strategies.addLazyLoading.length} components (${(totalLazyGzipped / 1024).toFixed(1)}KB gzipped)`,
      impact: 'Reduces initial bundle size by 30-50%',
    });
  }

  if (strategies.improveCompression.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'compression',
      message: `Improve compression for ${strategies.improveCompression.length} poorly compressed files`,
      impact: 'Reduces transfer size by 10-20%',
    });
  }

  if (strategies.optimizeDependencies.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'dependencies',
      message: `Optimize ${strategies.optimizeDependencies.length} heavy dependencies`,
      impact: 'Improves caching and reduces duplicate code',
    });
  }

  return recommendations;
}

/**
 * Calculate estimated savings from optimizations (gzipped focus)
 */
function calculateEstimatedSavings(analysis, strategies) {
  // Calculate gzipped savings
  const tinyComponentSavings = 0;
  
  const smallComponentSavings = strategies.bundleSmallComponents.reduce((sum, group) => 
    sum + (group.components.length - 1) * 150, 0); // 150B overhead per request saved

  const lazyLoadingSavings = strategies.addLazyLoading.reduce((sum, c) => 
    sum + c.gzippedSize * 0.8, 0); // 80% of lazy-loaded gzipped size

  const compressionSavings = strategies.improveCompression.reduce((sum, c) => 
    sum + c.gzippedSize * 0.15, 0); // 15% improvement from better compression

  const totalGzippedSavings = tinyComponentSavings + smallComponentSavings + lazyLoadingSavings + compressionSavings;
  
  // Network performance improvements
  const httpRequestReduction = strategies.bundleSmallComponents.reduce((sum, group) => 
    sum + group.components.length - 1, 0);

  const loadTimeImprovement = totalGzippedSavings * 0.08 + httpRequestReduction * 100; // 0.08ms per byte + 100ms per request

  return {
    gzippedSizeReduction: Math.round(totalGzippedSavings / 1024),
    loadTimeImprovement: Math.round(loadTimeImprovement),
    httpRequestReduction,
    compressionImprovement: strategies.improveCompression.length > 0 ? '10-20%' : '0%',
  };
}

// Run optimization if called directly
if (require.main === module) {
  optimizeChunks().catch(console.error);
}

module.exports = { optimizeChunks }; 