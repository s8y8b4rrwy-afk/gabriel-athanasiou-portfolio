# Netlify Sync Function

## Overview

The `sync-now` Netlify Function allows you to trigger a data sync from Airtable via an HTTP endpoint. This is useful for testing connectivity and validating what data would be synced.

## Important Limitations

### Serverless Environment Constraints

Netlify Functions run in a **read-only serverless environment**. This means:

- ❌ Cannot create directories (e.g., `mkdir 'public'`)
- ❌ Cannot write files to the repository (e.g., `portfolio-data.json`)
- ✅ Can only write to `/tmp` (ephemeral, cleared between invocations)
- ✅ Can fetch data from Airtable
- ✅ Can upload images to Cloudinary
- ✅ Can return sync results in the HTTP response

### What This Means for You

The Netlify Function **cannot permanently update** your `public/portfolio-data.json` or `public/cloudinary-mapping.json` files. For persistent data sync that commits changes to your repository, use:

1. **GitHub Actions** (Recommended for production)
   - Workflow: `.github/workflows/sync-data.yml`
   - Triggered manually or on schedule
   - Commits changes to repository

2. **Local Development**
   ```bash
   npm run build:data
   ```

## Usage

### Endpoint

```
GET /.netlify/functions/sync-now
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `force` | boolean | Force a full sync, bypassing incremental checks |

### Authentication

If `SYNC_TOKEN` environment variable is set, you must provide it:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://yoursite.netlify.app/.netlify/functions/sync-now
```

### Examples

```bash
# Basic sync check
curl https://yoursite.netlify.app/.netlify/functions/sync-now

# Force full sync
curl https://yoursite.netlify.app/.netlify/functions/sync-now?force=true
```

### Response

```json
{
  "success": true,
  "message": "Sync completed successfully",
  "stats": {
    "projects": 15,
    "journal": 8,
    "timestamp": "2025-12-01T17:09:51.000Z"
  },
  "syncStats": {
    "mode": "full",
    "apiCalls": 12,
    "apiCallsSaved": 0,
    "newRecords": 0,
    "changedRecords": 0
  }
}
```

## Technical Details

### How It Works

1. The function receives an HTTP request
2. Fetches data from Airtable using the shared `sync-core.mjs` module
3. Processes projects, journal posts, and config
4. Uploads any new images to Cloudinary
5. Returns results in the response (but **does not** write files)

### The `skipFileWrites` Option

The sync-core module now supports a `skipFileWrites` option:

```javascript
await syncAllData({
  airtableToken,
  airtableBaseId,
  outputDir: '/tmp/sync-output',
  verbose: true,
  forceFullSync: false,
  skipFileWrites: true  // Skips fs.writeFileSync calls
});
```

When `skipFileWrites: true`:
- No files are written to disk
- Cloudinary mapping is not saved locally
- Portfolio data is not saved locally
- All data is returned in the results object

This allows the function to complete successfully in serverless environments.

## Error: "ENOENT: no such file or directory, mkdir 'public'"

If you see this error, it means the function tried to write files without `skipFileWrites: true`. This was fixed in the December 2025 update.

### Before the Fix

```
❌ Sync failed: ENOENT: no such file or directory, mkdir 'public'
❌ Failed to save Cloudinary mapping: ENOENT: no such file or directory
```

### After the Fix

```
⏭️ Skipped saving Cloudinary mapping (serverless mode)
⏭️ Skipped writing /tmp/sync-output/portfolio-data.json (serverless mode)
✅ Sync completed successfully
```

## When to Use This Function

| Use Case | Recommended Method |
|----------|-------------------|
| Test Airtable connectivity | ✅ Netlify Function |
| Preview sync results | ✅ Netlify Function |
| Webhook from Airtable automation | ⚠️ Limited (can't persist) |
| Update production data | ❌ Use GitHub Actions |
| Update local dev data | ❌ Use `npm run build:data` |

## Related Files

- `netlify/functions/sync-now.mjs` - The Netlify Function
- `scripts/lib/sync-core.mjs` - Shared sync logic
- `scripts/sync-data.mjs` - CLI script for local/CI sync
- `.github/workflows/sync-data.yml` - GitHub Actions workflow

## See Also

- [Data Sync Guide](./DATA_SYNC_GUIDE.md)
- [Incremental Sync Quick Reference](./INCREMENTAL_SYNC_QUICK_REF.md)
