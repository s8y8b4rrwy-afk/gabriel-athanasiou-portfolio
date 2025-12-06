# Config Images Cloudinary Migration

**Date:** December 1, 2025  
**Status:** ✅ Complete

## Summary

Successfully migrated Settings/Config images from temporary Airtable URLs to permanent Cloudinary URLs.

## Images Uploaded

1. **Profile/About Image**
   - Public ID: `portfolio-config-aboutImage`
   - URL: `https://res.cloudinary.com/date24ay6/image/upload/v1764603235/portfolio-config-aboutImage.jpg`
   - Size: 4077.03 KB
   - Format: JPG

2. **Default OG Image**
   - Public ID: `portfolio-config-defaultOgImage`
   - URL: `https://res.cloudinary.com/date24ay6/image/upload/v1764603236/portfolio-config-defaultOgImage.jpg`
   - Size: 199.78 KB
   - Format: JPG

## What Changed

### New Script: `scripts/upload-config-images.mjs`

Created a dedicated script to upload Settings table images to Cloudinary:
- Fetches Settings record from Airtable
- Uploads About Image, Default OG Image, and Showreel Placeholder (if present)
- Updates `cloudinary-mapping.json` with permanent URLs
- Provides detailed upload summary

**Usage:**
```bash
npm run upload:config-images
```

### Updated Files

1. **`scripts/lib/sync-core.mjs`**
   - Fixed `processConfigRecords()` to properly read Cloudinary config images
   - Converts config images array to lookup map by type
   - Uses Cloudinary URLs with fallback to Airtable URLs

2. **`package.json`**
   - Added `upload:config-images` script

3. **`public/cloudinary-mapping.json`**
   - Added new `config` section:
   ```json
   {
     "config": {
       "recordId": "recIDUlHJGDSZYo2N",
       "images": [
         {
           "type": "profile",
           "publicId": "portfolio-config-aboutImage",
           "cloudinaryUrl": "https://res.cloudinary.com/...",
           "airtableId": "attcysI6UpbklG5Uj"
         },
         {
           "type": "defaultOg",
           "publicId": "portfolio-config-defaultOgImage",
           "cloudinaryUrl": "https://res.cloudinary.com/...",
           "airtableId": "attGrfDpBF8strlhg"
         }
       ]
     }
   }
   ```

4. **`public/portfolio-data.json`**
   - Config images now use permanent Cloudinary URLs
   - Uploaded to Cloudinary CDN (550.25 KB)

## Verification

✅ Config images uploaded to Cloudinary  
✅ `cloudinary-mapping.json` updated with config section  
✅ `processConfigRecords()` correctly uses Cloudinary URLs  
✅ `portfolio-data.json` regenerated with permanent URLs  
✅ Live CDN data verified with permanent URLs

## Benefits

1. **Permanent URLs** - No more Airtable URL expiration
2. **CDN Performance** - Faster image delivery via Cloudinary CDN
3. **Consistent Architecture** - All images now use Cloudinary
4. **Future-proof** - Images persist independently of Airtable

## Image Type Mapping

The config images use a type-based system in `cloudinary-mapping.json`:

- `profile` → About/Profile Image (`config.about.profileImage`)
- `defaultOg` → Default OG Image (`config.defaultOgImage`)
- `showreel` → Showreel Placeholder (`config.showreel.placeholderImage`)

## Next Steps (Future)

If you add new Settings images:
1. Run `npm run upload:config-images` to upload them
2. Run `FORCE_FULL_SYNC=true npm run build:data` to regenerate data
3. Run `npm run sync:static` to upload to CDN
4. Deploy to production

## Commands Used

```bash
# 1. Upload config images to Cloudinary
npm run upload:config-images

# 2. Regenerate portfolio data with Cloudinary URLs
FORCE_FULL_SYNC=true npm run build:data

# 3. Upload updated data to Cloudinary CDN
npm run sync:static

# 4. Verify live CDN data
curl https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data.json | jq '.config'
```
