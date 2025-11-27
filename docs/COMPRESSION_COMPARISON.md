# Image Compression Comparison Tool

## Overview

Internal development tool for visually comparing different image compression settings to determine the optimal balance between quality and file size.

## Key Problem Solved

The current optimization pipeline (Q82 WebP) was compressing **already-compressed WebP images**, causing generation loss and blurry results. This tool fetches **original JPEG images from Airtable** and generates fresh compression variants to ensure accurate quality assessment.

## Features

### 1. Original Source Images
- Fetches uncompressed JPEG images directly from Airtable
- Ensures no generation loss from recompression
- Displays original file size as baseline

### 2. Multiple Compression Presets
Compares 11 different compression variants:
- **Original JPEG** (100% quality baseline)
- **WebP Lossless** (perfect quality, larger size)
- **WebP High Quality** (Q95 - near-lossless)
- **WebP Current (Q82)** (current production setting)
- **WebP Medium** (Q75 - balanced)
- **WebP Low** (Q60 - high compression)
- **AVIF High Quality** (Q85 - best next-gen)
- **AVIF Medium** (Q70)
- **AVIF Low** (Q55)
- **WebP Q90** (sweet spot candidate)
- **WebP Q88** (slight improvement candidate)

### 3. Side-by-Side Comparison Grid
Each variant shows:
- Visual preview
- Format (WebP/AVIF/JPEG)
- Quality setting
- File size in KB
- Dimensions
- **Percentage savings vs original JPEG**

### 4. Before/After Split View
Click any variant to open an interactive comparison modal with:
- Draggable slider to reveal before/after
- Original JPEG on left
- Compressed variant on right
- Keyboard support (ESC to close)

## Usage

### Generate Compression Samples

```bash
npm run generate:compression
```

This will:
1. Connect to Airtable
2. Fetch featured project images
3. Download original JPEG files
4. Generate all compression variants
5. Save metrics to JSON

### View Comparison Page

Navigate to: **http://localhost:3001/compression**

(Or `/compression` in production)

### Update Compression Settings

Edit the configuration file:

```
config/compressionPresets.json
```

Then regenerate samples:

```bash
npm run generate:compression
```

## Configuration

### `/config/compressionPresets.json`

```json
{
  "presets": [
    {
      "id": "webp-high",
      "name": "WebP High Quality",
      "format": "webp",
      "quality": 95,
      "lossless": false,
      "effort": 6,
      "description": "Near-lossless, excellent visual quality"
    }
    // ... more presets
  ]
}
```

**Preset Properties:**
- `id`: Unique identifier
- `name`: Display name
- `format`: `webp`, `avif`, or `jpeg`
- `quality`: 1-100 (higher = better quality, larger size)
- `lossless`: `true` for lossless compression
- `effort`: Compression effort level (higher = slower, better compression)
- `description`: Human-readable description

## File Structure

```
config/
  compressionPresets.json       # Compression settings

scripts/
  generate-compression-samples.mjs  # Sample generator

components/
  ImageComparisonSlider.tsx     # Before/after slider modal
  views/
    ImageCompressionView.tsx    # Main comparison page

public/images/compression-samples/
  project-{id}-original.jpg     # Original JPEG
  project-{id}_webp-high.webp   # WebP high quality variant
  project-{id}_avif-medium.avif # AVIF medium variant
  metrics.json                  # Generated file size data
```

## How It Works

### 1. Sample Generation
```javascript
// Fetches from Airtable
const samples = await fetchSampleProjects(base, 5);

// Downloads original JPEG
const buffer = await downloadImage(sample.url);

// Generates all variants
for (const preset of presets) {
  await generateVariant(buffer, outputPath, preset);
}
```

### 2. Comparison View
- Loads `metrics.json` on page load
- Displays grid of all variants
- Click to open split-view comparison
- Drag slider to compare quality

## Recommended Workflow

1. **Generate samples** with various settings
2. **View comparison page** in browser
3. **Click variants** to use split-view comparison
4. **Identify optimal quality** (best visual quality at smallest size)
5. **Update production settings** in `scripts/optimize-images.mjs`:
   ```javascript
   const IMAGE_QUALITY = 88; // Your chosen setting
   ```
6. **Redeploy** to apply new compression to all images

## Performance Tips

### Finding the Sweet Spot

Look for the **knee of the curve** where:
- Quality degradation becomes noticeable
- File size savings plateau

**Visual indicators:**
- Green percentage = smaller than baseline
- Red percentage = larger than baseline
- Yellow "CURRENT" badge = current production setting

### Typical Results

From our testing with the original JPEG (130.79 KB):

| Setting | File Size | Savings | Quality |
|---------|-----------|---------|---------|
| Original JPEG | 130.79 KB | 0% | Perfect |
| WebP Q95 | 79.11 KB | -39.5% | Near-lossless |
| **WebP Q90** | **42.10 KB** | **-67.8%** | **Excellent** |
| WebP Q88 | 36.53 KB | -72.1% | Excellent |
| WebP Q82 (current) | 23.41 KB | -82.1% | Good |
| AVIF Q85 | 45.59 KB | -65.1% | Excellent |

**Recommendation:** WebP Q90 offers excellent quality with 68% file size reduction.

## Troubleshooting

### "Failed to load compression metrics"
Run: `npm run generate:compression` first

### "No sample images found"
Check Airtable credentials in `.env.local`:
```
VITE_AIRTABLE_TOKEN=your_token
VITE_AIRTABLE_BASE_ID=your_base_id
```

### All variants look blurry
Ensure the script is fetching **original JPEGs from Airtable**, not recompressing existing WebP files.

## Next Steps

Once you've identified the optimal settings:

1. Update `IMAGE_QUALITY` in `/scripts/optimize-images.mjs`
2. Run `npm run optimize:images` to regenerate all portfolio images
3. Test on live site with Lighthouse/WebPageTest
4. Monitor Core Web Vitals (LCP, CLS)

## Internal Access Only

This tool is for development only and should **not** be exposed in production. Consider:
- Adding authentication
- Restricting to internal IP ranges
- Removing route in production builds
