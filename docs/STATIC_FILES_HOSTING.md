# Static Files Hosting with Cloudinary

> **Status:** ✅ Implementation Complete  
> **Branch:** `static-files-hosting`  
> **Last Updated:** November 2025

## Overview

This document describes the static files hosting system that separates versioning (GitHub) from hosting (Cloudinary) for better performance and scalability.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Version Control (source of truth)                              │ │
│  │  • public/sitemap.xml                                           │ │
│  │  • public/portfolio-data.json                                   │ │
│  │  • public/share-meta.json                                       │ │
│  │  • public/robots.txt                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ GitHub Actions Workflow
                                   │ (on push to main)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloudinary CDN                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Hosting & Delivery                                             │ │
│  │  • portfolio-static/sitemap.xml                                 │ │
│  │  • portfolio-static/portfolio-data.json                         │ │
│  │  • portfolio-static/share-meta.json                             │ │
│  │  • portfolio-static/robots.txt                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ CDN Edge Delivery
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Portfolio Website                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Dynamic Fetching                                               │ │
│  │  • Fetches static files from Cloudinary                         │ │
│  │  • Falls back to local files if Cloudinary unavailable          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Benefits

1. **Version Control**: All static files are tracked in Git for full history and rollback capability
2. **CDN Delivery**: Cloudinary's global CDN ensures fast delivery worldwide
3. **Automated Sync**: GitHub Actions automatically syncs changes to Cloudinary
4. **Smart Change Detection**: Only changed files are uploaded (efficient bandwidth usage)
5. **Rollback Support**: Revert to any previous version via Git history

## Files Synced

| File | Description | Cloudinary Path |
|------|-------------|-----------------|
| `sitemap.xml` | XML sitemap for SEO | `portfolio-static/sitemap.xml` |
| `portfolio-data.json` | Complete portfolio data | `portfolio-static/portfolio-data.json` |
| `share-meta.json` | Social media meta data | `portfolio-static/share-meta.json` |
| `robots.txt` | Search engine directives | `portfolio-static/robots.txt` |

## Setup Instructions

### 1. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:

| Secret Name | Description |
|-------------|-------------|
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name (e.g., `date24ay6`) |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret |

### 2. Enable the Workflow

The workflow `.github/workflows/sync-static-files.yml` triggers automatically when:

- Static files are modified in the `main` branch
- The sync script is updated
- Manually triggered via GitHub Actions UI

### 3. Verify Setup

1. Make a change to any static file (e.g., `public/sitemap.xml`)
2. Push to `main` branch
3. Check the **Actions** tab for workflow execution
4. Verify the file appears in Cloudinary console

## Usage

### Manual Sync

Run locally to sync files to Cloudinary:

```bash
# Sync only changed files
npm run sync:static

# Force sync all files
npm run sync:static:force

# Dry run (see what would be uploaded)
node scripts/sync-static-to-cloudinary.mjs --dry-run
```

### Fetching Static Files in Code

Use the utility functions to fetch static files from Cloudinary:

```typescript
import { 
  getStaticFileUrl, 
  fetchPortfolioData,
  STATIC_FILE_IDS 
} from '@/utils/staticFilesCloudinary';

// Get URL for a static file
const sitemapUrl = getStaticFileUrl(STATIC_FILE_IDS.SITEMAP);
// Returns: https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/sitemap.xml

// Fetch and parse portfolio data
const data = await fetchPortfolioData();
console.log(data.projects);

// Get all static file URLs
const urls = getAllStaticFileUrls();
console.log(urls.sitemap);
console.log(urls.portfolioData);
```

### Cloudinary URLs

Static files are accessible at these URLs:

| File | URL |
|------|-----|
| sitemap.xml | `https://res.cloudinary.com/{cloud_name}/raw/upload/portfolio-static/sitemap.xml` |
| portfolio-data.json | `https://res.cloudinary.com/{cloud_name}/raw/upload/portfolio-static/portfolio-data.json` |
| share-meta.json | `https://res.cloudinary.com/{cloud_name}/raw/upload/portfolio-static/share-meta.json` |
| robots.txt | `https://res.cloudinary.com/{cloud_name}/raw/upload/portfolio-static/robots.txt` |

Replace `{cloud_name}` with your actual Cloudinary cloud name (e.g., `date24ay6`).

## Environment Variables

Add these to your `.env.local` or Netlify environment:

```bash
# Required for static file sync
CLOUDINARY_CLOUD_NAME=date24ay6
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Feature flag (optional)
USE_CLOUDINARY_STATIC=false  # Set to 'true' to fetch from Cloudinary

# Custom folder (optional, defaults to 'portfolio-static')
CLOUDINARY_STATIC_FOLDER=portfolio-static
```

## Rollback Procedure

To rollback to a previous version of a static file:

1. **Find the previous version in Git:**
   ```bash
   git log --oneline public/sitemap.xml
   ```

2. **Checkout the previous version:**
   ```bash
   git checkout <commit-hash> -- public/sitemap.xml
   ```

3. **Commit and push:**
   ```bash
   git add public/sitemap.xml
   git commit -m "chore: rollback sitemap.xml to previous version"
   git push origin main
   ```

4. **GitHub Actions will automatically sync** the reverted file to Cloudinary.

## Change Detection

The sync script uses MD5 hashes to detect changes:

1. Each file's content is hashed
2. Hashes are stored in `public/static-files.hash`
3. On next sync, only files with different hashes are uploaded
4. The hash file is committed to track sync state

### Hash File Format

```json
{
  "public/sitemap.xml": "abc123...",
  "public/portfolio-data.json": "def456...",
  "public/share-meta.json": "ghi789...",
  "public/robots.txt": "jkl012..."
}
```

## Troubleshooting

### Files Not Syncing

1. **Check GitHub Secrets**: Ensure all three Cloudinary secrets are configured
2. **Check Workflow Logs**: Review the Actions tab for error messages
3. **Force Sync**: Run `npm run sync:static:force` locally to bypass change detection

### Cloudinary Errors

1. **Authentication Failed**: Verify API key and secret are correct
2. **Rate Limit**: Cloudinary has API rate limits; wait and retry
3. **File Too Large**: Split large files or optimize content

### Local Sync Issues

1. **Missing Dependencies**: Run `npm install`
2. **Environment Variables**: Ensure `.env.local` has Cloudinary credentials
3. **Network Issues**: Check internet connectivity

## Files Created/Modified

| File | Purpose |
|------|---------|
| `scripts/sync-static-to-cloudinary.mjs` | Sync script for uploading files |
| `.github/workflows/sync-static-files.yml` | GitHub Actions workflow |
| `utils/staticFilesCloudinary.ts` | Utility functions for fetching files |
| `.env.example` | Updated with static files configuration |
| `package.json` | Added sync scripts |
| `docs/STATIC_FILES_HOSTING.md` | This documentation file |

## Integration with Existing Systems

### Build Pipeline

The static file sync runs **after** the build scripts generate files:

```bash
# Build pipeline order
npm run build:content      # Generate share-meta.json
npm run build:data         # Generate portfolio-data.json
npm run build:sitemap      # Generate sitemap.xml (if needed)
# Files are now ready to sync

# Sync to Cloudinary (triggered by GitHub Actions on push)
npm run sync:static
```

### Netlify Deployment

Static files are synced to Cloudinary **in parallel** with Netlify deployment:

1. Push to `main` triggers both:
   - Netlify build and deploy
   - GitHub Actions static file sync
2. Both complete independently
3. Site uses Cloudinary URLs for static files (when `USE_CLOUDINARY_STATIC=true`)

## Future Improvements

- [ ] Add cache invalidation on Cloudinary after sync
- [ ] Implement versioned URLs with query parameters
- [ ] Add monitoring for sync failures
- [ ] Create dashboard for sync status
- [ ] Add support for additional static file types

## Support

For issues with static file hosting:

1. Check GitHub Actions logs
2. Review Cloudinary console for upload status
3. Test files locally with `npm run sync:static --dry-run`
4. Verify Cloudinary credentials are correct

---

**See Also:**
- [CLOUDINARY_INTEGRATION.md](./CLOUDINARY_INTEGRATION.md) - Image optimization with Cloudinary
- [README.md](../README.md) - Project overview
