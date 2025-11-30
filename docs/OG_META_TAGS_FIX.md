# OG Meta Tags Fix - Social Sharing

## Problem
Open Graph (OG) meta tags were not working correctly when sharing links on Facebook, iMessage, Twitter, and other social platforms. The edge function wasn't running, causing all pages to show generic fallback images instead of project-specific or configured images.

## Root Causes Identified

1. **Edge Function Not Running**: Netlify processes redirects BEFORE standalone edge functions, so the SPA fallback was catching all requests before the edge function could inject meta tags.

2. **Field Name Mismatches**: The edge function was checking for `coverImage` but journal posts use `imageUrl` in the data structure.

3. **Missing Config Sync**: The `sync-core.mjs` wasn't fetching the Settings table, so `defaultOgImage` wasn't included in `portfolio-data.json`.

4. **Index Pages Not Covered**: The edge function only processed individual project/post pages, not index pages like `/work`, `/about`, `/journal`.

## Solutions Implemented

### 1. Fixed Edge Function Configuration (`netlify.toml`)

**Before**: Used `[[edge_functions]]` syntax, which runs after redirects
```toml
[[edge_functions]]
path = "/work/*"
function = "meta-rewrite"
```

**After**: Use `[[redirects]]` with edge_functions block, which runs during redirect processing
```toml
[[redirects]]
from = "/work/*"
to = "/index.html"
status = 200
force = true
[redirects.edge_functions]
"meta-rewrite" = {}
```

Added redirects for all routes: `/`, `/work`, `/work/*`, `/about`, `/journal`, `/journal/*`

### 2. Enhanced Edge Function (`netlify/edge-functions/meta-rewrite.ts`)

**Changes**:
- Expanded to process all main routes (not just `/work/*` and `/journal/*`)
- Added page-specific meta tags for index pages
- Fixed field mapping: `item.imageUrl` for journal posts (not `coverImage`)
- Added Cloudinary CDN fallback when local `portfolio-data.json` fails
- Added debug logging for troubleshooting

**Meta Tag Logic**:
```typescript
Projects:      item.heroImage || item.gallery[0] || defaultOgImage
Journal Posts: item.imageUrl || defaultOgImage
Index Pages:   defaultOgImage or page-specific image
```

### 3. Added Config Fetching (`scripts/lib/sync-core.mjs`)

**Changes**:
- Added `buildConfig()` function to fetch Settings table from Airtable
- Retrieves `Default OG Image` field and includes it in `portfolio-data.json`
- Fixed output structure: uses `posts` instead of `journal` for consistency with frontend

**Output Structure**:
```json
{
  "projects": [...],
  "posts": [...],
  "about": {...},
  "config": {
    "defaultOgImage": "https://..."
  }
}
```

## Page Coverage

All pages now have proper OG meta tags:

| Route | Meta Tags | Image Priority |
|-------|-----------|----------------|
| `/` | Home page generic | defaultOgImage |
| `/work` | Filmography index | defaultOgImage |
| `/work/[slug]` | Project-specific | heroImage → gallery[0] → defaultOgImage |
| `/about` | About page with bio | profileImage → defaultOgImage |
| `/journal` | Journal index | defaultOgImage |
| `/journal/[slug]` | Post-specific | imageUrl → defaultOgImage |

## Testing After Deploy

### 1. Verify Edge Function is Running
```bash
curl -I https://directedbygabriel.com/work/the-newspaper-2025 | grep x-edge-meta-injected
# Should return: x-edge-meta-injected: true
```

### 2. Check OG Image Tags
```bash
curl -s https://directedbygabriel.com/work/the-newspaper-2025 | grep "og:image"
# Should show project's actual image, not Unsplash fallback
```

### 3. Test Social Sharing

**Facebook Sharing Debugger**:
- Visit: https://developers.facebook.com/tools/debug/
- Enter URL: https://directedbygabriel.com/work/[project-slug]
- Click "Scrape Again" to clear cache
- Verify correct image and description appear

**Twitter Card Validator**:
- Visit: https://cards-dev.twitter.com/validator
- Enter URL and validate card preview

**LinkedIn Post Inspector**:
- Visit: https://www.linkedin.com/post-inspector/
- Enter URL and inspect preview

### 4. Check Netlify Function Logs

Navigate to Netlify Dashboard → Functions → View logs

Look for:
```
[meta-rewrite] Processing: /work/...
[meta-rewrite] Found project: [Title] (slug: ...)
```

## Fallback Hierarchy

1. **Content-Specific Image**: Project's heroImage or post's imageUrl
2. **Gallery Fallback**: First image from project gallery
3. **Configured Default**: `defaultOgImage` from Airtable Settings table
4. **Ultimate Fallback**: Hardcoded Unsplash image (only if all else fails)

## Configuration

To change the default OG image:
1. Open Airtable → Settings table
2. Update the "Default OG Image" field
3. Run data sync (automatic daily, or manual via `npm run build:data`)
4. Redeploy to Netlify

## Files Modified

- `netlify.toml` - Edge function redirect configuration
- `netlify/edge-functions/meta-rewrite.ts` - Meta tag injection logic
- `scripts/lib/sync-core.mjs` - Config fetching and data structure

## Related Documentation

- [SEO Guide](./SEO_GUIDE.md)
- [Data Sync Guide](./DATA_SYNC_GUIDE.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
