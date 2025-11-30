# Airtable Rate Limit Reset - Complete Sync Guide

## What to Do When Airtable API Credits Refresh

When Airtable rate limits reset (typically hourly), follow these steps to ensure all static data is up-to-date with the latest changes and correct data structures.

## Quick Start

### Option A: Run Full Build (Recommended - Includes Everything)
```bash
npm run build:full
```

This runs all steps in sequence:
- `build:content` - Generate social metadata
- `build:data` - Sync from Airtable (uses existing Cloudinary images via `cloudinary-mapping.json`)
- `build:sitemap` - Generate sitemap
- `sync:static` - Upload JSON/XML to Cloudinary
- `build` - Build the Vite app

**Best for**: Complete data refresh with everything updated

### Option B: Run Individual Steps (When You Only Need Specific Updates)
If you need more control, run each step separately:

```bash
# 1. Sync data from Airtable (uses existing Cloudinary images)
npm run build:data

# 2. Generate social metadata
npm run build:content

# 3. Generate sitemap
npm run build:sitemap

# 4. Upload to Cloudinary
npm run sync:static
```

**Best for**: Debugging specific steps or when you only need to update certain files

### Option C: Trigger GitHub Action
For automated deployment:

1. Go to repository → Actions tab
2. Select "Sync Data from Airtable" workflow
3. Click "Run workflow" button
4. The action will sync and deploy automatically

**Best for**: Scheduled syncs or when you don't have local environment set up

## How Image Reuse Works

The sync process is smart about images:

1. **Cloudinary Mapping File**: `public/cloudinary-mapping.json` stores the mapping between Airtable record IDs and Cloudinary URLs
2. **During Sync**: If this file exists, the sync process uses these existing Cloudinary URLs instead of the Airtable URLs
3. **No Re-uploads**: Images already on Cloudinary are never re-uploaded, saving time and bandwidth
4. **New Images**: Only newly added images (not in the mapping) would need to be uploaded separately

This means:
- ✅ Data refresh is fast (no image processing)
- ✅ Bandwidth is conserved
- ✅ Existing image URLs remain stable
- ✅ CDN cache stays warm

## What Gets Synced

### 1. **Projects Data**
- All visible projects (Display Status ≠ "Hidden")
- Project metadata (title, description, dates, category)
- **Owner credits** (your name + allowed roles prepended to credits list)
- Additional credits from Credits field
- Gallery images (with Cloudinary URLs)
- Video URLs and thumbnails
- External links
- Awards/festivals
- Production companies

### 2. **Journal Posts**
- All published posts (Status = "Published")
- Content, excerpts, cover images
- Reading time calculations
- Publish dates

### 3. **Settings/Config**
- Portfolio owner name
- Allowed roles (used for owner credits)
- Contact information
- Showreel settings
- About page data
- Default OG image

### 4. **Static Assets**
- Sitemap.xml
- Share metadata for social cards
- Cloudinary URL mappings

## Verification Steps

### 1. Check Sync Succeeded
Look for these success messages in the terminal:
```
✅ Built lookup maps
✅ Synced config/settings data
✅ Synced X projects
✅ Synced X journal posts
✅ Wrote public/portfolio-data.json
```

### 2. Verify Owner Credits
```bash
# Check that owner credits appear first in projects
curl -s "https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data.json" | \
  jq '.projects[0] | {title, role, credits: .credits[0:3]}'
```

## Recent Fixes Applied

### Owner Credits Fix (Nov 30, 2025)
**Issue**: Your name with allowed roles wasn't appearing as first credit(s) in project pages.

**Solution**: Modified `scripts/lib/sync-core.mjs` to:
1. Fetch Settings FIRST (before projects) so owner info is available
2. Automatically prepend your name with matching roles to each project's credits
3. Properly handle both string and array types from Airtable's Role field

**How it works**:
- Reads `portfolioOwnerName` and `allowedRoles` from Settings table
- For each project, checks the `Role` field in Airtable
- Filters project roles against your allowed roles (e.g., "Director")
- Creates credit entries with your name for matching roles
- Prepends these owner credits before other credits from the Credits field

**Expected behavior**:
- Projects with matching roles: Your name appears first with those roles
- Projects with multiple matching roles: Your name appears multiple times (once per role)
- Projects without matching roles: No owner credit added
- Projects with no Role field: No owner credit added

## Common Issues & Troubleshooting
```

### 3. Verify Data Structure
```bash
# Check overall data structure
curl -s "https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data.json" | \
  jq '{
    projectCount: .projects | length,
    postCount: .posts | length,
    hasConfig: (.config != null),
    ownerName: .config.portfolioOwnerName,
    allowedRoles: .config.allowedRoles,
    generatedAt: .generatedAt
  }'
```

### 4. Test Live Site
Visit your portfolio and check:
- Project pages load correctly
- Your name appears as first credit(s) on project detail pages
- All images display properly
- Journal posts are visible
- Contact information is up-to-date
  ]
}
```

### 3. Deploy to Production
If running locally, the sync script will also upload to Cloudinary automatically.

Alternatively, trigger the GitHub Action to sync and deploy:
- Go to GitHub Actions
- Run the "Sync Data from Airtable" workflow manually

### 4. Verify on Live Site
Once deployed, check a few project detail pages to confirm your name appears as the first credit(s).

## How It Works

- Reads `portfolioOwnerName` and `allowedRoles` from Settings table
- For each project, checks the `Role` field in Airtable
- Filters project roles against your allowed roles (e.g., "Director")
- Creates credit entries with your name for matching roles
- Prepends these owner credits before other credits from the Credits field

## Expected Behavior
### Rate Limit Hit During Sync
**Symptom**: Sync fails with "Rate limit exceeded" message
**Solution**: 
- Wait for rate limits to reset (typically hourly)
- The script preserves existing data when rate limited
- Re-run sync after limits reset

### Owner Credits Not Appearing
**Check**:
1. Settings table has `Allowed Roles` field populated (e.g., "Director")
2. Projects have the `Role` field filled in Airtable
3. Role values match exactly with allowed roles (case-sensitive)
4. Verbose logs show "Added X owner credit(s)" messages
5. `config.allowedRoles` exists in portfolio-data.json

### Images Not Loading
**Check**:
1. Cloudinary upload completed successfully
2. `public/cloudinary-mapping.json` exists and has correct URLs
3. Gallery images in Airtable have valid attachments
4. Check browser console for 404 errors

### Missing Projects or Posts
**Check**:
1. Projects: Verify `Display Status` field is set (not "Hidden")
2. Journal: Verify `Status` field is set to "Published"
3. Check Airtable for recent changes
4. Verify sync completed without errors

### Data Structure Issues
**Check**:
1. Run sync with verbose logging: `npm run build:data`
2. Compare output structure with expected format
3. Check for parsing errors in credits, links, or dates
4. Verify Airtable field names match expected values

## Manual Recovery

If automatic sync fails, you can manually verify/fix:

```bash
# 1. Check current deployed data
curl -s "https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data.json" | jq '.generatedAt'

# 2. Generate data locally without uploading
npm run build:data

# 3. Manually upload to Cloudinary (if needed)
npm run upload:cloudinary

# 4. Force regenerate sitemap
npm run generate:sitemap
```

## Best Practices

1. **Before making Airtable changes**: Note the current `generatedAt` timestamp
2. **After sync**: Always verify owner credits and data structure
3. **Keep backups**: Cloudinary maintains version history
4. **Monitor logs**: Check GitHub Actions logs for sync issues
5. **Test locally first**: Run `npm run build:data` locally before relying on automated syncs

## Related Files

- `scripts/lib/sync-core.mjs` - Main sync logic
- `scripts/lib/airtable-helpers.mjs` - Airtable API utilities
- `scripts/sync-data.mjs` - CLI entry point
- `utils/textHelpers.mjs` - Credit parsing logic
- `.github/workflows/sync-data.yml` - Automated sync workflowure projects have the Role field filled in Airtable
3. **Check verbose logs** - Look for "Added X owner credit(s)" messages during sync
4. **Verify data structure** - Make sure `config.allowedRoles` exists in portfolio-data.json

## Rollback

If issues occur, the old data is preserved on Cloudinary. You can:
1. Revert `scripts/lib/sync-core.mjs` to previous version
2. Re-run sync to restore old behavior
