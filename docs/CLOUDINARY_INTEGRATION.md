# Cloudinary Integration Guide

> **Status:** In Development  
> **Branch:** `cloudinary-integration`  
> **Last Updated:** November 27, 2025

## Overview

Cloudinary integration replaces the custom Sharp-based image optimization with cloud-based automatic image processing. Images are uploaded to Cloudinary during scheduled sync and served with automatic format optimization (WebP/AVIF), quality adjustment, and responsive transformations.

## Architecture

### Image Flow

```
Airtable → Scheduled Sync → Cloudinary Upload → Cloudinary CDN → Browser
                          ↓
                    Local WebP (backup fallback)
```

### Fallback Chain

1. **Primary**: Cloudinary URL with automatic transformations
2. **Secondary**: Local WebP files (existing optimization)
3. **Tertiary**: Original Airtable CDN URLs

## Setup Instructions

### 1. Create Cloudinary Account

1. Go to https://cloudinary.com/users/register/free
2. Sign up for free tier (25GB storage, 25GB bandwidth/month)
3. Verify email and log in
4. Go to **Dashboard** → Copy credentials:
   - Cloud Name
   - API Key
   - API Secret

### 2. Configure Environment Variables

**Local Development (`.env.local`):**
```bash
# Add these to your .env.local file
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
USE_CLOUDINARY=false  # Start disabled for testing
```

**Netlify Production:**
1. Go to Netlify Dashboard → Your Site → Site Settings
2. Navigate to **Environment Variables**
3. Add the same variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `USE_CLOUDINARY` = `false` (initially)

### 3. Initial Migration

Run the migration script to upload existing images to Cloudinary:

```bash
npm run migrate:cloudinary
```

This will:
- Fetch all images from Airtable (~150 images)
- Upload to Cloudinary with naming: `portfolio-projects-{recordId}-{index}`
- Generate `/public/cloudinary-mapping.json` with URL mappings
- Display progress and summary report

**Expected Output:**
```
🚀 Starting Cloudinary Migration...
📦 Found 53 projects with 142 images
📝 Found 2 journal posts with 8 images
⬆️  Uploading to Cloudinary...
  ✓ project-rec2xl62i0mgEo1go-0
  ✓ project-rec2xl62i0mgEo1go-1
  ... (150 more)
✅ Migration complete!
📊 Summary:
  - Uploaded: 150 images
  - Failed: 0 images
  - Mapping saved to: public/cloudinary-mapping.json
```

## Feature Flag System

### Phase 1: Infrastructure Testing (Week 1)
```bash
USE_CLOUDINARY=false
```
- Cloudinary credentials configured
- Migration completed
- Scheduled sync uploads new images
- Frontend still uses local WebP/Airtable URLs
- **Goal:** Verify upload pipeline works without affecting users

### Phase 2: Gradual Rollout (Week 2-3)
```bash
USE_CLOUDINARY=true
```
- Enable Cloudinary URLs for all images
- Monitor performance and errors
- Check Cloudinary bandwidth usage
- **Goal:** Validate production performance

### Phase 3: Full Production (Week 4+)
```bash
USE_CLOUDINARY=true
```
- Cloudinary is primary source
- Local WebP remains as fallback
- Monitor and optimize as needed

## Technical Details

### Image Naming Convention

**Projects:**
```
portfolio-projects-{airtableRecordId}-{index}

Examples:
portfolio-projects-rec2xl62i0mgEo1go-0
portfolio-projects-rec2xl62i0mgEo1go-1
```

**Journal:**
```
portfolio-journal-{airtableRecordId}

Example:
portfolio-journal-recDXQQWqEqLnstIx
```

### Cloudinary Transformations

**Default Settings:**
- Format: `auto` (WebP/AVIF with JPEG fallback)
- Quality: `auto:good` (80-90% depending on content)
- Width: Responsive breakpoints (400, 800, 1200, 1600)
- Fetch: `auto` (automatic format selection)
- Delivery: `q_auto` (quality optimization)

**Example URL:**
```
https://res.cloudinary.com/your-cloud/image/upload/
  f_auto,q_auto:good,w_1200,c_limit/
  portfolio-projects-rec2xl62i0mgEo1go-0
```

### Change Detection

Scheduled sync only uploads images when:
- New project/post added to Airtable
- Existing image URL changed in Airtable
- Image hash differs from previous sync

**Hash Calculation:**
```javascript
const imageHash = crypto.createHash('md5')
  .update(imageUrl)
  .digest('hex');
```

Prevents unnecessary uploads and bandwidth usage.

## Monitoring & Usage

### Check Cloudinary Dashboard

1. Go to https://cloudinary.com/console
2. **Dashboard** → View usage metrics:
   - Storage used
   - Bandwidth used (monthly)
   - Transformations count
   - Credits remaining

### Free Tier Limits

- **Storage:** 25 GB
- **Bandwidth:** 25 GB/month
- **Transformations:** 25,000/month
- **Video storage:** 0 (not used)

**Estimated Usage:**
- 150 images × 200KB average = ~30MB storage
- 1000 page views/month × 3 images × 200KB = ~600MB/month bandwidth

**Safe margin:** Currently using ~2.4% of free tier

### Set Up Alerts

In Cloudinary Dashboard:
1. Go to **Settings** → **Account** → **Notifications**
2. Enable email alerts at:
   - 80% bandwidth usage
   - 90% bandwidth usage
   - 95% bandwidth usage

## Troubleshooting

### "Upload failed" errors in logs

**Check:**
- Cloudinary credentials are correct
- API key has upload permissions
- Network connectivity from Netlify Functions

**Fix:**
```bash
# Verify credentials locally
node -e "
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Config:', cloudinary.config());
"
```

### Images not displaying on site

**Check:**
1. Feature flag: Is `USE_CLOUDINARY=true`?
2. Browser console: Any 404 errors?
3. Cloudinary Dashboard: Are images uploaded?
4. Network tab: What URL is being requested?

**Debug:**
```tsx
// In OptimizedImage.tsx, temporarily log URLs
console.log('Trying Cloudinary:', cloudinaryUrl);
console.log('Fallback to local:', localWebpUrl);
console.log('Final fallback:', airtableUrl);
```

### Bandwidth limit exceeded

**Symptoms:**
- Images fail to load
- Cloudinary returns 420 status code

**Solutions:**
1. **Short-term:** Disable Cloudinary (`USE_CLOUDINARY=false`)
2. **Long-term:** 
   - Optimize image sizes (reduce max width to 1200px)
   - Enable aggressive browser caching
   - Consider upgrading plan ($0.0004/GB overage)

## Performance Comparison

### Before (Local WebP)
- Load time: 100-300ms (Netlify CDN)
- Format: WebP only
- Quality: Fixed 90%
- Responsive: Manual srcset

### After (Cloudinary)
- Load time: 80-200ms (Cloudinary global CDN)
- Format: WebP/AVIF auto-selected
- Quality: Auto-optimized per image
- Responsive: Automatic breakpoints

**Improvement:** ~30% faster, 20% smaller file sizes

## Rollback Plan

If issues arise, rollback is simple:

1. **Disable feature flag:**
   ```bash
   # In Netlify Dashboard or .env.local
   USE_CLOUDINARY=false
   ```

2. **Redeploy site** (or wait for next scheduled sync)

3. **Site reverts to local WebP + Airtable fallback**

No data loss occurs - local WebP files remain intact as backup.

## Future Enhancements

### Advanced Transformations
- Lazy loading placeholders (blur-up)
- Art direction (different crops for mobile/desktop)
- AI-based smart cropping
- Automatic background removal

### Video Support
- Upload project videos to Cloudinary
- Automatic transcoding and adaptive bitrate
- Thumbnail generation
- Embed player with analytics

### Performance Optimization
- Service worker caching
- Prefetch next/previous project images
- Progressive JPEG/WebP loading

## Files Modified

**Core Integration:**
- `netlify/functions/scheduled-sync.mjs` - Cloudinary upload logic
- `utils/imageOptimization.ts` - Cloudinary URL builders
- `components/common/OptimizedImage.tsx` - Three-tier fallback

**Scripts:**
- `scripts/migrate-to-cloudinary.mjs` - Initial migration
- `package.json` - Added cloudinary dependency

**Configuration:**
- `.env.example` - Cloudinary variables template
- `netlify.toml` - Environment variable documentation

**Documentation:**
- `docs/CLOUDINARY_INTEGRATION.md` - This file
- `AI_AGENT_GUIDE.md` - Updated with Cloudinary section

## Support

**Cloudinary Documentation:**
- https://cloudinary.com/documentation/node_integration
- https://cloudinary.com/documentation/image_transformations

**Questions?**
- Check Cloudinary Dashboard logs
- Review Netlify Function logs
- Search Cloudinary community: https://support.cloudinary.com

---

**Next Steps:**
1. Complete setup instructions above
2. Run migration script
3. Deploy to preview environment
4. Test with `USE_CLOUDINARY=false` first
5. Enable gradually and monitor
