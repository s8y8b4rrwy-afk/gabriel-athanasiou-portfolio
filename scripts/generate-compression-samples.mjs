/**
 * Generate Compression Samples
 * 
 * Fetches ORIGINAL JPEG images from Airtable and creates multiple compression variants.
 * This ensures we're comparing against uncompressed source images, not already-compressed WebP.
 * Outputs detailed metrics (file size, dimensions, etc.) for each variant.
 */

import dotenv from 'dotenv';
import Airtable from 'airtable';
import sharp from 'sharp';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION
// ==========================================

const AIRTABLE_TOKEN = process.env.VITE_AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

const CONFIG_PATH = path.resolve(__dirname, '../config/compressionPresets.json');
const OUTPUT_DIR = path.resolve(__dirname, '../public/images/compression-samples');
const METRICS_OUTPUT = path.resolve(__dirname, '../public/images/compression-samples/metrics.json');
const IMAGE_WIDTH = 1200; // Same as production setting

// ==========================================
// UTILITIES
// ==========================================

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
};

/**
 * Download image from URL
 */
const downloadImage = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
};

const getFileSize = (filePath) => {
  const stats = fs.statSync(filePath);
  return stats.size;
};

const formatFileSize = (bytes) => {
  return (bytes / 1024).toFixed(2);
};

/**
 * Generate a compressed variant
 */
const generateVariant = async (buffer, outputPath, preset) => {
  const { format, quality, lossless, effort } = preset;

  try {
    let pipeline = sharp(buffer).resize(IMAGE_WIDTH, null, {
      fit: 'inside',
      withoutEnlargement: true
    });

    // Apply format-specific settings
    if (format === 'webp') {
      pipeline = pipeline.webp({
        quality: lossless ? 100 : quality,
        lossless: lossless || false,
        effort: effort || 4
      });
    } else if (format === 'avif') {
      pipeline = pipeline.avif({
        quality: quality,
        effort: effort || 4
      });
    } else if (format === 'jpeg') {
      pipeline = pipeline.jpeg({
        quality: quality,
        mozjpeg: true
      });
    }

    await pipeline.toFile(outputPath);
    
    const fileSize = getFileSize(outputPath);
    const metadata = await sharp(outputPath).metadata();

    return {
      success: true,
      fileSize,
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error(`✗ Failed to generate variant: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Fetch sample project records from Airtable
 */
const fetchSampleProjects = async (base, count = 4) => {
  try {
    const records = await base('Projects')
      .select({
        filterByFormula: '{Feature} = TRUE()',
        maxRecords: count,
        fields: ['Gallery']
      })
      .all();
    
    const samples = [];
    for (const record of records) {
      const gallery = record.get('Gallery');
      if (gallery && gallery[0]) {
        samples.push({
          id: record.id,
          title: `Project ${record.id}`,
          url: gallery[0].url,
          type: 'project'
        });
      }
    }
    return samples;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
};

// ==========================================
// MAIN LOGIC
// ==========================================

const main = async () => {
  console.log('🖼️  Generating compression samples from ORIGINAL images...\n');

  // Check credentials
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('✗ Missing Airtable credentials. Set VITE_AIRTABLE_TOKEN and VITE_AIRTABLE_BASE_ID.');
    process.exit(1);
  }

  // Load configuration
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`✗ Configuration file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const { presets } = config;

  ensureDir(OUTPUT_DIR);

  const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(AIRTABLE_BASE_ID);

  // Fetch sample projects
  console.log('📦 Fetching sample projects from Airtable...\n');
  const samples = await fetchSampleProjects(base, 5);

  if (samples.length === 0) {
    console.error('✗ No sample images found in Airtable');
    process.exit(1);
  }

  console.log(`✓ Found ${samples.length} sample images\n`);

  const allMetrics = [];

  // Process each sample image
  for (const sample of samples) {
    console.log(`📸 Processing: ${sample.title} (${sample.id})`);
    console.log(`   Downloading original from Airtable...`);

    let originalBuffer;
    let originalSize;

    try {
      // Download original JPEG
      originalBuffer = await downloadImage(sample.url);
      
      // Save original for comparison
      const originalPath = path.join(OUTPUT_DIR, `${sample.type}-${sample.id}-original.jpg`);
      fs.writeFileSync(originalPath, originalBuffer);
      originalSize = getFileSize(originalPath);
      
      console.log(`   ✓ Original JPEG: ${formatFileSize(originalSize)} KB`);
    } catch (error) {
      console.error(`   ✗ Failed to download: ${error.message}\n`);
      continue;
    }

    const imageMetrics = {
      original: sample.title,
      originalId: `${sample.type}-${sample.id}`,
      originalFilename: `${sample.type}-${sample.id}-original.jpg`,
      originalSize: originalSize,
      originalSizeKB: formatFileSize(originalSize),
      variants: []
    };

    // Generate each preset variant
    for (const preset of presets) {
      const outputFilename = `${sample.type}-${sample.id}_${preset.id}.${preset.format}`;
      const outputPath = path.join(OUTPUT_DIR, outputFilename);

      console.log(`   Generating: ${preset.name}...`);

      const result = await generateVariant(originalBuffer, outputPath, preset);

      if (result.success) {
        const reduction = ((originalSize - result.fileSize) / originalSize * 100).toFixed(1);
        const savingsSign = reduction > 0 ? '-' : '+';
        
        console.log(`     ✓ ${formatFileSize(result.fileSize)} KB (${savingsSign}${Math.abs(reduction)}%)`);

        imageMetrics.variants.push({
          presetId: preset.id,
          presetName: preset.name,
          format: preset.format,
          quality: preset.quality,
          lossless: preset.lossless || false,
          filename: outputFilename,
          fileSize: result.fileSize,
          fileSizeKB: formatFileSize(result.fileSize),
          width: result.width,
          height: result.height,
          reductionPercent: parseFloat(reduction),
          url: `/images/compression-samples/${outputFilename}`
        });
      }
    }

    console.log('');
    allMetrics.push(imageMetrics);
  }

  // Save metrics to JSON
  fs.writeFileSync(METRICS_OUTPUT, JSON.stringify(allMetrics, null, 2));
  console.log(`✅ Metrics saved to: ${METRICS_OUTPUT}`);

  console.log('\n📊 Summary:');
  console.log(`  ✓ Processed ${samples.length} sample images`);
  console.log(`  ✓ Generated ${presets.length} variants per image`);
  console.log(`  ✓ Total variants: ${allMetrics.reduce((sum, img) => sum + img.variants.length, 0)}`);
  console.log('\n✅ Compression samples generated from ORIGINAL sources!\n');
};

main();
