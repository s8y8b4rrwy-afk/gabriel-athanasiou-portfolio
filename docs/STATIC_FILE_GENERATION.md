# Static File Generation Workflow

This document describes the independent static file generation workflow that is decoupled from the deployment pipeline.

## Overview

The static file generation workflow (`generate-static-files.yml`) is responsible for generating and version-controlling the following files:

| File | Description |
|------|-------------|
| `public/portfolio-data.json` | Complete portfolio data fetched from Airtable |
| `public/share-meta.json` | Social media sharing metadata for projects and posts |
| `public/share-meta.hash` | Hash file for change detection |
| `public/sitemap.xml` | XML sitemap for search engines |

## Architecture

### Separation of Concerns

The static file generation is now **completely independent** from deployment:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Static File Generation                        │
│  (generate-static-files.yml)                                     │
│                                                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ sync-data.mjs   │    │ generate-       │    │ Commit to    │ │
│  │                 │───►│ sitemap.mjs     │───►│ Repository   │ │
│  │ - portfolio-    │    │                 │    │              │ │
│  │   data.json     │    │ - sitemap.xml   │    │              │ │
│  │ - share-meta    │    │                 │    │              │ │
│  │   .json         │    │                 │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Version Controlled Files
                    in public/ directory
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Deployment                               │
│  (scheduled-deploy.yml / Netlify auto-deploy)                   │
│                                                                   │
│  Uses pre-generated static files from repository                 │
│  ───────────────────────────────────────────────────────────►   │
│  No Airtable API calls during deployment                        │
└─────────────────────────────────────────────────────────────────┘
```

### Benefits

- ✅ **Decoupled processes** - Static file generation and deployment are independent
- ✅ **Version controlled** - All static files are tracked in git for auditing
- ✅ **Faster deployments** - No API calls during build time
- ✅ **Predictable behavior** - Static files are generated ahead of time
- ✅ **Manual control** - Trigger regeneration on-demand when needed

## Triggers

The workflow can be triggered in three ways:

### 1. Manual Trigger (Recommended)

Run the workflow manually from the GitHub Actions tab:

1. Go to **Actions** → **Generate Static Files**
2. Click **Run workflow**
3. (Optional) Provide a reason for regeneration
4. (Optional) Choose which files to generate
5. Click **Run workflow**

### 2. Scheduled Trigger

The workflow runs automatically **daily at 2 AM UTC** to check for content changes in Airtable.

### 3. API Trigger (Advanced)

Trigger via GitHub API:

```bash
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/generate-static-files.yml/dispatches \
  -d '{"ref":"main","inputs":{"reason":"API trigger"}}'
```

## Required Secrets

The workflow requires the following repository secrets:

| Secret | Description |
|--------|-------------|
| `AIRTABLE_API_KEY` | Airtable Personal Access Token |
| `AIRTABLE_BASE_ID` | Airtable Base ID containing content tables |

### Setting Up Secrets

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each required secret

## NPM Scripts

The following npm scripts are available for local development:

```bash
# Generate all static files (data + sitemap)
npm run generate:static

# Generate only portfolio data and share metadata
npm run build:data

# Generate only sitemap
npm run build:sitemap

# Build for deployment (uses pre-generated files)
npm run build

# Generate static files + build (full build)
npm run build:full
```

## Local Development

### Initial Setup

Before running the dev server for the first time, generate the static files:

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env with your Airtable credentials

# 2. Generate static files
npm run generate:static

# 3. Start dev server
npm run dev
```

### Updating Content Locally

When you need to refresh content from Airtable:

```bash
# Regenerate static files
npm run generate:static

# The dev server will automatically pick up changes
```

## Workflow Details

### File Generation Process

1. **Checkout** - Clone the repository
2. **Install dependencies** - Run `npm ci`
3. **Check credentials** - Verify Airtable secrets are configured
4. **Generate data files** - Run `sync-data.mjs` to create:
   - `public/portfolio-data.json` (complete portfolio data)
   - `public/share-meta.json` (social sharing metadata)
5. **Generate sitemap** - Run `generate-sitemap.mjs` to create:
   - `public/sitemap.xml`
6. **Check for changes** - Compare generated files with existing ones
7. **Commit & push** - If changes detected, commit to repository

### Change Detection

The workflow uses git diff to detect changes. If the generated files are identical to the existing ones, no commit is created. This prevents unnecessary commits when content hasn't changed.

### Commit Messages

Generated commits follow this format:
- Scheduled runs: `chore: update static files (scheduled) [ci skip]`
- Manual runs: `chore: update static files (<reason>) [ci skip]`

The `[ci skip]` marker prevents triggering unnecessary CI workflows on static file updates.

## Troubleshooting

### Missing Static Files

If the deployment workflow shows warnings about missing static files:

1. Run the **Generate Static Files** workflow manually
2. Wait for it to complete
3. Re-run the deployment workflow

### API Rate Limits

If you hit Airtable API rate limits:

1. The script will attempt to use cached data as fallback
2. Wait for the rate limit to reset (typically at the start of each month)
3. Re-run the workflow

### Local Generation Fails

If local generation fails:

1. Verify your `.env` file has correct credentials:
   ```
   AIRTABLE_TOKEN=your_token
   AIRTABLE_BASE_ID=your_base_id
   ```
2. Check that the Airtable base has the required tables (Projects, Journal, Settings)
3. Run with debug output: `DEBUG=* npm run generate:static`

## Related Documentation

- [Static Build Architecture](../STATIC_BUILD_ARCHITECTURE.md) - Overall architecture documentation
- [Scheduled Deploy Setup](.github/SCHEDULED_DEPLOY_SETUP.md) - Deployment workflow documentation
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - General deployment instructions
