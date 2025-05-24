#!/usr/bin/env node

/**
 * Chunk Analysis Script
 * Analyzes webpack bundle and suggests optimizations for small chunks
 * Now focuses on GZIPPED sizes for realistic network transfer analysis
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Configuration - Updated for gzipped sizesconst
BUILD_DIR = path.join(__dirname, "../build");
const STATS_FILE = path.join(BUILD_DIR, "stats.json");
const SMALL_CHUNK_THRESHOLD_GZIPPED = 5000;  // 5KB gzipped - merge into bundles
const BUNDLE_TARGET_SIZE_GZIPPED = 10000;  // 10KB gzipped - target bundle size
const MAX_CHUNK_SIZE_GZIPPED = 25000;  // 25KB gzipped - maximum chunk size

/**
 * Calculate gzipped size of content
 */
function getGzippedSize(content) {
  if (typeof content === "string") {
    content = Buffer.from(content, "utf8");
  }
  return zlib.gzipSync(content).length;
}

/**
 * Get gzipped size of a file
 */
function getFileGzippedSize(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return getGzippedSize(content);
  } catch (error) {
    console.warn(`Could not read file ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Analyze webpack stats and suggest optimizations
 */
async function analyzeChunks() {
  console.log("🔍 Analyzing webpack chunks (GZIPPED sizes)...\n");

  // Check if stats file exists
  if (!fs.existsSync(STATS_FILE)) {
    console.error("❌ Stats file not found. Run: npm run build:analyze");
    process.exit(1);
  }

  try {
    const stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
    const chunks = stats.chunks || [];
    const assets = stats.assets || [];

    // Analyze chunks by gzipped size
    const chunkAnalysis = analyzeChunkSizes(chunks, assets);
    const moduleAnalysis = analyzeModules(stats.modules || []);

    // Generate reports
    generateSizeReport(chunkAnalysis);
    generateOptimizationSuggestions(chunkAnalysis, moduleAnalysis);
    generateWebpackConfig(chunkAnalysis);
  } catch (error) {
    console.error("❌ Error analyzing stats:", error.message);
    process.exit(1);
  }
}

/**
 * Analyze chunk sizes and categorize them by gzipped size
 */
function analyzeChunkSizes(chunks, assets) {
  const assetMap = new Map();

  // Calculate gzipped sizes for all assets
  console.log("📦 Calculating gzipped sizes...");
  assets.forEach((asset) => {
    const assetPath = path.join(BUILD_DIR, asset.name);
    const rawSize = asset.size;
    const gzippedSize = getFileGzippedSize(assetPath);

    assetMap.set(asset.name, {
      raw: rawSize,
      gzipped: gzippedSize,
      compressionRatio:
        gzippedSize > 0 ? (rawSize / gzippedSize).toFixed(2) : 0,
    });
  });

  const analysis = {
    small: [], // < 5KB gzipped - merge into bundles
    medium: [], // 5-10KB gzipped - good size
    large: [], // 10-40KB gzipped - acceptable
    huge: [], // > 40KB gzipped - needs splitting
    totalRaw: 0,
    totalGzipped: 0,
    count: chunks.length,
  };

  chunks.forEach((chunk) => {
    const chunkFiles = chunk.files || [];
    let totalRawSize = 0;
    let totalGzippedSize = 0;

    chunkFiles.forEach((file) => {
      const sizeInfo = assetMap.get(file);
      if (sizeInfo) {
        totalRawSize += sizeInfo.raw;
        totalGzippedSize += sizeInfo.gzipped;
      }
    });

    analysis.totalRaw += totalRawSize;
    analysis.totalGzipped += totalGzippedSize;

    const chunkInfo = {
      id: chunk.id,
      name: chunk.names?.[0] || `chunk-${chunk.id}`,
      rawSize: totalRawSize,
      gzippedSize: totalGzippedSize,
      compressionRatio:
        totalGzippedSize > 0 ? (totalRawSize / totalGzippedSize).toFixed(2) : 0,
      files: chunkFiles,
      modules: chunk.modules?.length || 0,
      parents: chunk.parents || [],
      children: chunk.children || [],
    };

    // Categorize by gzipped size
    if (totalGzippedSize < SMALL_CHUNK_THRESHOLD_GZIPPED) {
      analysis.small.push(chunkInfo);
    } else if (totalGzippedSize < BUNDLE_TARGET_SIZE_GZIPPED) {
      analysis.medium.push(chunkInfo);
    } else if (totalGzippedSize < MAX_CHUNK_SIZE_GZIPPED) {
      analysis.large.push(chunkInfo);
    } else {
      analysis.huge.push(chunkInfo);
    }
  });

  return analysis;
}

/**
 * Analyze modules to find grouping opportunities (with gzipped estimates)
 */
function analyzeModules(modules) {
  const analysis = {
    nodeModules: [],
    appModules: [],
    smallModules: [],
    duplicates: new Map(),
  };

  modules.forEach((module) => {
    const rawSize = module.size || 0;
    // Estimate gzipped size (typically 25-35% of raw size for JS)
    const estimatedGzippedSize = Math.round(rawSize * 0.3);
    const name = module.name || module.identifier || "unknown";

    const moduleInfo = {
      name,
      rawSize,
      estimatedGzippedSize,
    };

    if (name.includes("node_modules")) {
      analysis.nodeModules.push(moduleInfo);
    } else if (name.includes("/src/")) {
      analysis.appModules.push(moduleInfo);
    }

    if (estimatedGzippedSize < SMALL_CHUNK_THRESHOLD_GZIPPED) {
      analysis.smallModules.push(moduleInfo);
    }

    // Track potential duplicates
    const baseName = path.basename(name);
    if (!analysis.duplicates.has(baseName)) {
      analysis.duplicates.set(baseName, []);
    }
    analysis.duplicates.get(baseName).push(moduleInfo);
  });

  return analysis;
}

/**
 * Generate size report with gzipped focus
 */
function generateSizeReport(analysis) {
  console.log("\n📊 CHUNK SIZE ANALYSIS (GZIPPED)");
  console.log("=".repeat(60));

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const categories = [
    {
      name: "Small (< 5KB gzipped)",
      chunks: analysis.small,
      color: "🔴",
      threshold: "Bundle together into 10KB chunks",
    },
    {
      name: "Medium (5-10KB gzipped)",
      chunks: analysis.medium,
      color: "🟢",
      threshold: "Good size",
    },
    {
      name: "Large (10-40KB gzipped)",
      chunks: analysis.large,
      color: "🔵",
      threshold: "Acceptable size",
    },
    {
      name: "Huge (> 40KB gzipped)",
      chunks: analysis.huge,
      color: "🟣",
      threshold: "Split into smaller chunks",
    },
  ];

  categories.forEach((category) => {
    if (category.chunks.length > 0) {
      console.log(
        `\n${category.color} ${category.name}: ${category.chunks.length} chunks`
      );
      console.log(`   Recommendation: ${category.threshold}`);

      const totalGzipped = category.chunks.reduce(
        (sum, chunk) => sum + chunk.gzippedSize,
        0
      );
      const totalRaw = category.chunks.reduce(
        (sum, chunk) => sum + chunk.rawSize,
        0
      );
      const avgCompression =
        totalRaw > 0 ? (totalRaw / totalGzipped).toFixed(2) : 0;

      console.log(
        `   Total gzipped: ${formatSize(totalGzipped)} (raw: ${formatSize(
          totalRaw
        )}, ${avgCompression}x compression)`
      );

      if (category.chunks.length <= 10) {
        category.chunks.forEach((chunk) => {
          console.log(
            `   - ${chunk.name}: ${formatSize(
              chunk.gzippedSize
            )} gzipped (${formatSize(chunk.rawSize)} raw, ${
              chunk.compressionRatio
            }x)`
          );
        });
      } else {
        console.log(
          `   - ${category.chunks
            .slice(0, 5)
            .map((c) => c.name)
            .join(", ")}... (showing first 5)`
        );
      }
    }
  });

  console.log(`\n📈 Total: ${analysis.count} chunks`);
  console.log(`📦 Raw size: ${formatSize(analysis.totalRaw)}`);
  console.log(`🗜️ Gzipped size: ${formatSize(analysis.totalGzipped)}`);
  console.log(
    `📊 Overall compression: ${(
      analysis.totalRaw / analysis.totalGzipped
    ).toFixed(2)}x`
  );

  // Network transfer estimates
  const transferTime3G = (
    analysis.totalGzipped /
    ((1.5 * 1024 * 1024) / 8)
  ).toFixed(2); // 1.5 Mbps
  const transferTime4G = (
    analysis.totalGzipped /
    ((10 * 1024 * 1024) / 8)
  ).toFixed(2); // 10 Mbps
  console.log(`\n🌐 Estimated transfer times:`);
  console.log(`   3G (1.5 Mbps): ${transferTime3G}s`);
  console.log(`   4G (10 Mbps): ${transferTime4G}s`);
}

/**
 * Generate optimization suggestions based on gzipped sizes
 */
function generateOptimizationSuggestions(chunkAnalysis, moduleAnalysis) {
  console.log("\n\n💡 OPTIMIZATION SUGGESTIONS (GZIPPED FOCUS)");
  console.log("=".repeat(60));

  // Suggest grouping small chunks
  const smallChunks = [...chunkAnalysis.small];
  if (smallChunks.length > 0) {
    const totalGzipped = smallChunks.reduce(
      (sum, chunk) => sum + chunk.gzippedSize,
      0
    );
    const totalRaw = smallChunks.reduce((sum, chunk) => sum + chunk.rawSize, 0);

    console.log(`\n🎯 Group ${smallChunks.length} small chunks together:`);
    console.log(
      `   Current: ${smallChunks.length} requests, ${(
        totalGzipped / 1024
      ).toFixed(1)}KB gzipped`
    );
    console.log(`   Optimized: 1-2 requests, similar size but better caching`);
    console.log(
      `   Network savings: ${smallChunks.length - 2} fewer round trips`
    );

    // Group by type with gzipped sizes
    const groups = {
      vendor: smallChunks.filter(
        (c) => c.name.includes("vendor") || c.name.includes("node_modules")
      ),
      app: smallChunks.filter(
        (c) => c.name.includes("app") || c.name.includes("src")
      ),
      ui: smallChunks.filter(
        (c) => c.name.includes("ui") || c.name.includes("component")
      ),
      utils: smallChunks.filter(
        (c) => c.name.includes("util") || c.name.includes("helper")
      ),
    };

    Object.entries(groups).forEach(([type, chunks]) => {
      if (chunks.length > 1) {
        const gzippedSize = chunks.reduce((sum, c) => sum + c.gzippedSize, 0);
        console.log(
          `   - ${type}: ${chunks.length} chunks → 1 chunk (${(
            gzippedSize / 1024
          ).toFixed(1)}KB gzipped)`
        );
      }
    });
  }

  // Suggest lazy loading opportunities for large chunks
  const largeChunks = [...chunkAnalysis.large, ...chunkAnalysis.huge];
  if (largeChunks.length > 0) {
    console.log(
      `\n⚡ Consider lazy loading ${largeChunks.length} large chunks:`
    );
    largeChunks.slice(0, 5).forEach((chunk) => {
      console.log(
        `   - ${chunk.name}: ${(chunk.gzippedSize / 1024).toFixed(
          1
        )}KB gzipped (${(chunk.rawSize / 1024).toFixed(1)}KB raw)`
      );
    });
    const totalLargeGzipped = largeChunks.reduce(
      (sum, c) => sum + c.gzippedSize,
      0
    );
    console.log(
      `   Potential initial load reduction: ${(
        totalLargeGzipped / 1024
      ).toFixed(1)}KB gzipped`
    );
  } // Compression analysis
  const poorlyCompressed = [
    ...chunkAnalysis.medium,
    ...chunkAnalysis.large,
    ...chunkAnalysis.huge,
  ]
    .filter((chunk) => parseFloat(chunk.compressionRatio) < 2.5)
    .slice(0, 5);

  if (poorlyCompressed.length > 0) {
    console.log(`\n🗜️ Chunks with poor compression (< 2.5x):`);
    poorlyCompressed.forEach((chunk) => {
      console.log(`   - ${chunk.name}: ${chunk.compressionRatio}x compression`);
      console.log(
        `     Consider: minification, tree shaking, or different bundling strategy`
      );
    });
  }

  // Module bundling suggestions
  if (moduleAnalysis.smallModules.length > 10) {
    const totalSmallModulesGzipped = moduleAnalysis.smallModules.reduce(
      (sum, m) => sum + m.estimatedGzippedSize,
      0
    );
    console.log(
      `\n📦 ${moduleAnalysis.smallModules.length} small modules could be bundled together`
    );
    console.log(
      `   Estimated gzipped size: ${(totalSmallModulesGzipped / 1024).toFixed(
        1
      )}KB`
    );
  }
}
/**
 * Generate optimized webpack configuration for gzipped sizes
 */
function generateWebpackConfig(analysis) {
  console.log("\n\n⚙️  SUGGESTED WEBPACK CONFIG (GZIPPED OPTIMIZED)");
  console.log("=".repeat(60));

  const smallChunks = [...analysis.small, ...analysis.medium];
  const config = {
    optimization: {
      splitChunks: {
        chunks: "all",
        minSize: 500, // 500B raw (~150B gzipped)
        maxSize: 15000, // 15KB raw (~4.5KB gzipped)
        cacheGroups: {},
      },
    },
  };

  // Generate cache groups for small chunks based on gzipped analysis
  if (smallChunks.length > 3) {
    config.optimization.splitChunks.cacheGroups.smallVendor = {
      test: /[\\/]node_modules[\\/]/,
      name: "small-vendor",
      chunks: "all",
      priority: 5,
      maxSize: 2000, // ~600B gzipped
      enforce: true,
    };

    config.optimization.splitChunks.cacheGroups.smallApp = {
      test: /[\\/]src[\\/]/,
      name: "small-app",
      chunks: "all",
      priority: 2,
      maxSize: 1500, // ~450B gzipped
      enforce: true,
    };
  }

  console.log("Add this to your craco.config.js:");
  console.log("```javascript");
  console.log(JSON.stringify(config, null, 2));
  console.log("```");

  // Generate import optimization suggestions with gzipped focus
  console.log("\n📝 IMPORT OPTIMIZATION SUGGESTIONS (GZIPPED FOCUS):");
  console.log("```javascript");
  console.log("// Group tiny utilities together (target: < 400B gzipped each)");
  console.log("const MICRO_UTILS = {");
  console.log('  debounce: () => import("lodash.debounce"), // ~200B gzipped');
  console.log('  throttle: () => import("lodash.throttle"), // ~180B gzipped');
  console.log('  clsx: () => import("clsx"), // ~150B gzipped');
  console.log("};");
  console.log("");
  console.log("// Bundle result: ~530B gzipped vs 3 separate requests");
  console.log(
    "const loadMicroUtils = () => Promise.all(Object.values(MICRO_UTILS).map(fn => fn()));"
  );
  console.log("```");

  // Network performance estimates
  console.log("\n🌐 NETWORK PERFORMANCE ESTIMATES:");
  const currentSmallChunks = smallChunks.length;
  const optimizedChunks = Math.ceil(currentSmallChunks / 3);
  const roundTripSavings = currentSmallChunks - optimizedChunks;

  console.log(`Current: ${currentSmallChunks} small chunk requests`);
  console.log(`Optimized: ${optimizedChunks} bundled chunk requests`);
  console.log(`Round trip savings: ${roundTripSavings} requests`);
  console.log(
    `Estimated time savings on 3G: ${(roundTripSavings * 0.3).toFixed(
      1
    )}s (300ms per round trip)`
  );
  console.log(
    `Estimated time savings on 4G: ${(roundTripSavings * 0.1).toFixed(
      1
    )}s (100ms per round trip)`
  );
}

// Run analysis
if (require.main === module) {
  analyzeChunks().catch(console.error);
}

module.exports = { analyzeChunks };
