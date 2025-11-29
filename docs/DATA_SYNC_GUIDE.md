# Data Sync Guide

> **Status:** ✅ Manual Sync Only  
> **Last Updated:** November 2025

## Overview

This portfolio uses Airtable as a headless CMS for content management. Data syncing from Airtable to the portfolio is handled through **manual triggers only** to conserve Airtable API credits.

### Why Manual Sync?

Automatic scheduled syncing was disabled to:
- **Conserve API credits**: Airtable has API rate limits and credit quotas
- **Give developers control**: Only sync when content actually changes
- **Avoid unnecessary builds**: Prevent Netlify build minutes waste

## How to Sync Data

### Method 1: GitHub Actions (Recommended)

1. Go to the repository's **Actions** tab on GitHub
2. Select **"Manual Data Sync (Airtable + Deploy)"** workflow
3. Click **"Run workflow"** dropdown button
4. Optionally enter a reason for the sync
5. Click **"Run workflow"** to start

This workflow will:
- Fetch latest data from Airtable
- Generate updated `share-meta.json` and `portfolio-data.json`
- Upload static files to Cloudinary
- Trigger a Netlify deployment
- Warm CDN cache

### Method 2: Sync Static Files Only

For syncing only static files to Cloudinary (without full Airtable data sync):

1. Go to **Actions** tab
2. Select **"Sync Static Files to Cloudinary"** workflow
3. Click **"Run workflow"**
4. Optionally check "Force upload all files" to ignore change detection

### Method 3: Local Sync (Development)

```bash
# Sync all data from Airtable
npm run build:data

# Sync static files to Cloudinary
npm run sync:static

# Force sync static files (ignore change detection)
npm run sync:static:force
```

## Managing Airtable API Credits

### Best Practices

1. **Sync only when needed**: Only run the sync workflow after making changes in Airtable
2. **Batch changes**: Make multiple content changes in Airtable before syncing
3. **Monitor usage**: Check your Airtable account for API credit usage
4. **Use caching**: The sync scripts cache data locally as fallback

### API Credit Limits

- Airtable has rate limits per account/base
- Rate limits typically reset at the start of each month
- The sync scripts handle rate limiting gracefully with cached fallbacks

### Fallback Behavior

If Airtable API rate limits are exceeded:
- Sync scripts will use cached `portfolio-data.json` as fallback
- A warning will be logged
- The site will continue working with stale data

## Available Workflows

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| **Manual Data Sync** | Full Airtable sync + deploy | Manual only |
| **Sync Static Files to Cloudinary** | Sync static files to CDN | Manual or on push |
| **Manual Deploy to Netlify** | Deploy without data sync | Manual only |

## Workflow Files

- `.github/workflows/scheduled-deploy.yml` - Main data sync workflow (manual only)
- `.github/workflows/sync-static-files.yml` - Cloudinary static file sync
- `.github/workflows/manual-deploy.yml` - Emergency manual deploy

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `sync-data.mjs` | `npm run build:data` | Fetch Airtable data, generate portfolio-data.json |
| `generate-share-meta.mjs` | `npm run build:content` | Generate share-meta.json for social previews |
| `sync-static-to-cloudinary.mjs` | `npm run sync:static` | Upload static files to Cloudinary CDN |

## Environment Variables Required

For local development or CI/CD:

```bash
# Airtable (required for data sync)
AIRTABLE_TOKEN=your_token       # or VITE_AIRTABLE_TOKEN
AIRTABLE_BASE_ID=your_base_id   # or VITE_AIRTABLE_BASE_ID

# Cloudinary (required for static file sync)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Netlify (required for deployment)
NETLIFY_AUTH_TOKEN=your_auth_token
NETLIFY_SITE_ID=your_site_id
```

## Troubleshooting

### "Rate limit exceeded" Error

- Wait until rate limit resets (usually start of next month)
- The site will continue working with cached data
- Check Airtable dashboard for usage stats

### Sync Not Detecting Changes

- Use force sync: `npm run sync:static:force`
- Delete `public/static-files.hash` to reset change detection
- Check if files actually changed in Airtable

### Cloudinary Upload Failed

- Verify Cloudinary credentials in GitHub Secrets
- Check Cloudinary dashboard for API errors
- Ensure file sizes are within limits

---

**See Also:**
- [STATIC_FILES_HOSTING.md](./STATIC_FILES_HOSTING.md) - Cloudinary hosting details
- [CLOUDINARY_INTEGRATION.md](./CLOUDINARY_INTEGRATION.md) - Image optimization
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment configuration
