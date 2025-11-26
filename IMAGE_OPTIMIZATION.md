# Image Optimization System

> **Last Updated:** November 26, 2025

## Overview

Your portfolio includes a **hybrid image optimization system** that automatically fetches, optimizes, and serves images from Netlify's CDN while maintaining seamless fallback to Airtable URLs.

## How It Works

### 1. Build-Time Optimization

During deployment, the system:
- Fetches **featured projects** (Feature checkbox = TRUE)
- Fetches **public/scheduled journal entries** (Status = "Public" OR "Scheduled")
- Downloads only **new images** (not already optimized)
- Optimizes images to **WebP format** (1600px width, 92% quality)
- Saves optimized images to `/public/images/portfolio/`
- **🆕 Automatically cleans up orphaned images** (deleted from Airtable)

### 2. Runtime Image Delivery

In your React components:
- Images use **optimized URLs** (`/images/portfolio/project-{id}.webp`)
- If an optimized image isn't available yet, browser **automatically falls back to Airtable URL**
- Zero downtime for newly added content

### 3. Incremental Updates & Cleanup

The optimization script is **smart**:
- Only processes new images (compares with existing files)
- Skips already-optimized images
- **Deletes images for content removed from Airtable**
- Fast subsequent builds (typically 5-10 seconds for new images only)
- Prevents storage waste from old content

## File Structure

```
/public/images/portfolio/
  ├── project-{recordId}.webp        # Single project image
  ├── project-{recordId}-0.webp      # First gallery image
  ├── project-{recordId}-1.webp      # Second gallery image
  ├── journal-{recordId}.webp        # Journal cover image
  └── ...
```

## Build Process

### During `npm run build`:

1. **Image Optimization** (`npm run optimize:images`)
   - Fetches filtered Airtable records
   - Builds list of valid image IDs
   - **Cleans up orphaned images** (not in Airtable anymore)
   - Downloads new images
   - Optimizes to WebP
   - Saves to `/public/images/portfolio/`

2. **Content Generation** (`npm run build:content`)
   - Generates share metadata
   - Creates sitemap

3. **Vite Build** (`vite build`)
   - Bundles application
   - Includes optimized images in `dist/`

### Example Output:

```
🖼️  Starting image optimization...

📂 Found 31 existing optimized images
📦 Fetching featured projects...
✓ Found 53 featured projects
📝 Fetching journal entries...
✓ Found 2 public/scheduled journal entries

🧹 Checking for orphaned images...
  🗑️  Deleted orphaned: project-recOLDPROJECT.webp
✓ Cleaned up 1 orphaned image

🔄 Processing images...
  Downloading: project-recNEWPROJECT...
  Optimizing: project-recNEWPROJECT...
  ✓ Saved: project-recNEWPROJECT.webp

📊 Summary:
  ✓ Processed: 1 new images
  ⊘ Skipped: 30 existing images
  🗑️  Deleted: 1 orphaned images
  📁 Total optimized images: 31

✅ Image optimization complete!
```

## Performance Benefits

✅ **Faster Load Times**: Netlify CDN vs Airtable (3-5x faster)  
✅ **Smaller File Sizes**: WebP compression (60-80% smaller)  
✅ **Better SEO**: Improved Core Web Vitals (LCP scores)  
✅ **Reduced API Calls**: Images cached on CDN  
✅ **Zero Maintenance**: Automatic optimization on every deploy

## Configuration

### Image Quality Settings

Edit `/scripts/optimize-images.mjs`:

```javascript
const IMAGE_WIDTH = 1600;     // Max width (good for retina displays)
const IMAGE_QUALITY = 92;     // WebP quality (90-95 = visually lossless)
```

### Filtering Logic

The script only fetches:
- **Projects**: WHERE `Feature` checkbox = TRUE
- **Journal**: WHERE `Status` = "Public" OR "Scheduled"

To change filters, edit the Airtable `select()` calls in `optimize-images.mjs`.

## Components Updated

All image-displaying components now use the unified **OptimizedImage** component:

- ✅ `HomeView.tsx` — Hero, grid, featured journal
- ✅ `IndexView.tsx` — List and grid thumbnails
- ✅ `BlogView.tsx` — Journal entry covers
- ✅ `BlogPostView.tsx` — Post hero, related project thumbnail
- ⚠️ `ProjectDetailView.tsx` — Slideshow retains absolute-positioned `<img>` for now; consider an absolute-friendly `OptimizedImage` variant

## Fallback Behavior

Use `OptimizedImage` for built-in fallback and loading animation:

```tsx
<OptimizedImage
  recordId={recordId}
  fallbackUrl={fallbackUrl}
  type="project"
  alt={title}
  className="w-full h-full object-cover"
  loading="lazy"
/> 
```

Fallback automatically switches to the Airtable URL if the local WebP is missing or fails. Users never see broken image icons; a shimmer placeholder displays until the image loads.

## Git Ignore

Optimized images are **NOT committed to Git**:

```gitignore
# Optimized images (regenerated on each build)
public/images/portfolio/
```

This keeps your repository clean and ensures images are always fresh. Images are generated at build time and shipped within `dist/images/portfolio/`.

## Netlify Deployment

### Environment Variables Required

Ensure these are set in **Netlify Environment Variables**:

```
VITE_AIRTABLE_TOKEN=your_airtable_token
VITE_AIRTABLE_BASE_ID=your_base_id
```

### Build Command

Netlify uses: `npm run build`

This automatically runs:
1. Image optimization
2. Content generation
3. Vite build

### Deploy Time

- **First deploy**: ~30-120 seconds (depending on image count)
- **Subsequent deploys**: ~5-15 seconds (only new images processed)

## Troubleshooting

### Images not optimizing during build

Check Netlify build logs for:
- Missing environment variables
- Airtable API errors
- Network/timeout issues

### Images not displaying on site

Check browser console for:
- 404 errors on optimized image paths
- Fallback to Airtable URLs working

### Build taking too long

- Reduce `IMAGE_WIDTH` in script (e.g., 1200px)
- Check Airtable for unnecessary large images
- Ensure filters are working (only featured/public content)

## Manual Testing

To test locally:

```bash
# Set environment variables in terminal
export VITE_AIRTABLE_TOKEN=your_token
export VITE_AIRTABLE_BASE_ID=your_base_id

# Run optimization
npm run optimize:images

# Check results
ls -la public/images/portfolio/

# Build and preview
npm run build
npm run preview
```

## Future Enhancements

Potential improvements:

- **Multiple sizes**: Generate responsive image variants (400w, 800w, 1200w)
- **Progressive loading**: Implement blur-up technique with low-res placeholders
- **AVIF format**: Add next-gen format support alongside WebP
- **Batch limits**: Process images in chunks for very large portfolios
- **Webhook triggers**: Auto-deploy when Airtable content changes

## Summary

Your site now delivers **fast, optimized images** with:

- ✅ No deployment triggers needed
- ✅ Only featured/public content processed
- ✅ Automatic incremental updates
- ✅ Seamless Airtable fallback
- ✅ Minimal build time impact
- ✅ Maximum performance gains

**The system is production-ready!** 🚀
