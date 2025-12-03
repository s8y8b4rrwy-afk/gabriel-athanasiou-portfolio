# Shared Sync Logic

This directory contains shared helper functions and core sync logic used by both:
- **GitHub Actions** (`.github/workflows/sync-data.yml`)
- **Netlify Functions** (`netlify/functions/sync-now.mjs`)
- **Local development** (`npm run build:data`)

## Files

### `sync-core.mjs`
Main orchestration logic for syncing data from Airtable. Contains:
- `syncAllData()` - Main entry point that coordinates the entire sync process
- `buildProjects()` - Fetches and processes project data
- `buildJournal()` - Fetches and processes journal posts
- `buildAbout()` - Fetches and processes about page data

### `airtable-helpers.mjs`
Utility functions for Airtable data fetching and processing:
- `fetchAirtableTable()` - Fetch records with pagination
- `buildLookupMaps()` - Create ID-to-name mappings for relational data
- `parseExternalLinks()` - Parse and categorize external links
- `makeSlug()` - Generate URL-friendly slugs
- Helper functions for normalization and validation

## Usage

### GitHub Actions
```yaml
- name: Sync from Airtable
  run: npm run build:data
```

### Netlify Function
```bash
# Trigger via webhook
curl -X POST https://directedbygabriel.netlify.app/.netlify/functions/sync-now \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN"
```

### Local Development
```bash
npm run build:data
```

## Architecture Benefits

1. **Single Source of Truth** - All sync logic is centralized in `sync-core.mjs`
2. **Consistency** - GitHub Actions and Netlify functions use identical logic
3. **Easier Maintenance** - Update one place, both implementations benefit
4. **Better Testing** - Can test core logic independently
5. **Reduced Code** - Eliminated ~1300 lines of duplicate code

## Environment Variables

Required:
- `AIRTABLE_TOKEN` or `VITE_AIRTABLE_TOKEN`
- `AIRTABLE_BASE_ID` or `VITE_AIRTABLE_BASE_ID`

Optional (for Netlify function):
- `SYNC_TOKEN` - Bearer token for webhook authentication
