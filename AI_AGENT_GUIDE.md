# 📘 Master Development Guide
## Gabriel Athanasiou Portfolio Website

> **Last Updated:** December 2025  
> **Purpose:** Complete technical documentation for AI agents and developers  
> **This is the single source of truth for the entire codebase**

---

## 🌐 Domains & Portfolio Modes

This codebase powers **two portfolio sites** and an **Instagram scheduling app** from a single repository:

| Portfolio | Domain | Data File | Env Variable |
|-----------|--------|-----------|--------------|
| **Directing** | directedbygabriel.com | `portfolio-data-directing.json` | `PORTFOLIO_MODE=directing` |
| **Post-Production** | lemonpost.studio | `portfolio-data-postproduction.json` | `PORTFOLIO_MODE=postproduction` |
| **Instagram Studio** | studio.lemonpost.studio | N/A (sub-app in `scripts/instagram-studio/`) | — |

### Data File Separation

Each portfolio has its own data file synced from Airtable:
- `public/portfolio-data-directing.json` - Projects with `allowedRoles` containing "directing"
- `public/portfolio-data-postproduction.json` - Projects with `allowedRoles` containing "postproduction"

The `PORTFOLIO_MODE` environment variable controls:
1. Which data file is loaded by the app
2. Which static files are generated (`sitemap-{mode}.xml`, `robots-{mode}.txt`, `share-meta-{mode}.json`)
3. Which domain URLs are used in meta tags and sitemaps

---

## 📚 What This Guide Contains

This comprehensive guide consolidates ALL documentation into one master reference:

- **Project architecture** - Complete system design and data flow
- **Changelog** - All recent changes with detailed explanations
- **Data structures** - Airtable schema, TypeScript interfaces, field mappings
- **Development workflows** - Setup, testing, deployment procedures
- **Custom instructions** - AI agent guidelines and best practices
- **Troubleshooting** - Common issues and solutions
- **API references** - All services, utilities, and components

**Other Documentation Files:**
- `README.md` - Quick start guide for developers
- `.github/copilot-instructions.md` - Quick reference for GitHub Copilot (points here)
- `docs/*` - Supplementary guides (all key content integrated here)

---

## 📝 Changelog

> **All major changes documented in reverse chronological order (newest first)**

### 🎉 Recent Major Changes

### Dec 3 2025 - Multi-Portfolio Static Files Architecture
**What Changed:** Complete rewrite of static file generation to support two portfolio sites (directing & post-production) from a single codebase.

**The Problem:**
- Static files (`sitemap.xml`, `robots.txt`, `share-meta.json`) were hardcoded to directing domain
- Both portfolios would overwrite each other's files on Cloudinary
- Edge function and sitemap function weren't portfolio-aware

**The Solution:**

1. **Portfolio-Suffixed Static Files:**
   - All static files now generated with portfolio suffix: `sitemap-directing.xml`, `sitemap-postproduction.xml`
   - Each portfolio has its own set of files versioned in Git
   - `scripts/prepare-build.mjs` copies portfolio-specific files to standard names at build time

2. **New/Updated Scripts:**
   - `scripts/generate-sitemap.mjs` - Rewritten to read from `portfolio-data-{mode}.json`, uses correct domain from config
   - `scripts/generate-share-meta.mjs` - Rewritten to filter by `allowedRoles` from portfolio config
   - `scripts/generate-robots.mjs` - NEW script for portfolio-specific robots.txt
   - `scripts/prepare-build.mjs` - NEW script to copy portfolio files before vite build
   - `scripts/sync-static-to-cloudinary.mjs` - Updated to use portfolio-specific public IDs

3. **Updated Netlify Functions:**
   - `netlify/edge-functions/meta-rewrite.ts` - Now reads `PORTFOLIO_MODE` env var, fetches correct files
   - `netlify/functions/sitemap.js` - Rewritten to fetch from Cloudinary instead of Airtable

4. **Cloudinary File Structure:**
   ```
   portfolio-static/
   ├── portfolio-data-directing.json
   ├── portfolio-data-postproduction.json
   ├── sitemap-directing.xml
   ├── sitemap-postproduction.xml
   ├── share-meta-directing.json
   ├── share-meta-postproduction.json
   ├── robots-directing.txt
   └── robots-postproduction.txt
   ```

5. **New npm Scripts:**
   ```json
   "build:static": "node scripts/generate-sitemap.mjs && node scripts/generate-share-meta.mjs && node scripts/generate-robots.mjs",
   "build:static:all": "PORTFOLIO_MODE=directing npm run build:static && PORTFOLIO_MODE=postproduction npm run build:static",
   "prepare:build": "node scripts/prepare-build.mjs"
   ```

**Portfolio Domains:**
- Directing: `directedbygabriel.com`
- Post-Production: `lemonpost.studio`

**Environment Variable:** `PORTFOLIO_MODE=directing|postproduction`

**Files Changed:**
- `scripts/generate-sitemap.mjs` - Complete rewrite
- `scripts/generate-share-meta.mjs` - Complete rewrite
- `scripts/generate-robots.mjs` - NEW
- `scripts/prepare-build.mjs` - NEW
- `scripts/sync-static-to-cloudinary.mjs` - Updated for portfolio-specific uploads
- `netlify/edge-functions/meta-rewrite.ts` - Portfolio-aware
- `netlify/functions/sitemap.js` - Cloudinary-first, portfolio-aware
- `package.json` - New scripts
- `.github/workflows/sync-data.yml` - Syncs both portfolios

---

### Dec 1 2024 - OG Meta Tags Fix & Cloudinary-First Architecture
**What Changed:** Fixed OG meta tags for social sharing by updating Edge Function to fetch data directly from Cloudinary instead of trying local files first.

**The Problem:**
- OG meta tags not working for social media sharing
- Edge Function `meta-rewrite.ts` was trying to fetch `portfolio-data.json` from local filesystem first
- Local files don't exist in Netlify Edge Functions environment
- Fallback to Cloudinary was not implemented correctly

**The Solution:**

1. **Updated Edge Function Architecture:**
   - Modified `netlify/edge-functions/meta-rewrite.ts` to fetch directly from Cloudinary
   - Removed local file fetch attempts that were failing
   - Now uses `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data-{mode}.json` as primary source

2. **Updated Documentation:**
   - `docs/STATIC_FILES_HOSTING.md`: Removed references to local fallbacks, clarified Cloudinary-only architecture
   - `AI_AGENT_GUIDE.md`: Updated data sources, request flow, and data flow diagram to reflect direct Cloudinary fetching

**Architecture Impact:**
- ✅ OG meta tags now work properly for social media sharing
- ✅ Consistent Cloudinary-first approach across all server-side functions
- ✅ Client-side code retains local fallbacks for resilience
- ✅ Documentation accurately reflects current architecture

**Files Changed:**
- **Updated:** `netlify/edge-functions/meta-rewrite.ts` - Now fetches directly from Cloudinary URL
- **Updated:** `docs/STATIC_FILES_HOSTING.md` - Removed local fallback references
- **Updated:** `AI_AGENT_GUIDE.md` - Updated data flow and CMS service sections

### Nov 30 2025 - GitHub Actions Cleanup & Shared Sync Core Refactor
**What Changed:** Consolidated duplicate sync logic and simplified GitHub Actions to 2 manual-only workflows.

**The Problem:**
- 3 GitHub Action workflows with overlapping purposes
- `sync-static-files.yml` triggered automatically on file changes
- `sync-data.yml` and Netlify function `airtable-sync.mjs` had 1384 lines of duplicate code
- Maintaining sync logic in multiple places (scripts, Netlify functions, workflows)
- No unified approach to data syncing

**The Solution:**

1. **Created Shared Sync Core** (`scripts/lib/sync-core.mjs`):
   - `syncAllData()` - Main orchestration function
   - `buildProjects()` - Project data processing
   - `buildJournal()` - Journal post processing
   - `buildAbout()` - About page processing
   - Single source of truth used by ALL sync methods

2. **Refactored Scripts to Use Shared Core:**
   - `scripts/sync-data.mjs` (408 lines → 47 lines) - Now a thin wrapper
   - `netlify/functions/sync-now.mjs` - Updated to use sync-core
   - Eliminated ~1300 lines of duplicate code

3. **Simplified GitHub Actions to 2 Manual Workflows:**
   - **`sync-data.yml`** - "Sync Data & Static Files"
     - Fetches from Airtable
     - Generates all static files
     - Uploads to Cloudinary
     - Commits to GitHub
     - Manual trigger only (no automatic runs)
     - Optional force upload parameter
   
   - **`manual-deploy.yml`** - "Deploy to Netlify"
     - Creates deploy marker commit
     - Triggers Netlify build
     - Manual trigger only
     - Separate from data sync
   
   - **Removed:** `sync-static-files.yml` (automatic workflow)

**GitHub Actions Architecture:**
```yaml
# .github/workflows/sync-data.yml
name: Sync Data & Static Files
on: workflow_dispatch  # Manual only
jobs:
  - Fetch from Airtable (npm run build:data, build:content, build:sitemap)
  - Upload to Cloudinary (node scripts/sync-static-to-cloudinary.mjs)
  - Commit changes with [ci skip]
  
# .github/workflows/manual-deploy.yml  
name: Deploy to Netlify
on: workflow_dispatch  # Manual only
jobs:
  - Create [deploy] marker commit
  - Push to trigger Netlify
```

**Netlify Function Architecture:**
```javascript
// netlify/functions/sync-now.mjs
import { syncAllData } from '../../scripts/lib/sync-core.mjs';

export const handler = async (event) => {
  // Optional Bearer token auth
  // Calls shared sync-core logic
  // Returns JSON response
};

// Webhook endpoint: /.netlify/functions/sync-now
// Can be triggered from Airtable automation
```

**Shared Core Benefits:**
- ✅ Single source of truth for all sync logic
- ✅ Consistent behavior across GitHub Actions, Netlify functions, and local scripts
- ✅ ~1300 lines of duplicate code eliminated
- ✅ Bug fixes apply everywhere automatically
- ✅ Easier to maintain and test

**Usage Options:**

**Option 1: GitHub Actions (Manual)**
```
Actions → Sync Data & Static Files → Run workflow
→ Syncs data and uploads to Cloudinary
→ Site updates immediately (no deployment needed)

Actions → Deploy to Netlify → Run workflow  
→ Deploys code changes only (NOT needed for content)
```

**Option 2: Netlify Function (Webhook)**
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN"
```
Perfect for Airtable automations after content updates!

**Option 3: Local Development**
```bash
npm run build:data    # Uses shared sync-core
```

**Files Changed:**
- **Created:** `scripts/lib/sync-core.mjs` (300 lines) - Shared sync orchestration
- **Created:** `scripts/lib/README.md` - Documentation for shared library
- **Updated:** `scripts/sync-data.mjs` (408 → 47 lines) - Now uses sync-core
- **Updated:** `netlify/functions/sync-now.mjs` - Now uses sync-core
- **Updated:** `.github/workflows/sync-data.yml` - Manual only, comprehensive
- **Updated:** `.github/workflows/manual-deploy.yml` - Simplified
- **Removed:** `.github/workflows/sync-static-files.yml` - Automatic workflow deleted
- **Archived:** `netlify/functions/airtable-sync.mjs` → `functions-backup/` (1384 lines)

**Benefits:**
- ✅ Complete manual control - No automatic triggers
- ✅ Webhook support for Airtable automations
- ✅ Massively reduced code duplication
- ✅ Consistent sync behavior everywhere
- ✅ Easier debugging and maintenance
- ✅ Clear separation: content sync vs code deployment
- ✅ No deployment needed for content updates (fetches from Cloudinary at runtime)

---

### Nov 30 2025 - Server-Side SEO Structured Data (Edge Function Enhancement)
**What Changed:** Moved structured data (JSON-LD) generation from client-side to server-side for better SEO.

**The Problem:**
- ❌ `SEO.tsx` component generated structured data client-side using `useEffect`
- ❌ Search engine crawlers received HTML without structured data
- ❌ Structured data appeared only after JavaScript execution
- ❌ Google/Bing couldn't see rich schema markup during crawling
- ✅ Meta tags (OG, Twitter) were already handled by edge function
- ❌ But JSON-LD was client-side only

**The Solution:**
1. **Enhanced Edge Function** (`netlify/edge-functions/meta-rewrite.ts`):
   - Added `generateStructuredData()` function
   - Changed to use `portfolio-data.json` as primary source (has all fields vs lightweight `share-meta.json`)
   - Generates rich **Movie** schema for narrative projects:
     - Director info with social links
     - Full credits array (cast/crew)
     - Production company
     - Client/sponsor (for commercials)
     - Genre, awards, video URLs
     - Gallery images
     - Proper ISO 8601 dates (releaseDate/workDate/year fallback)
   - Generates **VideoObject** schema for non-narrative projects
   - Generates **Article** schema for blog posts with author info
   - Generates **Person** schema for homepage
   - Injects `<script type="application/ld+json">` directly into HTML

2. **Simplified SEO Component** (`components/SEO.tsx`):
   - Removed 150+ lines of client-side structured data generation
   - Kept meta tag updates for SPA navigation (title, OG tags, canonical)
   - Added comment explaining edge function handles structured data
   - Reduced from 243 lines to ~93 lines

**Benefits:**
- ✅ Search engines see structured data immediately (no JavaScript required)
- ✅ Better SEO scores - crawlers get complete data on first request
- ✅ Faster page loads - less client-side processing
- ✅ Still 100% static - uses pre-generated `portfolio-data.json` from Cloudinary
- ✅ No breaking changes - sync process unchanged
- ✅ More maintainable - single source of truth for structured data

**Data Flow:**
```
User/Crawler visits /work/project-slug
  ↓
Netlify Edge Function intercepts request
  ↓
Fetches portfolio-data.json (from Cloudinary CDN)
  ↓
Generates structured data + meta tags
  ↓
Injects into HTML <head>
  ↓
Browser/Crawler receives complete HTML
  ↓
✅ Search engine indexes rich structured data
  ↓
React loads → SEO.tsx updates meta for SPA navigation
```

**Files Changed:**
- `netlify/edge-functions/meta-rewrite.ts` - Added 150+ lines for structured data generation
- `components/SEO.tsx` - Removed 150+ lines of client-side generation

**Testing:**
```bash
# Test structured data in production
curl https://your-site.com/work/project-slug | grep -A 100 "application/ld+json"

# Validate with Google Rich Results Test
https://search.google.com/test/rich-results
```

---

### Nov 29 2025 - Code Consolidation & Shared Library Pattern
**What Changed:** Eliminated ~2000 lines of duplicate code by creating shared helper library.

**The Problem:**
- `fetchAirtableTable()` duplicated 6 times across scripts
- `parseExternalLinks()`, `makeSlug()`, and other helpers duplicated 2-3 times each
- Scripts and Netlify functions had inconsistent implementations
- Bug fixes required updating 6+ files
- Large function bundles (~1500+ lines per file)

**The Solution:**
1. **Created shared helpers library** (`scripts/lib/airtable-helpers.mjs`):
   - `fetchAirtableTable()` - Unified Airtable fetching with pagination
   - `buildLookupMaps()` - Festivals and clients lookup table builder
   - `parseExternalLinks()` - URL parsing and categorization
   - `makeSlug()` - URL-safe slug generation
   - `normalizeProjectType()` - Project type normalization
   - `parseCreditsText()` - Credits text parsing
   - `resolveProductionCompany()` - Production company resolution
   - `resolveAwards()` - Awards/festivals resolution

2. **Refactored all scripts to use shared library:**
   - `scripts/sync-data.mjs` - Reduced from 537 to ~350 lines
   - `scripts/generate-sitemap.mjs` - Reduced from 172 to ~120 lines
   - `scripts/generate-share-meta.mjs` - Reduced from 207 to ~150 lines

3. **Removed unused scripts:**
   - Deleted `test-cloudinary.mjs` (testing completed)
   - Deleted `test-image-fetch.mjs` (testing completed)
   - Deleted `optimize-images.mjs` (Sharp removed)
   - Deleted `migrate-to-cloudinary.mjs` (migration completed)
   - Updated `package.json` to remove obsolete commands

4. **Removed scheduled-sync references:**
   - File never existed (was from old architecture)
   - Cleaned up all documentation references
   - Clarified manual-only sync approach

**Benefits:**
- ✅ Single source of truth for core logic
- ✅ Bug fixes update once, work everywhere
- ✅ Smaller, more maintainable files
- ✅ Consistent behavior across scripts
- ✅ Easier testing and debugging
- ✅ ~2000 lines of code eliminated

**File Structure:**
```
scripts/
  lib/
    airtable-helpers.mjs (200 lines - shared logic)
  sync-data.mjs (350 lines - orchestration only)
  generate-sitemap.mjs (120 lines - formatting only)
  generate-share-meta.mjs (150 lines - formatting only)
  sync-static-to-cloudinary.mjs (unchanged)
netlify/functions/
  airtable-sync.mjs (incremental sync - can use shared helpers)
  sync-now.mjs (manual trigger)
  get-data.js (serves static data)
```

**Updated Build Commands:**
- `npm run build` - Default: Vite build only (uses existing data)
- `npm run build:full` - Full: Regenerate all data + Vite build (requires Airtable credits)
- `npm run build:data` - Sync data from Airtable only
- `npm run build:content` - Generate share-meta only
- `npm run build:sitemap` - Generate sitemap only
- `npm run sync:static` - Upload to Cloudinary only

---

### Nov 29 2025 - Incremental Sync API Optimization (90% Reduction)
**What Changed:** Implemented intelligent change detection to reduce Airtable API usage from ~50 calls per sync to 5-10 calls for typical updates.

**The Problem:**
- Every sync fetched ALL records from ALL tables (~50 API calls)
- No change detection - refetched unchanged data every time
- Airtable API limits were being consumed unnecessarily
- Slow sync times (~10 seconds) even when nothing changed

**The Solution:**
1. **Change detection using LAST_MODIFIED_TIME():**
   - Added `Last Modified` formula field to all 5 Airtable tables
   - Fetch only timestamps first (5 lightweight API calls)
   - Compare with cached timestamps to identify changes

2. **Record-level granular fetching:**
   - Fetch only changed/new records using `filterByFormula`
   - Use `OR(RECORD_ID()='rec1', RECORD_ID()='rec2', ...)` for precision
   - Avoid full table fetches unless necessary

3. **Smart caching and merging:**
   - Store raw Airtable records in `_rawRecords`
   - Store timestamps in `syncMetadata`
   - Merge changed records with cached data
   - Return cached data immediately when no changes detected

4. **Force sync parameter:**
   - Add `?force=true` to bypass change detection
   - Use for initial setup or when debugging

**Technical Implementation:**

```javascript
// netlify/functions/airtable-sync.mjs - New functions

// 1. Lightweight timestamp check (1 API call per table)
const fetchTimestamps = async (tableName) => {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableName}?fields%5B%5D=Last%20Modified`;
  // Returns: [{ id: 'rec123', lastModified: '2025-11-29T10:00:00.000Z' }, ...]
};

// 2. Compare timestamps to identify changes (5 API calls total)
const checkForChanges = async (previousSyncMetadata) => {
  // For each table: Projects, Journal, Festivals, Client Book, Settings
  const currentTimestamps = await fetchTimestamps(tableName);
  
  // Find new, changed, deleted records
  const newRecords = currentTimestamps.filter(r => !previousIds.has(r.id));
  const changedRecords = currentTimestamps.filter(r => 
    previousTimestamps[r.id] !== r.lastModified
  );
  const deletedIds = [...previousIds].filter(id => !currentIds.has(id));
  
  return { changed, new, deleted, apiCalls: 5 };
};

// 3. Fetch only specific changed records (1 API call per table with changes)
const fetchChangedRecords = async (tableName, recordIds, sortField) => {
  const formula = recordIds.length === 1 
    ? `RECORD_ID()='${recordIds[0]}'`
    : `OR(${recordIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;
  
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableName}?filterByFormula=${encodeURIComponent(formula)}`;
  // Returns: Full records for only the changed IDs
};

// 4. Main sync with change detection
const syncAirtableData = async (options = {}) => {
  const { forceFullSync = false } = options;
  
  if (forceFullSync || !previousData?.syncMetadata) {
    // FULL SYNC: Fetch everything (~50 API calls)
    return await fetchAllTables();
  }
  
  // INCREMENTAL SYNC: Check for changes first (5 API calls)
  const changes = await checkForChanges(previousData.syncMetadata);
  
  if (!hasAnyChanges(changes)) {
    // NO CHANGES: Return cached data (0 additional API calls)
    console.log('✅ No changes detected - using cached data');
    return cachedDataResponse;
  }
  
  // PARTIAL SYNC: Fetch only changed records (1-10 additional API calls)
  const changedRecords = await fetchChangedRecords(tableName, changedIds);
  
  // Merge changed records with cached data
  return mergeWithCache(changedRecords, previousData);
};
```

```json
// public/portfolio-data.json - Enhanced structure
{
  "projects": [...],
  "posts": [...],
  "config": {...},
  "lastUpdated": "2025-11-29T10:30:00.000Z",
  
  // NEW: Raw records for efficient merging
  "_rawRecords": {
    "projects": [...],      // Full Airtable record objects
    "journal": [...],
    "festivals": [...],
    "clients": [...],
    "settings": [...]
  },
  
  // NEW: Sync metadata for change detection
  "syncMetadata": {
    "lastSync": "2025-11-29T10:30:00.000Z",
    "timestamps": {
      "Projects": {
        "rec123": "2025-11-29T09:00:00.000Z",
        "rec456": "2025-11-28T15:30:00.000Z"
      },
      "Journal": {...},
      "Festivals": {...},
      "Client Book": {...},
      "Settings": {...}
    }
  }
}
```

```javascript
// netlify/functions/sync-now.mjs - Updated handler
export const handler = async (event, context) => {
  // Check for force parameter
  const forceFullSync = event.queryStringParameters?.force === 'true';
  
  if (forceFullSync) {
    console.log('⚡ Force full sync requested');
  }
  
  const result = await syncAirtableData({ forceFullSync });
  return result;
};
```

**API Usage Comparison:**

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| No changes | 50 calls | 5 calls | 90% |
| 1 record changed | 50 calls | 6 calls | 88% |
| 5 records changed | 50 calls | 10 calls | 80% |
| Force full sync | 50 calls | 50 calls | 0% |

**Response Statistics:**

```json
{
  "projects": [...],
  "posts": [...],
  "syncStats": {
    "mode": "incremental",
    "apiCalls": 6,
    "apiCallsSaved": 44,
    "newRecords": 0,
    "changedRecords": 1,
    "deletedRecords": 0,
    "unchangedRecords": 45
  }
}
```

**Usage:**

```bash
# Normal sync (incremental - default)
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now

# Force full sync (bypass change detection)
curl -X POST "https://your-site.netlify.app/.netlify/functions/sync-now?force=true"
```

**Setup Required (One-Time):**

Add `Last Modified` formula field to all 5 Airtable tables:
1. Open table in Airtable
2. Add field: Name = `Last Modified`, Type = Formula
3. Formula: `LAST_MODIFIED_TIME()`
4. After adding fields, run force full sync once: `?force=true`

**Files Modified:**
- `netlify/functions/airtable-sync.mjs` - Added change detection logic
- `netlify/functions/sync-now.mjs` - Added force parameter support
- `docs/INCREMENTAL_SYNC_OPTIMIZATION.md` - Complete guide
- `docs/INCREMENTAL_SYNC_QUICK_REF.md` - Quick reference
- `INCREMENTAL_SYNC_SUMMARY.md` - Implementation summary

**Benefits:**
- ✅ 90% reduction in API usage for typical syncs
- ✅ Faster sync times (1-2 seconds vs 10 seconds)
- ✅ Extends Airtable API limits significantly
- ✅ Detailed statistics in every response
- ✅ Backward compatible - existing code works unchanged
- ✅ Manual control with force option

---

### Jan 2026 - Eliminated All Automatic Syncs + ID-Based Change Detection
**What Changed:** Removed ALL automatic scheduling and build triggering, implemented stable Airtable attachment ID-based change detection, and enforced explicit Cloudinary quality presets.

**The Problem:**
- Content changes were triggering automatic Netlify deployments via build hooks
- Cloudinary was using automatic quality/format/DPR (`q_auto`, `f_auto`, `dpr_auto`) leading to unpredictable results
- Image change detection used Airtable attachment URLs, which regenerate frequently, causing false positives and unnecessary re-uploads
- Automatic schedules still existed in code, consuming resources

**The Solution:**
1. **Removed ALL build triggers:**
   - Deleted `NETLIFY_BUILD_HOOK` constant and environment variable
   - Removed `triggerNetlifyBuild()` function
   - Removed hash comparison logic (`hashData()`, `loadPreviousHash()`)
   - Content changes no longer trigger deployments

2. **Fixed Cloudinary presets (explicit, never auto):**
   - Removed `f_auto`, `q_auto`, `dpr_auto` from all delivery URLs
   - Use explicit presets: `q_75` (fine), `q_90` (ultra), `f_webp`, `dpr_1.0`
   - Removed `fetch_format: 'auto'` from eager transformations
   - All transformations now predictable and consistent

3. **Implemented Airtable ID-based change detection:**
   - Extract full attachment objects: `{id, url, filename, size, type}`
   - Compare stable `attachment.id` instead of regenerating `attachment.url`
   - Updated `cloudinary-mapping.json` structure:
     - Old: `{originalUrl: "https://..."}`
     - New: `{airtableId: "attXYZ...", airtableUrl: "https://...", filename: "...", size: 123}`
   - Prevents false positives when Airtable URL tokens expire

4. **Updated both sync functions:**
   - `scheduled-sync.mjs` - Updated with ID-based detection
   - `scheduled-sync-realtime.mjs` - Updated with ID-based detection
   - Both now use identical change detection logic

**Files Modified:**
- `netlify/functions/scheduled-sync.mjs` - Removed build triggers, implemented ID detection
- `netlify/functions/scheduled-sync-realtime.mjs` - Removed build triggers, implemented ID detection  
- `public/cloudinary-mapping.json` - Structure changed (backward compatible)
- `SYNC_DEPLOY_GUIDE.md` - Updated to reflect no automatic scheduling
- `docs/CLOUDINARY_INTEGRATION.md` - Documented ID-based detection and explicit presets

**Benefits:**
- ✅ No accidental deployments from content changes
- ✅ Consistent, predictable image quality (no auto guessing)
- ✅ Dramatically fewer unnecessary image re-uploads
- ✅ Lower Cloudinary bandwidth usage
- ✅ Full manual control over all operations

---

### Nov 29 2025 - Fully Decoupled Static Data Architecture with Cloudinary CDN
**What Changed:** Completed the full decoupling of static file generation from deployment, with all static data (JSON files) now served from Cloudinary CDN and uploaded to GitHub for version control.

**The Problem:**
- Automatic scheduled sync was still running daily at midnight, consuming Airtable credits
- Static JSON files were only served locally, not from Cloudinary CDN
- No way to trigger data syncs manually or independently from deployments
- Data generation was still partially coupled to the deployment process

**The Solution:**
1. **Removed automatic scheduling** - `scheduled-sync.mjs` no longer runs on cron schedule
2. **Created Cloudinary upload script** - New `sync-static-to-cloudinary.mjs` uploads all static files to Cloudinary as "raw" resources
3. **Updated frontend to fetch from Cloudinary** - `cmsService.ts` now fetches from Cloudinary CDN with local fallback
4. **Manual-only triggers** - Data sync now only runs:
   - Manually via `npm run build:data && npm run sync:static`
   - On deployment via `npm run build`
   - Via Netlify function endpoint when explicitly called
5. **Complete workflow independence** - Each script can run independently:
   - `npm run build:data` - Generate portfolio-data.json from Airtable
   - `npm run build:content` - Generate share-meta.json for SEO
   - `npm run build:sitemap` - Generate sitemap.xml
   - `npm run sync:static` - Upload all static files to Cloudinary
   - `npm run build` - Run all of the above + vite build

**Technical Implementation:**

```javascript
// scripts/sync-static-to-cloudinary.mjs - New script
// Uploads portfolio-data.json, share-meta.json, sitemap.xml to Cloudinary
const FILES_TO_UPLOAD = [
  {
    localPath: 'public/portfolio-data.json',
    publicId: 'portfolio-static/portfolio-data',
    description: 'Main portfolio data file'
  },
  {
    localPath: 'public/share-meta.json',
    publicId: 'portfolio-static/share-meta',
    description: 'Social sharing metadata'
  },
  {
    localPath: 'public/sitemap.xml',
    publicId: 'portfolio-static/sitemap',
    description: 'XML sitemap for SEO'
  }
];

// Upload as raw resources (non-image files)
await cloudinary.uploader.upload(filePath, {
  public_id: publicId,
  resource_type: 'raw',
  overwrite: true,
  invalidate: true, // Clear CDN cache
  type: 'upload'
});
```

```typescript
// services/cmsService.ts - Now fetches from Cloudinary first
const CLOUDINARY_DATA_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/portfolio-static/portfolio-data.json`;

// 1. Try Cloudinary CDN (primary)
const response = await fetch(CLOUDINARY_DATA_URL);

// 2. Fallback to local static file if Cloudinary fails
if (!response.ok) {
  const fallbackResponse = await fetch('/portfolio-data.json');
}
```

```javascript
// netlify/functions/scheduled-sync.mjs - Automatic scheduling removed
// BEFORE: export const handler = schedule('0 0 * * *', async (event) => {...});
// AFTER:  export const handler = async (event) => {...};

// Now only runs when explicitly called:
// - Manual endpoint call
// - Build hooks
// - GitHub Actions
```

```json
// package.json - Updated build process
{
  "scripts": {
    "sync:static": "node scripts/sync-static-to-cloudinary.mjs",
    "build:data": "node scripts/sync-data.mjs",
    "build:content": "node scripts/generate-share-meta.mjs",
    "build:sitemap": "node scripts/generate-sitemap.mjs",
    "build": "npm run build:content && npm run build:data && npm run build:sitemap && npm run sync:static && vite build"
  }
}
```

**Complete Data Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ MANUAL TRIGGER (when you want to update content)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. npm run build:data                                       │
│    ↓ Fetch from Airtable                                    │
│    ↓ Process data                                           │
│    ↓ Save to public/portfolio-data.json                     │
│                                                             │
│ 2. npm run build:content                                    │
│    ↓ Generate share-meta.json                               │
│                                                             │
│ 3. npm run build:sitemap                                    │
│    ↓ Generate sitemap.xml                                   │
│                                                             │
│ 4. npm run sync:static                                      │
│    ↓ Upload portfolio-data.json → Cloudinary                │
│    ↓ Upload share-meta.json → Cloudinary                    │
│    ↓ Upload sitemap.xml → Cloudinary                        │
│    ↓ Invalidate CDN cache                                   │
│                                                             │
│ 5. git add public/*.json public/*.xml                       │
│    git commit -m "Update content data"                      │
│    git push                                                 │
│    ↓ GitHub stores versioned copies                         │
│                                                             │
│ 6. Netlify auto-deploys (code changes only)                 │
│    OR manual deploy via GitHub Actions                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNTIME (how website gets data)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Browser Request                                             │
│    ↓                                                        │
│ cmsService.ts                                               │
│    ↓                                                        │
│ Try: https://res.cloudinary.com/.../portfolio-data.json     │
│    ↓ (Primary - Cloudinary CDN)                             │
│    ↓                                                        │
│ Success? Return data                                        │
│    ↓                                                        │
│ Failed? Try fallback: /portfolio-data.json                  │
│    ↓ (Local static file from build)                         │
│    ↓                                                        │
│ Display content                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Cloudinary Static File URLs (Portfolio-Aware):**
- Portfolio Data: `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data-{mode}.json`
- Share Meta: `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/share-meta-{mode}.json`
- Sitemap: `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/sitemap-{mode}.xml`
- Robots: `https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/robots-{mode}.txt`

Where `{mode}` is `directing` or `postproduction`.

**GitHub Version Control (Portfolio-Suffixed Files):**
- `public/portfolio-data-directing.json`, `public/portfolio-data-postproduction.json`
- `public/share-meta-directing.json`, `public/share-meta-postproduction.json`  
- `public/sitemap-directing.xml`, `public/sitemap-postproduction.xml`
- `public/robots-directing.txt`, `public/robots-postproduction.txt`
- Full version history available via git
- Can rollback to any previous version
- Easy to see what changed between versions

**When to Run Data Sync:**
1. **After Airtable content changes** - New projects, blog posts, config updates
2. **Manual trigger** - When you want to publish changes
3. **On deployment** - Automatically via `npm run build`

**Airtable Credit Savings:**
- **Before:** 365 automatic checks/year + manual syncs
- **After:** Only manual syncs when you need them (estimated 50-100/year)
- **Savings:** ~70% reduction in Airtable API usage

**Benefits:**
- ✅ Zero automatic syncs - Full manual control
- ✅ Cloudinary CDN delivery - Fast global content delivery
- ✅ GitHub version control - Full data history and rollback capability
- ✅ Independent workflows - Each script runs standalone
- ✅ Lower Airtable costs - Only sync when needed
- ✅ Deployment flexibility - Deploy code without syncing data
- ✅ Data flexibility - Update data without deploying code
- ✅ Fallback resilience - Local copy if Cloudinary fails

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Removed automatic schedule wrapper
- `scripts/sync-static-to-cloudinary.mjs` - New script to upload static files to Cloudinary
- `services/cmsService.ts` - Fetch from Cloudinary with local fallback
- `package.json` - Added `sync:static` script and updated build process

**Testing the New Architecture:**
```bash
# 1. Generate fresh data from Airtable
npm run build:data

# 2. Upload to Cloudinary
npm run sync:static

# 3. Commit to GitHub
git add public/*.json public/*.xml
git commit -m "Update portfolio data"
git push

# 4. Verify Cloudinary URLs are accessible
curl https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data.json

# 5. Check website fetches from Cloudinary
# Open DevTools → Network → Look for Cloudinary URL in requests
```

**Impact:** Complete decoupling achieved. Static data generation, Cloudinary uploads, GitHub versioning, and deployment are now fully independent processes. You have complete control over when data syncs happen, saving Airtable credits and providing maximum flexibility. Website fetches from Cloudinary CDN for optimal performance with local fallback for resilience.

---

### Nov 29 2025 - Journal Navigation & Unpublished Post Protection
**What Changed:** Fixed journal post navigation to skip unpublished entries and redirect users who try to access draft/scheduled posts.

**The Problem:**
- Next/Previous buttons in journal posts navigated to ALL posts (including drafts and scheduled)
- Users could access unpublished journal entries by direct URL
- No protection for draft or scheduled content
- Analytics tracked views of unpublished posts
- Navigation logic used `allPosts` array without filtering by publication status

**The Solution:**
1. **Filter navigation by publication status** - Next/Previous buttons only navigate to published posts
2. **Redirect unpublished access** - Users accessing draft/scheduled posts are redirected to journal index
3. **Skip analytics for unpublished** - No tracking for content that's not published
4. **Early return protection** - Component doesn't render unpublished content

**Technical Implementation:**

```tsx
// components/views/BlogPostView.tsx

export const BlogPostView: React.FC<BlogPostViewProps> = ({ allPosts, allProjects, config }) => {
    const post = allPosts.find(p => (p.slug ? p.slug === slug : p.id === slug));

    // Redirect to journal index if post is not published
    useEffect(() => {
        if (post && post.status && post.status !== 'Public') {
            navigate('/journal', { replace: true });
        }
    }, [post, navigate]);

    // Track blog post view only for published posts
    useEffect(() => {
        if (post && (post.status === 'Public' || !post.status)) {
            analyticsService.trackBlogPostView(post.id, post.title);
        }
    }, [post]);

    if (!post) return null;
    if (post.status && post.status !== 'Public') return null; // Don't render unpublished

    // Filter to only published posts for navigation
    const publishedPosts = allPosts.filter(p => p.status === 'Public' || !p.status);
    const currentIndex = publishedPosts.findIndex(p => p.id === post.id);
    const prevPost = currentIndex > 0 ? publishedPosts[currentIndex - 1] : null;
    const nextPost = currentIndex < publishedPosts.length - 1 ? publishedPosts[currentIndex + 1] : null;
    
    // Rest of component...
}
```

**Publication Status Logic:**
```typescript
// Posts are considered published if:
// 1. status === 'Public' (explicitly marked as public in Airtable)
// 2. !status (no status field - defaults to public for backwards compatibility)

// Posts are NOT published if:
// 1. status === 'Draft' (work in progress)
// 2. status === 'Scheduled' (future publication date)
```

**User Experience:**

| Scenario | Before | After |
|----------|--------|-------|
| **Next/Previous buttons** | Navigate to any adjacent post (including drafts) | Only navigate to published posts |
| **Direct URL to draft** | Renders draft content | Redirects to /journal index |
| **Analytics tracking** | Tracks all views including drafts | Only tracks published post views |
| **Share-meta generation** | Included all posts | Only includes published posts |

**Consistency Across Components:**
- `BlogView.tsx` - Already filtered: `posts.filter(p => p.status === 'Public' || !p.status)`
- `BlogPostView.tsx` - Now filtered: Navigation and access control added
- `scripts/sync-data.mjs` - Already filtered: Share-meta only includes published posts
- `netlify/functions/scheduled-sync.mjs` - Already filtered: Share-meta only includes published posts

**Testing:**
```bash
# 1. Create a draft post in Airtable with status='Draft'
# 2. Navigate to a published post
# 3. Click Next/Previous - should skip the draft
# 4. Try accessing draft URL directly - should redirect to /journal
# 5. Check analytics - no events for draft views
```

**Updated Files:**
- `components/views/BlogPostView.tsx` - Added publication filtering, redirect logic, and access control

**Benefits:**
- ✅ Content privacy - Drafts stay private until published
- ✅ Better navigation UX - Users never encounter unpublished content
- ✅ Accurate analytics - Only track public content views
- ✅ Scheduled post support - Content can be prepared in advance
- ✅ Consistent behavior - Matches BlogView filtering logic

**Impact:** Users can no longer accidentally discover or navigate to unpublished journal content. Navigation flows only through published entries, maintaining content privacy and providing a cleaner user experience.

---

### Nov 29 2025 - Rate Limit Fallback for All Data Sync Functions
**What Changed:** Added comprehensive rate limit detection and fallback logic to both build-time and scheduled sync functions to handle Airtable API rate limits gracefully.

**The Problem:**
- Airtable free tier has monthly API rate limits (resets on 1st of each month)
- When limit hit → sync functions crashed with 429 errors
- Build process failed completely → no portfolio-data.json → empty site
- Scheduled sync failed → no fresh data updates → stale content
- No graceful degradation or fallback mechanism
- Users saw broken site during rate limit periods

**The Solution:**
- **Rate Limit Detection:** Both sync functions now detect 429 errors specifically
- **Cached Data Fallback:** Load existing `portfolio-data.json` when rate limited
- **Share-Meta Regeneration:** Create fresh `share-meta.json` from cached data
- **Graceful Degradation:** Site continues working with last known good data
- **Clear Logging:** Helpful messages about when rate limit will reset
- **Build Success:** Builds succeed with cached data instead of failing

**Technical Implementation:**

```javascript
// scripts/sync-data.mjs & netlify/functions/scheduled-sync.mjs

// 1. Load existing cached data as fallback
async function loadCachedData() {
  try {
    const dataPath = path.join(OUTPUT_DIR, 'portfolio-data.json');
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(content);
      console.log('✅ Loaded existing cached data as fallback');
      return data;
    }
  } catch (error) {
    console.warn('⚠️ Could not load cached data:', error.message);
  }
  return null;
}

// 2. Detect 429 errors in Airtable fetch
async function fetchAirtableTable(tableName, sortField) {
  const res = await fetch(url, { 
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } 
  });

  if (!res.ok) {
    if (res.status === 429) {
      const error = new Error(`Rate limit exceeded for ${tableName}`);
      error.isRateLimit = true;
      error.statusCode = 429;
      throw error;
    }
    throw new Error(`Failed to fetch ${tableName}: ${res.status}`);
  }
}

// 3. Handle rate limits gracefully in main function
async function main() {
  try {
    // Normal sync logic...
  } catch (error) {
    // Check if error is due to rate limiting
    if (error.isRateLimit || error.statusCode === 429 || 
        error.message?.includes('Rate limit') || error.message?.includes('429')) {
      console.error('⚠️ Airtable API rate limit exceeded');
      console.log('🔄 Attempting to use cached data as fallback...');
      
      const cachedData = await loadCachedData();
      
      if (cachedData && cachedData.projects && cachedData.posts) {
        console.log('✅ Using cached data (last updated: ' + cachedData.lastUpdated + ')');
        console.log('📊 Cached data: ' + cachedData.projects.length + ' projects, ' + cachedData.posts.length + ' posts');
        
        // Regenerate share-meta from cached data
        const shareMeta = generateShareMeta(cachedData.projects, cachedData.posts, cachedData.config);
        fs.writeFileSync(SHARE_META_FILE, JSON.stringify(shareMeta, null, 2), 'utf-8');
        console.log('✅ Regenerated share-meta.json from cached data');
        
        console.log('📍 Using stale data until rate limit resets');
        console.log('⏰ Rate limit typically resets at start of next month');
        
        // Build script: Exit successfully
        process.exit(0);
        
        // Scheduled function: Return cached data with headers
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=600',
            'X-Data-Source': 'cached-fallback'
          },
          body: JSON.stringify({
            ...cachedData,
            sync: {
              rateLimitHit: true,
              buildTriggered: false,
              buildReason: 'Rate limit exceeded - using cached data',
              cachedDataAge: cachedData.lastUpdated
            }
          })
        };
      } else {
        console.error('❌ No cached data available and rate limit exceeded');
        console.error('💡 Site will use empty fallback until rate limit resets');
        process.exit(1);
      }
    }
    
    // Other errors throw normally
    throw error;
  }
}
```

**Behavior During Rate Limits:**

| Function | Rate Limit Behavior |
|----------|-------------------|
| **Build-time sync** (`scripts/sync-data.mjs`) | Uses cached data → Regenerates share-meta → Exits successfully (build continues) |
| **Scheduled sync** (`netlify/functions/scheduled-sync.mjs`) | Uses cached data → Returns 200 with `X-Data-Source: cached-fallback` header |
| **No cache available** | Build fails (exit 1) → Scheduled sync returns 503 with `Retry-After` header |

**Response Payload (Rate Limited):**
```json
{
  "projects": [...],  // From cached portfolio-data.json
  "posts": [...],     // From cached portfolio-data.json
  "config": {...},    // From cached portfolio-data.json
  "lastUpdated": "2025-11-28T10:30:00Z",  // Original cache timestamp
  "version": "1.0",
  "source": "scheduled-sync",
  "sync": {
    "contentChanged": false,
    "buildTriggered": false,
    "buildReason": "Rate limit exceeded - using cached data",
    "rateLimitHit": true,
    "cachedDataAge": "2025-11-28T10:30:00Z"
  }
}
```

**Console Output Example:**
```
[sync-data] ⚠️ Airtable API rate limit exceeded
[sync-data] 🔄 Attempting to use cached data as fallback...
[sync-data] ✅ Loaded existing cached data as fallback
[sync-data] ✅ Using cached data (last updated: 2025-11-28T10:30:00Z)
[sync-data] 📊 Cached data: 41 projects, 12 posts
[sync-data] ✅ Regenerated share-meta.json from cached data
[sync-data] 📍 Using stale data until rate limit resets
[sync-data] ⏰ Rate limit typically resets at start of next month (Dec 1st)
```

**Updated Files:**
- `scripts/sync-data.mjs` - Added loadCachedData(), 429 detection, graceful fallback
- `netlify/functions/scheduled-sync.mjs` - Added loadCachedData(), 429 detection, graceful fallback with response headers

**Testing Rate Limit Handling:**
```bash
# Trigger rate limit (after hitting monthly quota)
npm run build:data

# Expected output:
# ⚠️ Rate limit exceeded → ✅ Using cached data → Build succeeds

# Check Netlify function logs for scheduled sync
# Should see: "Using cached data" + "X-Data-Source: cached-fallback" header
```

**Performance Impact:**
- **Normal operation:** Zero impact (no rate limits)
- **Rate limited:** Instant response from cached file (~1-2ms)
- **Build process:** Succeeds instead of failing (0% build failure rate during limits)
- **User experience:** Site continues working normally with last known data

**Benefits:**
- ✅ Zero downtime during rate limit periods
- ✅ Builds succeed instead of failing
- ✅ Social media previews continue working (share-meta regenerated)
- ✅ Site displays last known good data
- ✅ Clear logging for debugging
- ✅ Automatic recovery when rate limit resets
- ✅ No manual intervention required

**Rate Limit Information:**
- **Airtable Free Tier:** 1,000 requests per workspace per month
- **Reset Time:** 00:00 UTC on 1st of each month
- **Our Usage:** ~2-3 requests per sync (Projects, Journal, Settings tables)
- **Daily syncs:** ~60-90 requests/month (well under limit normally)
- **Rate limit reached:** Typically only when running many manual syncs or builds

**Recovery Process:**
1. Rate limit hits → Sync uses cached data
2. Site continues working normally
3. Wait for 1st of next month (automatic reset)
4. Next sync after reset fetches fresh data
5. Cache updated with latest content
6. Everything returns to normal

**Impact:** Site is now resilient to Airtable API rate limits. No downtime, no empty screens, no broken builds. Gracefully serves cached data until rate limit resets, then automatically resumes normal operation.

---

### Nov 29 2025 - Share-Meta Generation During Build Process
**What Changed:** Added share-meta.json generation to build-time sync script to fix social media link previews.

**The Problem:**
- Social media link previews (iMessage, Facebook Messenger) showed default homepage meta
- `public/share-meta.json` was empty after builds
- Build script only generated `portfolio-data.json`, not `share-meta.json`
- Edge function `meta-rewrite.ts` had no data to inject into meta tags
- Project-specific previews weren't working

**The Solution:**
- Added `generateShareMeta()` function to `scripts/sync-data.mjs`
- Now generates both `portfolio-data.json` AND `share-meta.json` during builds
- Share-meta includes all projects and public posts with metadata for OG tags
- Same logic as scheduled-sync function for consistency

**Technical Implementation:**

```javascript
// scripts/sync-data.mjs

// Generate share-meta.json for social media previews
function generateShareMeta(projects, posts, config) {
  console.log('[sync-data] 🔗 Generating share-meta.json...');
  
  // Only include Public posts (or Scheduled posts that are past their date)
  const publicPosts = posts.filter(post => {
    if (post.status === 'Public') return true;
    if (post.status === 'Scheduled') {
      const postDate = new Date(post.date);
      const now = new Date();
      return postDate <= now;
    }
    return false;
  });
  
  const manifest = {
    generatedAt: new Date().toISOString(),
    projects: projects.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: (p.description || '').slice(0, 220),
      image: p.heroImage || '',
      type: p.type,
      year: p.year
    })),
    posts: publicPosts.map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: (p.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      image: p.imageUrl || '',
      type: 'article',
      date: p.date
    })),
    config: {
      defaultOgImage: config.defaultOgImage || ''
    }
  };
  
  console.log(`[sync-data] ✅ Generated share-meta with ${manifest.projects.length} projects, ${manifest.posts.length} posts`);
  return manifest;
}

// Main execution
async function main() {
  // ... fetch projects, posts, config ...
  
  // Write portfolio-data.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('[sync-data] ✅ Successfully generated portfolio-data.json');
  
  // Generate and write share-meta.json
  const shareMeta = generateShareMeta(projects, posts, config);
  fs.writeFileSync(SHARE_META_FILE, JSON.stringify(shareMeta, null, 2), 'utf-8');
  console.log('[sync-data] ✅ Successfully generated share-meta.json');
}
```

**Updated Files:**
- `scripts/sync-data.mjs` - Added generateShareMeta() function and share-meta.json generation

**Build Output:**
```
[sync-data] 🔄 Starting data sync...
[sync-data] ✅ Successfully generated portfolio-data.json
[sync-data] 🔗 Generating share-meta.json...
[sync-data] ✅ Generated share-meta with 41 projects, 12 posts
[sync-data] ✅ Successfully generated share-meta.json
[sync-data] 📊 Stats: 41 projects, 12 posts
[sync-data] 📍 Outputs: /public/portfolio-data.json, /public/share-meta.json
```

**Impact:** Social media link previews now work correctly. When sharing project or post links, platforms fetch project-specific titles, descriptions, and images from share-meta.json via the meta-rewrite edge function.

---

### Nov 28 2025 - Airtable Fallback for Resilient Data Delivery
**What Changed:** Added Airtable fallback to `get-data.js` function to ensure site remains functional if static JSON file fails.

**The Problem:**
- Site relied entirely on `portfolio-data.json` static file
- If JSON file was corrupted, missing, or failed to load → empty site
- No automatic recovery mechanism if static build failed
- Users would see blank project/post listings with no data

**The Solution:**
- Added 3-tier fallback hierarchy in `get-data.js`:
  1. **Primary:** Serve static `portfolio-data.json` (cached 7 days)
  2. **Fallback:** Fetch minimal data from Airtable (cached 5 minutes)
  3. **Last Resort:** Return empty structure with graceful defaults
- Fallback fetches basic project titles/slugs to show something instead of nothing
- Uses existing Airtable credentials from environment variables
- Different cache strategy: 5 minutes for fallback vs 7 days for static

**Technical Implementation:**

```javascript
// netlify/functions/get-data.js - 3-tier fallback
export const handler = async (event, context) => {
  try {
    // 1. Try static file (primary)
    const data = await readFile(dataPath, 'utf-8');
    return { statusCode: 200, body: data };
  } catch (error) {
    try {
      // 2. Try Airtable fallback
      const fallbackData = await fetchAirtableFallback();
      return {
        statusCode: 200,
        headers: { 'Cache-Control': 'public, max-age=300, must-revalidate' },
        body: JSON.stringify(fallbackData)
      };
    } catch (fallbackError) {
      // 3. Last resort: empty structure
      return { statusCode: 200, body: JSON.stringify(emptyDefaults) };
    }
  }
};

// Minimal Airtable fetch for emergency use
async function fetchAirtableFallback() {
  const projectsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Projects`;
  const res = await fetch(projectsUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
  });
  
  const data = await res.json();
  return {
    projects: data.records.map(rec => ({
      id: rec.id,
      title: rec.fields['Project Title'] || 'Untitled',
      slug: ...,
      // Minimal fields only
    })),
    posts: [],
    config: { /* defaults */ },
    source: 'airtable-fallback'
  };
}
```

**Fallback Behavior:**

| Scenario | Result | Cache Duration | Data Source |
|----------|--------|----------------|-------------|
| Static JSON loads | Full data, all fields | 7 days (stale-while-revalidate) | `portfolio-data.json` |
| JSON missing/corrupt | Minimal project data | 5 minutes | Airtable API |
| Airtable also fails | Empty defaults | No cache | Hardcoded fallback |

**What Fallback Includes:**
- Project titles and slugs only (enough to show listings)
- No gallery images, videos, or detailed metadata
- Empty posts array (journal not available)
- Default config values (contact/about/showreel disabled)
- `source: 'airtable-fallback'` flag for debugging

**Cache Strategy:**
- **Static file:** `max-age=3600, s-maxage=86400, stale-while-revalidate=604800` (7 days)
- **Fallback data:** `max-age=300, must-revalidate` (5 minutes, no stale serving)
- **Empty defaults:** `no-cache` (not cached at all)

**Environment Variables Required:**
```bash
AIRTABLE_TOKEN=your_token          # Airtable API token
AIRTABLE_BASE_ID=your_base_id      # Airtable base ID
```

**When Fallback Triggers:**
- Static JSON file not found (deployment issue)
- JSON file corrupted (invalid JSON syntax)
- File read permission error
- Any other file system error

**Updated Files:**
- `netlify/functions/get-data.js` - Added fetchAirtableFallback() and 3-tier error handling

**Performance Impact:**
- Normal operation: Zero impact (static file served as before)
- Fallback scenario: 1-2 second delay (Airtable API call)
- Fallback is rare exception, not normal flow
- Better UX than showing completely empty site

**Monitoring:**
- Check function logs for: `"⚠️ Failed to load static data"` (fallback triggered)
- Check function logs for: `"✅ Successfully fetched fallback data from Airtable"` (fallback worked)
- Check function logs for: `"❌ Airtable fallback also failed"` (last resort used)
- Response includes `source` field to identify which tier was used

**Impact:** Site now has resilience against static file failures. Users see something instead of nothing if JSON fails. Airtable acts as backup data source when static build has issues. Graceful degradation ensures site never completely breaks.

---

### Nov 28 2025 - Journal Status Filtering with Public-Only Display
**What Changed:** Added status-based filtering to journal posts for granular control over post visibility.

**The Problem:**
- No way to hide draft or scheduled journal posts from public view
- All posts in Airtable were displayed on the website immediately
- Needed ability to prepare posts in advance without publishing them
- Wanted to control which posts appear in sitemap and social sharing metadata

**The Solution:**
- Added `status` field to BlogPost TypeScript interface (Public/Scheduled/Draft)
- Build-time filtering: Only syncs Public or Scheduled posts (excludes Draft entirely)
- Frontend filtering: BlogView only displays Public posts
- Sitemap: Only includes Public posts (or Scheduled posts past their date)
- Share metadata: Only includes Public posts (or Scheduled posts past their date)
- Backward compatible: Posts without status field default to showing

**Technical Implementation:**

```javascript
// scripts/sync-data.mjs - Filter during sync
const status = f['Status'] || 'Draft';
if (status !== 'Public' && status !== 'Scheduled') {
  console.log(`⏭️ Skipping ${status} post: ${title}`);
  continue; // Don't sync Draft posts at all
}

// Add status to cached data
status: status,
```

```typescript
// types.ts - Added status field
export interface BlogPost {
  // ... existing fields
  status?: 'Public' | 'Scheduled' | 'Draft';
  // ... other fields
}
```

```tsx
// components/views/BlogView.tsx - Filter display
const publicPosts = posts.filter(post => post.status === 'Public' || !post.status);
```

**SEO Protection:**
- **Sitemap:** Only Public posts included (or Scheduled past their date)
- **Share Meta:** Only Public posts get Open Graph tags
- **Frontend:** Only Public posts visible to users and search engines
- **Cache:** Public + Scheduled synced (Scheduled hidden until status changed)

**Status Flow:**
1. **Draft** - Not synced, completely excluded from build
2. **Scheduled** - Synced to cache but hidden from frontend/sitemap/meta
3. **Public** - Fully visible everywhere (frontend, sitemap, social sharing)

**Airtable Setup:**
1. Go to Journal table
2. Add field: "Status" (Single Select)
3. Add options: Draft, Scheduled, Public
4. Set default to "Draft" for new posts
5. Change to "Public" when ready to publish
6. Run `npm run build:data` to regenerate static cache

**Updated Files:**
- `scripts/sync-data.mjs` - Added status filtering during sync
- `scripts/generate-sitemap.mjs` - Already filters by status
- `scripts/generate-share-meta.mjs` - Already filters by status
- `types.ts` - Added optional `status?` field to BlogPost interface
- `components/views/BlogView.tsx` - Filter to Public posts only

**Performance Impact:**
- Draft posts excluded from sync (smaller cache file)
- Scheduled posts cached but hidden (ready for instant publishing)
- No runtime performance change
- Backward compatible with existing posts

**Impact:** Full control over journal post visibility. Can prepare posts in advance (Scheduled) without exposing them. Search engines and social crawlers only see Public posts. No risk of premature indexing. Change status in Airtable → next build updates visibility.

---

### Nov 28 2025 - Display Status Field for Project Visibility Control
**What Changed:** Replaced binary "Front Page" checkbox with granular "Display Status" single-select field offering 4-tier project visibility control.

**The Problem:**
- Front Page checkbox was too limited (only show/hide on front page)
- No way to mark projects as drafts/hidden completely
- No way to distinguish between "featured" and "hero" projects
- Limited control over which projects sync to production

**The Solution:**
- Added "Display Status" single-select field in Airtable Projects table
- Four visibility states:
  1. **Hidden** - Project completely excluded from sync (drafts, unpublished work)
  2. **Portfolio Only** - Syncs to site but not featured on homepage
  3. **Featured** - Appears on front page grid (sets `isFeatured: true`)
  4. **Hero** - Eligible for hero slot on homepage (sets `isFeatured: true` and `isHero: true`)

**Technical Implementation:**

```javascript
// scripts/sync-data.mjs - Filter and derive flags from Display Status
const displayStatus = f['Display Status'] || '';
if (displayStatus === 'Hidden' || !displayStatus) continue; // Skip entirely

// Derive boolean flags for frontend use
isFeatured: displayStatus === 'Featured' || displayStatus === 'Hero',
isHero: displayStatus === 'Hero',
```

**TypeScript Interface Updates:**
```typescript
// types.ts - Added new optional field
export interface Project {
  // ... existing fields
  isFeatured: boolean;     // true if Featured OR Hero
  isHero?: boolean;        // true only if Hero status
  // ... other fields
}
```

**Migration from Old System:**
- Old: `Feature` checkbox → true/false
- New: Display Status → Hidden/Portfolio Only/Featured/Hero
- Mapping: Feature=true → Featured, Feature=false → Portfolio Only
- Zero breaking changes (existing `isFeatured` field maintained)

**Updated Files:**
- `scripts/sync-data.mjs` - Added Display Status field check and flag derivation
- `types.ts` - Added `isHero?: boolean` field to Project interface

**Performance Impact:**
- Build-time filtering reduces output size (Hidden projects excluded)
- No runtime performance change (same data structure)
- Maintains backward compatibility with existing frontend code

**Usage Examples:**

```typescript
// Filter hero-eligible projects for homepage
const heroProjects = projects.filter(p => p.isHero);

// Show featured projects on front page
const featuredProjects = projects.filter(p => p.isFeatured);

// All synced projects (Hidden excluded at build)
const allProjects = projects; // Portfolio Only, Featured, and Hero
```

**Airtable Setup:**
1. Go to Projects table
2. Add new field: "Display Status" (Single Select)
3. Add options in order: Hidden, Portfolio Only, Featured, Hero
4. Migrate existing projects from Feature checkbox
5. Run `npm run build:data` to regenerate static cache

**Impact:** Much more granular control over project visibility. Can now hide drafts completely, distinguish between featured and hero-eligible projects, and control exactly what syncs to production. Frontend code unchanged - new field is optional and backward compatible.

---

### Nov 28 2025 - Project Date Fields and Sorting
**What Changed:** Added `releaseDate` and `workDate` fields to project schema, with automatic sorting by date (newest first) at build time.

**The Problem:**
- Only extracting year from dates, losing full date information
- Projects appeared in arbitrary order from Airtable
- No way to sort by actual release/production dates
- Year extraction logic wasn't considering both date fields

**The Solution:**
- Added `releaseDate` and `workDate` fields to capture full dates from Airtable (YYYY-MM-DD format)
- Updated year extraction to use releaseDate OR workDate as fallback
- Implemented client-side sorting by date (newest first) using `localeCompare()`
- Sorting happens at build time for optimal performance

**Technical Implementation:**

```javascript
// scripts/sync-data.mjs - Extract both date fields
const releaseDate = f['Release Date'] || '';
const workDate = f['Work Date'] || '';
const year = (releaseDate || workDate || '').substring(0, 4);

// Add to project object
releaseDate: releaseDate,
workDate: workDate,
year: year,

// Sort after fetching (newest first)
projects.sort((a, b) => {
  const dateA = a.releaseDate || a.workDate || '';
  const dateB = b.releaseDate || b.workDate || '';
  return dateB.localeCompare(dateA); // Descending order
});
```

**TypeScript Interface Updates:**
```typescript
// types.ts - Added optional date fields
export interface Project {
  year: string;                // Extracted from releaseDate or workDate
  releaseDate?: string;        // Full release date (YYYY-MM-DD)
  workDate?: string;           // Full work/production date (YYYY-MM-DD)
  // ... other fields
}
```

**Sort Logic:**
- Primary: Use `releaseDate` if available
- Fallback: Use `workDate` if no release date
- Order: Descending (newest projects first)
- Empty dates: Sorted to end

**Updated Files:**
- `scripts/sync-data.mjs` - Added date fields and sorting logic
- `types.ts` - Added optional `releaseDate?` and `workDate?` fields
- `public/portfolio-data.json` - Regenerated with new fields

**Impact:** Projects now display in chronological order (newest first) with complete date information preserved. Year field correctly falls back to workDate if releaseDate is missing. No frontend changes needed - sorting happens at build time.

---

### Nov 28 2025 - Static Build-Time Data Architecture (Zero Runtime Airtable Calls)
**What Changed:** Complete architectural shift from runtime Airtable fetching to static build-time data generation.

**The Problem:**
- `get-data.js` was calling `scheduled-sync-realtime.mjs` on every request
- This checked Airtable in real-time to detect changes
- Even with CDN caching, cache misses triggered slow Airtable API calls
- Users wanted data to be completely static, updated only during builds

**The Solution:**
- **Build-time sync:** `npm run build:data` fetches from Airtable and saves to `public/portfolio-data.json`
- **Static serving:** `get-data.js` now simply reads and serves the static file (no Airtable calls)
- **Build process:** `package.json` build script runs data sync before Vite build
- **Aggressive caching:** Static file cached for 24 hours at CDN (since it only updates at build)

**Technical Implementation:**

```javascript
// netlify/functions/get-data.js - Now just serves static file
export const handler = async (event, context) => {
  const dataPath = path.join(__dirname, '..', '..', 'public', 'portfolio-data.json');
  const data = await readFile(dataPath, 'utf-8');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Cache for 24h at CDN (updates only at build time)
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
    body: data
  };
};
```

```javascript
// netlify/functions/scheduled-sync.mjs - Saves static file during sync
const finalData = {
  projects,
  posts,
  config,
  lastUpdated: new Date().toISOString(),
  version: '1.0',
  source: 'scheduled-sync'
};

const portfolioDataPath = path.join(baseDir, 'portfolio-data.json');
await writeFile(portfolioDataPath, JSON.stringify(finalData, null, 2), 'utf-8');
```

```json
// package.json - Build script runs data sync first
{
  "scripts": {
    "build:data": "node scripts/sync-data.mjs",
    "build": "npm run build:data && vite build"
  }
}
```

**Build Process Flow:**
```
1. npm run build
   ↓
2. npm run build:data (scripts/sync-data.mjs)
   ↓
3. Fetch from Airtable + Upload to Cloudinary
   ↓
4. Save to public/portfolio-data.json
   ↓
5. vite build (bundles React app + copies public/)
   ↓
6. Deploy to Netlify (static JSON file included)
```

**Runtime Flow:**
```
Browser → Netlify CDN → get-data.js → Read portfolio-data.json → Return
```

**Performance Impact:**
- **Zero Airtable API calls at runtime** (only during builds)
- **Instant response** (just reading a file, ~1-2ms)
- **Predictable caching** (data only changes at build time)
- **Lower costs** (no runtime function executions for data fetching)

**Cache Strategy:**
- `max-age=3600`: Browser caches for 1 hour
- `s-maxage=86400`: CDN caches for 24 hours (safe since builds invalidate)
- `stale-while-revalidate=604800`: Serve stale for 7 days while revalidating

**When Data Updates:**
1. **Scheduled midnight sync** - Airtable changes detected → Build triggered → New static file deployed
2. **Manual deployment** - Run `npm run build` → Fresh data fetched → Deployed
3. **GitHub Actions** - Weekly code check or manual trigger → Build includes fresh data

**Updated Files:**
- `netlify/functions/get-data.js` - Now serves static file instead of calling Airtable
- `netlify/functions/scheduled-sync.mjs` - Saves complete data to portfolio-data.json
- `package.json` - Build script runs data sync before Vite build
- `scripts/sync-data.mjs` - Build-time data fetching script

**Breaking Changes:**
- None! Frontend `cmsService.ts` still calls `/.netlify/functions/get-data` as before
- Data structure unchanged (same JSON format)
- Zero code changes needed in React components

**Impact:** Site now loads data instantly from static files generated at build time. Zero runtime Airtable API calls. Simpler, faster, more predictable. Data updates only when you deploy, not dynamically at runtime.

---

### Nov 28 2025 - CDN Cache Warming After Deployment
**What Changed:** Added automatic CDN cache warming to GitHub Actions workflow to eliminate slow first-page-load after deployments.

**The Problem:**
- After deployment, Netlify CDN cache is cleared (fresh deployment)
- First visitor hits `/.netlify/functions/get-data`
- **CDN cache MISS** → Function executes → Airtable API call (2-5 seconds)
- First visitor experiences slow load (2-5s) while subsequent visitors get fast loads (100-300ms)
- Professional sites shouldn't have "slow first visitor" problem

**The Solution:**
- Added "Warm CDN cache" step to `.github/workflows/scheduled-deploy.yml`
- Automatically curls `/.netlify/functions/get-data` after successful deployments
- Waits 45 seconds for Netlify deployment to complete
- Pre-populates CDN cache BEFORE any real visitors arrive
- Non-blocking: Fails gracefully with warning if request errors

**Technical Implementation:**
```yaml
- name: Warm CDN cache
  if: steps.check_code.outputs.code_changed == 'true' || steps.generate.outputs.content_changed == 'true'
  run: |
    echo "🔥 Warming CDN cache after deployment..."
    sleep 45  # Wait for Netlify deployment to complete
    curl -f --max-time 30 "https://directedbygabriel.com/.netlify/functions/get-data" || echo "⚠️ Cache warming failed (non-critical)"
    echo "✅ CDN cache warming complete"
```

**When It Runs:**
- Only when code or content changes detected
- After GitHub Action creates deployment commit
- Before workflow completes (but doesn't block deployment)

**Performance Impact:**
- **Before:** First visitor: 2-5 seconds, subsequent: 100-300ms
- **After:** All visitors (including first): 100-300ms
- **Trade-off:** Adds ~50 seconds to GitHub Action runtime (hidden from users)
- **Cost:** One extra Airtable API call per deployment (~70-120/year)

**Safety Features:**
- `|| echo "..."` ensures workflow doesn't fail if warming errors
- `--max-time 30` prevents hanging on slow responses
- `-f` flag fails on HTTP errors (allows retry logic if needed)
- Non-critical: If warming fails, first user warms cache instead (current behavior)

**Updated Files:**
- `.github/workflows/scheduled-deploy.yml` - Added cache warming step

**Impact:** First visitor now gets same fast experience as subsequent visitors. Professional UX with no "slow first load" after deployments. CDN cache is pre-populated before site goes live.

---

### Nov 28 2025 - Persisted Cloudinary Mapping for True Incremental Syncs
**What Changed:** Removed `cloudinary-mapping.json` from `.gitignore` and committed it to git for persistence across deployments.

**The Problem:**
- `cloudinary-mapping.json` was in `.gitignore` (not tracked in git)
- File didn't persist across deployments
- Every deploy → mapping file missing → ALL images treated as "new"
- **Result:** All ~40 projects re-uploaded to Cloudinary on every sync (13-17 minutes wasted)
- Change detection logic existed but couldn't work without persistent mapping

**The Solution:**
- Removed `cloudinary-mapping.json` from `.gitignore`
- Committed current mapping file (27KB, 584 lines)
- Mapping now persists across deployments in git
- Change detection logic can now work as intended

**How Change Detection Works:**
```javascript
// Loads previous mapping from git
const existingMapping = await loadCloudinaryMapping();

// Compares each image URL
if (existingImage && existingImage.originalUrl === imageUrl) {
  // Image unchanged, skip upload
  skipCount++;
} else {
  // New or changed image, upload to Cloudinary
  await uploadToCloudinary(imageUrl, publicId, project.title);
  uploadCount++;
}
```

**Performance Impact:**
- **Before:** Every sync uploads 100+ images (13-17 minutes)
- **After:** Only upload NEW or CHANGED images
  - No content changes → 0 uploads, sync completes in ~30 seconds
  - 1 new project with 3 images → 3 uploads (~30 seconds for images + 30s for data)
  - Changed 5 images → 5 uploads (~1 minute for images + 30s for data)

**File Details:**
- Size: 27KB (584 lines of JSON)
- Tracks: 41 projects + journal posts
- Structure: `{ generatedAt, projects: [{ recordId, title, images: [{ index, publicId, cloudinaryUrl, originalUrl, format, size }] }], journal: [...] }`
- Updated: Automatically after each sync completes

**When Images ARE Uploaded:**
1. New project added to Airtable
2. Image URL changed in Airtable (different attachment)
3. Manual sync with `sync-now-realtime.mjs` (forces fresh upload if URL changed)
4. Mapping file manually deleted/corrupted

**When Images are SKIPPED:**
1. Image URL matches existing mapping entry
2. Project unchanged in Airtable
3. Daily midnight sync with no content changes

**Updated Files:**
- `.gitignore` - Removed `public/cloudinary-mapping.json`, added explanatory comment
- `public/cloudinary-mapping.json` - Committed to git (was previously ignored)

**Impact:** True incremental syncs now work. Only changed images get uploaded/optimized. Saves 13-17 minutes on daily syncs when content is unchanged. Cloudinary bandwidth usage reduced by ~95% on no-change days.

---

### Nov 28 2025 - Chain Reaction Build Hook Architecture (67% Build Reduction)
**What Changed:** Implemented automatic Netlify build triggering from midnight sync function, eliminating redundant Airtable checks and reducing build frequency by 67%.

**The Problem:**
- **Two independent systems checking the same data:**
  - Midnight (00:00 UTC): `scheduled-sync.mjs` fetched Airtable, uploaded images, cached data
  - 2 AM (02:00 UTC): GitHub Action fetched Airtable AGAIN, checked for changes, triggered builds
- **Result:** Airtable queried twice daily, builds triggered 365 times/year even when no changes
- **Inefficiency:** 2-hour delay between sync and deployment, wasteful GitHub Actions runs

**The Solution: "Chain Reaction" Architecture**
- Midnight sync now **detects content changes** by comparing hashes
- If changes detected → **Immediately triggers Netlify build via webhook**
- If no changes → Skips build entirely
- Disabled daily 2 AM GitHub Action (kept weekly Sunday code check)

**Technical Implementation:**

```javascript
// 1. Load previous hash from last sync run
const previousHash = await loadPreviousHash();

// 2. Calculate current content hash
const currentHash = createHash('sha256')
  .update(JSON.stringify(shareMeta.projects) + JSON.stringify(shareMeta.posts))
  .digest('hex');

// 3. Compare and trigger build only if changed
if (currentHash !== previousHash) {
  console.log('🔄 Content changed - triggering build...');
  await triggerNetlifyBuild('Scheduled sync: Content updated');
  await writeFile(hashPath, currentHash, 'utf-8');
} else {
  console.log('✅ No changes - skipping build');
}
```

**New Helper Functions Added:**

```javascript
// Loads hash from previous sync run
const loadPreviousHash = async () => {
  const hashPath = path.join(baseDir, 'share-meta.hash');
  const hash = await readFile(hashPath, 'utf-8');
  return hash.trim();
};

// Triggers Netlify build webhook
const triggerNetlifyBuild = async (reason) => {
  const buildHookUrl = `https://api.netlify.com/build_hooks/${NETLIFY_BUILD_HOOK}`;
  const response = await fetchWithTimeout(buildHookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger_title: reason })
  }, 10000);
  return { triggered: response.ok, reason };
};
```

**Response Payload Enhancement:**
```javascript
// Sync function now returns build trigger status
{
  projects: [...],
  posts: [...],
  config: {...},
  sync: {
    contentChanged: true,          // Hash comparison result
    buildTriggered: true,           // Webhook call success
    buildReason: 'Content updated'  // Trigger reason
  }
}
```

**GitHub Action Changes:**
```yaml
# .github/workflows/scheduled-deploy.yml
on:
  # Daily content check DISABLED (now handled by scheduled-sync.mjs)
  # schedule:
  #   - cron: '0 2 * * *'
  
  # Weekly code check KEPT (Sundays at 3 AM)
  schedule:
    - cron: '0 3 * * 0'
  
  # Manual trigger KEPT (for emergencies)
  workflow_dispatch:
```

**Environment Variable Required:**
```bash
# Netlify Dashboard → Build & deploy → Build hooks
# Create hook: "Scheduled Content Sync"
# Add to Environment Variables:
NETLIFY_BUILD_HOOK=abc123xyz  # Just the hook ID
```

**Build Frequency Comparison:**

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| **Airtable Checks** | 365/year (daily) | 365/year (daily) | Same |
| **Build Triggers** | 365/year | ~70-120/year | **67%** |
| **Build Minutes** | 740 min/year | 240 min/year | **500 min/year** |
| **GitHub Actions Runs** | 365/year | 52/year | **86%** |
| **Content Delay** | 2 hours | Instant | **100%** |

**When Builds Trigger:**
- ✅ **Content changes** (new project, edited post, config update) → Midnight sync detects → Build immediately
- ✅ **Code changes** (Sunday 3 AM GitHub Action) → Build once weekly
- ✅ **Manual trigger** (`workflow_dispatch`) → Build on demand
- ❌ **No changes** → No build (saves build minutes)

**Architectural Benefits:**
- **Single source of truth** - Midnight sync is the master commander
- **Instant updates** - No 2-hour delay between sync and deployment
- **Zero redundancy** - Airtable not checked twice for same data
- **Guaranteed sync** - Build never runs before images uploaded to Cloudinary
- **Cost savings** - 67% fewer builds, 86% fewer GitHub Actions runs

**Safety Features:**
- Graceful degradation: If `NETLIFY_BUILD_HOOK` not set, sync continues normally without build trigger
- Error handling: Build hook failures logged but don't crash sync function
- Manual override: GitHub Action can still be triggered manually
- Hash persistence: Stored in `/public/share-meta.hash` for comparison across runs

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Added change detection + build trigger logic
- `.github/workflows/scheduled-deploy.yml` - Disabled daily 2 AM cron, kept weekly code check

**Testing:**
```bash
# Local test (won't trigger build without env var)
curl -X POST http://localhost:8888/.netlify/functions/scheduled-sync

# Check response payload
{
  "sync": {
    "contentChanged": false,
    "buildTriggered": false,
    "buildReason": "No changes detected"
  }
}
```

**Monitoring:**
- Function logs show: "🔄 Content changed" or "✅ No changes"
- Response payload includes sync status for tracking
- Netlify build logs show: "Triggered by: Scheduled sync: Content updated"

**Rollback Plan:**
- Remove `NETLIFY_BUILD_HOOK` environment variable
- Function will skip build triggering but continue syncing
- Re-enable daily 2 AM GitHub Action cron if needed

**Impact:** Build frequency reduced by 67%, content updates deploy instantly at midnight, GitHub Actions usage reduced by 86%, and build minutes saved by ~500/year. Architecture is cleaner with single system controlling both sync and deployment.

---

### Nov 28 2025 - Removed DPR Auto Parameter from Cloudinary URLs
**What Changed:** Removed `dpr_auto` parameter from Cloudinary transformation URLs to prevent automatic server-side adjustments.

**The Problem:**
- Cloudinary was using `dpr_auto` to automatically detect device pixel ratio
- This created additional transformation variants (1x, 2x, 3x) multiplying cache permutations
- User wanted full manual control without any automatic Cloudinary decisions
- DPR parameter was interfering with predictable caching strategy

**The Solution:**
- Removed `dpr` parameter entirely from `CloudinaryOptions` interface
- Removed `dpr: 'auto'` from URL building logic
- Removed `dpr` from console.log debugging output
- URLs now use fixed transformations without automatic device detection

**Updated Files:**
- `utils/imageOptimization.ts` - Removed dpr from interface, URL builder, and console logs

**Technical Details:**
```typescript
// Before: Automatic DPR adjustment
f_webp,w_1600,c_limit,dpr_auto,q_90

// After: Manual control only
f_webp,w_1600,c_limit,q_90
```

**Cloudinary Options Interface:**
```typescript
export interface CloudinaryOptions {
  width?: number;
  quality?: 'auto:best' | 'auto:good' | 'auto:eco' | 'auto:low' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'limit' | 'fill' | 'fit' | 'scale';
  preset?: CloudinaryPreset;  // No dpr property
}
```

**Performance Impact:**
- Eliminates automatic DPR variants (reduces transformation count)
- More predictable caching behavior
- User has complete control over image delivery
- No server-side automatic adjustments

**Impact:** Cloudinary now serves images exactly as specified without automatic device-based modifications. All transformations are explicitly controlled by the preset system.

---

### Nov 28 2025 - Consistent Width Per Session for Cloudinary Images
**What Changed:** Implemented consistent image width (1600px) across all pages throughout the browsing session, controlled by preset detection.

**The Problem:**
- Different pages were requesting different image widths (800px thumbnails, 1600px full images)
- This created multiple transformation variants per image on Cloudinary
- Each width × quality combination = separate cached file
- Inconsistent bandwidth usage and cache efficiency

**The Solution:**
- **Session-wide consistency:** All images use 1600px width for entire session
- **Preset determines quality only (width is fixed at 1600px):**
  - `'ultra'` preset → quality: 90, width: 1600, crop: limit
  - `'fine'` preset → quality: 75, width: 1600, crop: limit
- Removed all explicit width parameters from view components
- Single transformation URL per preset across all pages
- **No DPR parameter** - manual control only

**Updated Files:**
- `utils/imageOptimization.ts` - Map preset to quality, fixed width at 1600px
- `components/views/ProjectDetailView.tsx` - Remove width params
- `components/views/IndexView.tsx` - Remove width params
- `components/views/BlogPostView.tsx` - Remove width params

**Technical Details:**
```typescript
// Before: Different widths per context
getOptimizedImageUrl(id, url, 'project', 0, 1, preset, 1600); // Full image
getOptimizedImageUrl(id, url, 'project', 0, 1, preset, 800);  // Thumbnail

// After: Consistent width, preset determines quality
getOptimizedImageUrl(id, url, 'project', 0, 1, preset); // Always 1600px
```

**Preset Logic:**
```typescript
if (options.preset === 'ultra') {
  qualityValue = 90;
  widthValue = 1600;
} else {
  qualityValue = 75;
  widthValue = 1600;
}

// Build transformation: f_webp,w_1600,c_limit,q_90 (no dpr)
const transformations = [
  `f_${format}`,      // webp
  `w_${width}`,       // 1600
  `c_${crop}`,        // limit (no upscaling)
  `q_${qualityValue}` // 90 or 75
].join(',');
```

**Crop Mode Explained:**
- `c_limit` = "limit the size" mode
- **Never upscales** small images (prevents quality degradation)
- **Only downscales** images larger than specified width
- Maintains original aspect ratio
- Most conservative option for quality preservation

**Performance Impact:**
- Reduced transformation variants from 16 to 2 per image (2 presets only)
- Consistent bandwidth usage across all pages
- Better cache hit rate on Cloudinary CDN
- Simpler transformation management
- Predictable, manual control over image delivery

**Impact:** All images now use consistent transformation URLs throughout the session. Preset detection happens once, cached in sessionStorage, and applied to all images. Cloudinary serves the exact same transformation variant regardless of which page the image appears on. No automatic DPR adjustments.

---

### Nov 28 2025 - Optimistic Loading with localStorage Cache
**What Changed:** Implemented localStorage-based caching with professional skeleton loading screens to eliminate blank waiting screens and provide instant content on repeat visits.

**The Problem:**
- Users experienced slow initial page loads showing only a blank screen with "Loading..." text
- Every visit (first or repeat) required 2-3 second wait for API response
- No benefit from having visited the site before
- Poor perceived performance and confusing UX

**The Solution:**
- **localStorage Cache Strategy:**
  - Save complete data structure (projects, posts, config) to browser storage
  - Read cache immediately on mount (synchronous, instant)
  - Show cached content with zero delay on repeat visits
  - Fetch fresh data in background and update cache silently
  
- **Professional Skeleton Loading:**
  - Created LoadingSkeleton component matching actual layout
  - Navigation bar, hero section, and 3-column grid placeholders
  - Subtle pulse animation for better perceived performance
  - Replaces blank "Loading..." text

**Performance Impact:**
- First visit: Better UX with skeleton instead of blank screen
- Repeat visits: ~2-3 seconds faster (instant content display)
- Offline capability: Shows last cached data gracefully
- Zero breaking changes to data flow or API

**Implementation Details:**
- Cache key: `portfolio-cache-v1` (bump version to invalidate all caches)
- Error handling: Try-catch around localStorage for incognito/private modes
- Background sync: Existing 30-minute sync continues to work
- See `docs/OPTIMISTIC_LOADING.md` for complete technical documentation

### November 27, 2025 - Cloudinary Eager Transformations for Zero Cold-Start Delays
**What Changed:** Implemented eager transformation generation at upload time to eliminate 2-3 second delays when images are first requested from new device/viewport combinations.

**The Problem:**
- Cloudinary was using dynamic transformations (dpr_auto, q_auto, w_auto)
- Each unique transformation URL triggered on-demand generation (2-3 seconds)
- First visitor with a new device combination experienced slow image loads
- Unpredictable number of transformation variants created

**The Solution:**
- **Pre-generate 8 transformation variants per image at upload time**
- Fixed matrix: 2 widths (800, 1600) × 2 qualities (90, 75) × 2 DPRs (1.0, 2.0) × 1 format (webp)
- **Client-side preset detection** automatically selects 'ultra' or 'fine' based on:
  - Viewport width × DPR (≥1024px effective → ultra)
  - Slow connection (saveData or 2G) → fine
  - Session-cached in sessionStorage for consistency
- **Zero cold-start delays** - all transformations pre-generated and cached
- **Note:** Client-side URLs no longer use DPR parameter (removed Nov 28, 2025)

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Added EAGER_TRANSFORMATIONS array, updated uploadToCloudinary
- `netlify/functions/scheduled-sync-realtime.mjs` - Same eager transformation additions
- `utils/imageOptimization.ts` - Added detectOptimalPreset(), getSessionPreset(), CloudinaryPreset type, removed dpr
- `components/common/OptimizedImage.tsx` - Added preset prop with auto-detection
- `components/views/HomeView.tsx` - Removed quality props (auto-detect)
- `components/views/IndexView.tsx` - Removed quality props (auto-detect)
- `components/views/BlogView.tsx` - Removed quality props (auto-detect)
- `components/views/BlogPostView.tsx` - Removed quality props (auto-detect)

**Technical Details:**
```javascript
// Server-side: Transformation matrix (8 variants per image):
TRANSFORMATION_PRESETS = {
  widths: [800, 1600],
  qualities: [90, 75],  // ultra, fine
  dprs: [1.0, 2.0],     // Server generates both, client doesn't request DPR
  format: 'webp'
}

// Client-side: Detection logic (no DPR in URL):
if (connection.saveData || connection.effectiveType === '2g') return 'fine';
if (viewportWidth * dpr >= 1024) return 'ultra';
return 'fine';

// Client-side URL format (no dpr parameter):
// f_webp,w_1600,c_limit,q_90  (ultra)
// f_webp,w_1600,c_limit,q_75  (fine)

// Upload configuration:
eager: EAGER_TRANSFORMATIONS,  // Pre-generate all 8 variants
eager_async: false,            // Synchronous (adds ~6-8s per image)
invalidate: true,              // Clear CDN cache
overwrite: true                // Replace existing
```

**Performance Impact:**
- **Upload time:** +6-8 seconds per image (only affects scheduled sync)
- **First load:** 2-3 seconds → ~100-300ms (instant from cache)
- **Storage:** ~180MB for 100 images (well within 25GB free tier)
- **User experience:** Zero transformation delays on all devices

**Trade-offs:**
- Longer sync duration (13-17 minutes for 100 images vs 2-3 minutes)
- Fixed transformation count (predictable, no surprises)
- Deferred 4K support (can add 2400px width later if needed)
- Client no longer uses DPR parameter (manual control)

**Impact:** All images now load instantly on first request from any device. Quality automatically adapts to device capabilities without manual configuration. Server pre-generates with DPR variants, but client requests specific quality/width combinations without DPR parameter.
- Unpredictable number of transformation variants created

**The Solution:**
- **Pre-generate 8 transformation variants per image at upload time**
- Fixed matrix: 2 widths (800, 1600) × 2 qualities (90, 75) × 2 DPRs (1.0, 2.0) × 1 format (webp)
- **Client-side preset detection** automatically selects 'ultra' or 'fine' based on:
  - Viewport width × DPR (≥1024px effective → ultra)
  - Network conditions (saveData or 2G → fine)
  - Session-cached in sessionStorage for consistency
- **Zero cold-start delays** - all transformations pre-generated and cached

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Added EAGER_TRANSFORMATIONS array, updated uploadToCloudinary
- `netlify/functions/scheduled-sync-realtime.mjs` - Same eager transformation additions
- `utils/imageOptimization.ts` - Added detectOptimalPreset(), getSessionPreset(), CloudinaryPreset type
- `components/common/OptimizedImage.tsx` - Added preset prop with auto-detection
- `components/views/HomeView.tsx` - Removed quality props (auto-detect)
- `components/views/IndexView.tsx` - Removed quality props (auto-detect)
- `components/views/BlogView.tsx` - Removed quality props (auto-detect)
- `components/views/BlogPostView.tsx` - Removed quality props (auto-detect)

**Technical Details:**
```javascript
// Transformation matrix (8 variants per image):
TRANSFORMATION_PRESETS = {
  widths: [800, 1600],
  qualities: [90, 75],  // ultra, fine
  dprs: [1.0, 2.0],
  format: 'webp'
}

// Client-side detection logic:
if (connection.saveData || connection.effectiveType === '2g') return 'fine';
if (viewportWidth * dpr >= 1024) return 'ultra';
return 'fine';

// Upload configuration:
eager: EAGER_TRANSFORMATIONS,  // Pre-generate all 8 variants
eager_async: false,            // Synchronous (adds ~6-8s per image)
invalidate: true,              // Clear CDN cache
overwrite: true                // Replace existing
```

**Performance Impact:**
- **Upload time:** +6-8 seconds per image (only affects scheduled sync)
- **First load:** 2-3 seconds → ~100-300ms (instant from cache)
- **Storage:** ~180MB for 100 images (well within 25GB free tier)
- **User experience:** Zero transformation delays on all devices

**Trade-offs:**
- Longer sync duration (13-17 minutes for 100 images vs 2-3 minutes)
- Fixed transformation count (predictable, no surprises)
- Deferred 4K support (can add 2400px width later if needed)

**Impact:** All images now load instantly on first request from any device. Quality automatically adapts to device capabilities without manual configuration.

---

### November 27, 2025 - Vimeo Vanity URL Support (Thumbnails + Embeds)
**What Changed:** Enhanced Vimeo URL handling to support vanity URLs like `https://vimeo.com/athanasiou/rooster` for both thumbnails AND video embeds.

**The Problem:**
- Previous regex only matched numeric Vimeo IDs (e.g., `vimeo.com/123456`)
- Vanity URLs like `vimeo.com/athanasiou/rooster` weren't being recognized
- These URLs used to work but broke after recent updates
- Thumbnails couldn't be fetched for vanity URLs
- Video embeds failed silently for vanity URLs (returned null)

**The Solution:**
- Updated `getVideoId()` to detect vanity URLs and pass them through for OEmbed resolution
- Modified `fetchVideoThumbnail()` to prioritize OEmbed API for all Vimeo URLs (handles vanity, private, and numeric IDs)
- Added fallback logic: OEmbed first → v2 API for numeric IDs → vumbnail service
- **Enhanced VideoEmbed component** to automatically resolve vanity URLs before embedding
- Added loading state while resolving vanity URLs via OEmbed API

**Updated Files:**
- `utils/videoHelpers.ts` - Enhanced Vimeo URL detection and thumbnail fetching
- `netlify/functions/scheduled-sync.mjs` - Backend sync now uses OEmbed for all Vimeo URLs
- `components/VideoEmbed.tsx` - Now resolves vanity URLs automatically with loading state

**Technical Details:**
```javascript
// Now handles:
// 1. Numeric IDs: vimeo.com/123456
// 2. Private videos: vimeo.com/123456/hash123
// 3. Vanity URLs: vimeo.com/athanasiou/rooster
// 4. Channel URLs: vimeo.com/channels/staffpicks/123456

// Resolution priority for thumbnails:
// 1. OEmbed API (handles all types, including vanity)
// 2. v2 API (fallback for numeric IDs)
// 3. vumbnail service (last resort for numeric IDs)

// VideoEmbed resolution flow:
// 1. Detects if URL is a vanity URL (non-numeric ID)
// 2. Calls resolveVideoUrl() to get numeric ID via OEmbed
// 3. Generates embed URL with resolved numeric ID
// 4. Shows loading state during resolution
// 5. Embeds video successfully
```

**Impact:** All Vimeo URL formats now work correctly for both thumbnails AND video embeds. Vanity URLs are automatically resolved via OEmbed API, with a loading state shown during resolution. Users can now use any Vimeo URL format without worrying about compatibility.

---

### November 27, 2025 - Documentation Consolidation & Cleanup
**What Changed:** Consolidated all documentation into single master guide and cleaned up duplicate files.

**The Problem:**
- Documentation scattered across multiple files
- Duplicate files with " 2" suffix causing confusion
- No clear hierarchy or single source of truth
- AI agents and developers had to read multiple files to understand the system

**The Solution:**
- Enhanced `AI_AGENT_GUIDE.md` to be comprehensive master guide (~3000 lines)
- Integrated content from all supplementary documentation
- Added detailed sections:
  - Complete architecture with CDN cache diagrams
  - Full Airtable → Code → Display data mappings
  - Comprehensive environment setup guide
  - Complete deployment & CI/CD documentation
  - Performance optimization strategies
- Created `DOCUMENTATION_INDEX.md` for quick navigation
- Deleted duplicate files (8 files removed)
- Updated README.md to point to master guide first

**Deleted Files:**
- `IMPLEMENTATION_LOG 2.md`
- `SPEED_IMPROVEMENTS_SUMMARY 2.md`
- `docs/CDN_CACHE_ARCHITECTURE 2.md`
- `components/views/ImageCompressionView 2.tsx`
- `components/views/ThumbnailPreviewView 2.tsx`
- `config/compressionPresets 2.json`
- `hooks/useBackgroundDataSync 2.ts`
- `scripts/generate-compression-samples 2.mjs`

**Updated Files:**
- `AI_AGENT_GUIDE.md` - Now master guide with all content
- `README.md` - Points to master guide
- `DOCUMENTATION_INDEX.md` - Quick reference index

**Impact:** Single source of truth established. AI agents and developers now have one comprehensive guide covering the entire codebase. Documentation is easier to maintain and keep current.

---

### November 27, 2025 - Fixed Reading Time Display
**What Changed:** Fixed `calculateReadingTime` function to return formatted string instead of plain number.

**The Problem:**
- `calculateReadingTime()` was returning a number (e.g., `1`, `2`, `3`)
- Frontend expected a formatted string (e.g., `"1 min read"`, `"2 min read"`)
- Result: Reading time wasn't displaying on home page, journal page, or blog posts

**The Solution:**
- Updated both sync functions to return formatted strings
- Changed return value from `1` → `"1 min read"`
- Changed return format from `Math.max(1, minutes)` → `` `${mins} min read` ``

**Updated Files:**
- `netlify/functions/scheduled-sync-realtime.mjs` - Fixed calculateReadingTime function
- `netlify/functions/scheduled-sync.mjs` - Fixed calculateReadingTime function

**Technical Details:**
```javascript
// Before (broken):
const calculateReadingTime = (text) => {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return Math.max(1, minutes);  // Returns number
};

// After (fixed):
const calculateReadingTime = (text) => {
  if (!text) return '1 min read';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  const mins = Math.max(1, minutes);
  return `${mins} min read`;  // Returns formatted string
};
```

**Impact:** Reading time now displays correctly as "1 min read", "2 min read", etc. on all pages. Will take effect after next sync runs.

---

### November 27, 2025 - Responsive Image Width Optimization
**What Changed:** Implemented responsive width parameters across all image components to dramatically reduce page load times and improve Speed Index.

**The Problem:**
- All images were being served at default 1600px width regardless of display size
- Hero images loaded full-resolution originals (4-6MB each) on desktop
- Grid thumbnails loaded 1600px images when only 400-600px was needed
- Result: 6-10MB initial page load, Speed Index of 7.4s (very slow)

**The Solution:**
- Added `width` prop to OptimizedImage component (already supported by Cloudinary)
- Implemented responsive width strategy based on image context:
  - **Hero images**: 1920px (homepage hero, high quality for large displays)
  - **Full-width content**: 1600px (blog post heroes)
  - **Grid thumbnails**: 800px (filmography grid, featured work, journal listings)
  - **Small thumbnails**: 600px (related content, sidebar thumbnails)
- Combined with existing quality differentiation (`auto:best` vs `auto:good`)

**Updated Files:**
- `components/views/HomeView.tsx` - Hero: 1920px, Grid thumbnails: 800px
- `components/views/IndexView.tsx` - Grid view: 800px (already implemented)
- `components/views/BlogView.tsx` - Journal thumbnails: 800px
- `components/views/BlogPostView.tsx` - Hero: 1600px, Related thumbnails: 600px

**Performance Impact:**

**Before:**
- Hero: ~4-6MB (original Airtable image)
- 6-8 grid thumbnails × 400-500KB = 2.4-4MB
- **Total: 6-10MB initial load**
- **Speed Index: 7.4s**

**After:**
- Hero: 1920px (~600-800KB Cloudinary WebP)
- 6-8 grid thumbnails × 150-200KB (800px) = 0.9-1.6MB
- **Total: 1.5-2.4MB initial load (70-75% reduction)**
- **Expected Speed Index: 3-4s (50% improvement)**

**Width Strategy by Context:**
- **1920px**: Homepage hero (maximum quality for large viewport)
- **1600px**: Blog post heroes (full-width editorial content)
- **800px**: Grid/list thumbnails, featured sections, journal listings
- **600px**: Small thumbnails, related content, sidebar previews

**Technical Details:**
- Cloudinary applies width transformation: `w_1920`, `w_800`, etc.
- Each width creates separate cached version (no duplication, only downloads requested size)
- Combined with format (`f_webp`) and quality (`q_auto:best` or `q_auto:good`)
- Browser only downloads the size it needs for display context

**Impact:** Massive performance improvement. Page weight reduced by 70-75%, Speed Index cut in half. Images still display at perfect quality for their display size. No visible quality loss, dramatically faster load times.

---

### November 27, 2025 - Cloudinary Integration Complete
**What Changed:** Successfully integrated Cloudinary CDN for image hosting and delivery with full upload functionality.

**The Problem:**
- Images were stored only in Airtable attachments (not CDN-optimized)
- No image caching or transformation system
- Cloudinary URLs were generated but uploads weren't working
- SDK wasn't configured with credentials

**The Solution:**
- ✅ Added Cloudinary SDK configuration to both sync functions
- ✅ Configured `cloudinary.config()` with API credentials at initialization
- ✅ Verified uploads working (all project images + journal covers)
- ✅ Images now served from Cloudinary CDN with WebP conversion
- ✅ Quality set to `auto:best` for maximum quality
- ✅ Cache invalidation enabled for instant updates

**Configuration:**
```javascript
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});
```

**Environment Variables Required:**
- `USE_CLOUDINARY=true` - Enable Cloudinary uploads
- `CLOUDINARY_CLOUD_NAME=date24ay6` - Your cloud name
- `CLOUDINARY_API_KEY` - API key from Cloudinary dashboard
- `CLOUDINARY_API_SECRET` - API secret from Cloudinary dashboard

**Upload Settings:**
- Format: **Original** (no transformation, stores source format)
- Quality: **Original** (no compression during upload)
- Resolution: **Original** (no resize during upload)
- Invalidate: `true` (clear CDN cache on re-upload)
- Overwrite: `true` (replace existing images)

**Delivery Transformations (on-demand via URL):**
- Base: `res.cloudinary.com/date24ay6/image/upload/`
- Fine preset: `f_webp,q_80,w_1000,c_limit/` (thumbnails, lists)
- Ultra preset: `f_webp,q_90,w_1600,c_limit/` (galleries)
- Hero preset: `f_webp,q_90,w_3000,c_limit/` (full-screen homepage, 4K displays)
- Public ID: `portfolio-projects-{recordId}-{index}` or `portfolio-journal-{recordId}`

**Why No Upload Transformations?**
Storing originals prevents double-compression. Images are transformed once (at delivery) instead of twice (upload + delivery).

**Scheduled Sync:**
- **Daily at midnight UTC**: Incremental sync (only uploads changed images)
- **Uses cloudinary-mapping.json**: Tracks hashes to detect changes
- **Efficient**: Skips unchanged images to save bandwidth and time

**Manual Triggers:**
- `sync-now.mjs` - Incremental sync (respects change detection)
- `sync-now-realtime.mjs` - Full sync (uploads all images fresh)

**Impact:** All images now served via Cloudinary CDN with WebP format, optimal compression, and instant cache invalidation. Page load times improved significantly.

**Files Updated:** 
- `netlify/functions/scheduled-sync.mjs` - Added SDK configuration
- `netlify/functions/scheduled-sync-realtime.mjs` - Added SDK configuration

---

### November 27, 2025 - Added Change Detection to Realtime Sync
**What Changed:** Added smart change detection to `scheduled-sync-realtime.mjs` to prevent wasteful re-uploads.

**The Problem:**
- `scheduled-sync-realtime.mjs` was uploading ALL images on every call
- No change detection meant re-uploading existing images unnecessarily
- Called by `get-data.js` which could run frequently
- Risk of high Cloudinary bandwidth usage and costs

**The Solution:**
- Added `loadCloudinaryMapping()` and `saveCloudinaryMapping()` functions
- Loads existing `cloudinary-mapping.json` at start of sync
- Checks each image URL against mapping before uploading
- Only uploads if URL is new or has changed
- Saves updated mapping after sync completes
- Now matches the efficiency of `scheduled-sync.mjs`

**Files Updated:**
- `netlify/functions/scheduled-sync-realtime.mjs` - Added change detection logic
- `AI_AGENT_GUIDE.md` - Updated documentation
- `docs/CLOUDINARY_INTEGRATION.md` - Updated architecture docs

**Impact:** Both sync methods now protected against wasteful re-uploads. Images only upload when truly needed.

---

### November 27, 2025 - Netlify Functions Cleanup
**What Changed:** Organized Netlify functions with clear separation between incremental and realtime sync strategies.

**The Problem:**
- Had duplicate sync functions with unclear purposes
- The `-alt` versions had latest fixes but naming was confusing
- Need BOTH incremental daily sync AND realtime on-demand sync
- Incremental sync only uploads changed images (efficient for daily runs)
- Realtime sync uploads all images fresh (needed for get-data.js on-demand calls)

**The Solution:**
- **Separated concerns** into two distinct sync functions:
  1. `scheduled-sync.mjs` - Incremental sync with change detection (runs daily)
  2. `scheduled-sync-realtime.mjs` - Realtime uploads (used by get-data.js)
- Created manual triggers for both:
  - `sync-now.mjs` - Triggers incremental sync
  - `sync-now-realtime.mjs` - Triggers realtime sync
- Updated `get-data.js` to use realtime version
- Backed up old versions in `netlify/functions-backup/`

**Active Functions:**
- `netlify/functions/scheduled-sync.mjs` - **Incremental sync** (runs daily at midnight UTC)
  - Only uploads new/changed images to Cloudinary
  - Uses `cloudinary-mapping.json` for change detection
  - Efficient for scheduled daily runs
  - Generates sitemap.xml and share-meta.json
  
- `netlify/functions/scheduled-sync-realtime.mjs` - **Realtime sync with change detection**
  - Smart change detection via `cloudinary-mapping.json`
  - Only uploads new/changed images (same as scheduled-sync)
  - Used by `get-data.js` for on-demand data
  - Saves mapping file after each sync
  - **Protected against wasteful re-uploads**
  
- `netlify/functions/sync-now.mjs` - Manual trigger for incremental sync
- `netlify/functions/sync-now-realtime.mjs` - Manual trigger for realtime sync
- `netlify/functions/get-data.js` - Production data API (uses realtime sync)
- `netlify/functions/sitemap.js` - Dynamic sitemap generator
- `netlify/edge-functions/meta-rewrite.ts` - Dynamic meta tags for SSR-like behavior

**Both sync methods now use change detection:**
- **Both check `cloudinary-mapping.json`** before uploading
- **Only upload when images are new or URLs have changed**
- **Safe from automatic re-uploads** - no wasteful bandwidth usage
- Mapping file persists across deployments in `/public/`

**Backed Up (Legacy):**
- `netlify/functions-backup/` - Contains old versions for reference

**Impact:** Clear separation of concerns. Daily syncs are efficient (only changed images), while on-demand calls guarantee fresh data.

---

### November 27, 2025 - Cloudinary Cache Invalidation for Quality Updates
**What Changed:** Added cache invalidation flags to force Cloudinary to regenerate images with new quality settings.

**The Problem:**
- Cloudinary caches transformed images (with specific quality settings)
- Previous uploads may have cached `q_auto:good` transformations
- Even after updating to `q_auto:best`, old cached versions were still served
- Users saw lower quality images until cache naturally expired

**The Solution:**
- Added `invalidate: true` to Cloudinary upload configuration
- Added `overwrite: true` to explicitly replace existing images
- Forces CDN cache purge for all transformation URLs
- New requests will regenerate images with `q_auto:best` quality

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Added invalidation flags (lines 194-195)

**How It Works:**
- `invalidate: true` - Clears Cloudinary's global CDN cache for the image
- `overwrite: true` - Replaces existing image with same public_id
- On next sync, all images are re-uploaded and cached versions purged
- Transformation URLs (with `q_auto:best`) will serve fresh, high-quality versions
- Cache purge propagates globally within minutes

**Impact:** After deployment and sync, all images will be served at maximum quality. Old cached versions with lower quality settings are invalidated and regenerated on demand.

---

### November 27, 2025 - Fixed Cloudinary Image Delivery Quality + Thumbnail Optimization
**What Changed:** Updated Cloudinary delivery URL quality settings for optimal balance between quality and performance.

**The Problem:**
- Images stored in Cloudinary at high quality (`auto:best` during upload)
- BUT delivery URLs were using `auto:good` quality setting (80-90% quality)
- Result: Images appeared blurry/lower quality despite high-quality storage
- Mismatch between upload quality and delivery quality

**The Solution:**
- Changed default quality in `utils/imageOptimization.ts` line 59
- From: `quality = 'auto:good'` → To: `quality = 'auto:best'`
- **Differentiated Quality Strategy:** Small thumbnails use `auto:good`, full images use `auto:best`

**Updated Files:**
- `utils/imageOptimization.ts` - Changed default quality parameter to `auto:best` (line 59)
- `components/views/IndexView.tsx` - Pass `quality="auto:good"` for filmography thumbnails
- `components/views/BlogView.tsx` - Pass `quality="auto:good"` for journal thumbnails

**How It Works:**
- **Upload (scheduled-sync.mjs):** `quality: 'auto:best'` - Stores at highest quality
- **Delivery (imageOptimization.ts):** `quality: 'auto:best'` (default) - Full images at maximum quality
- **Thumbnails (IndexView, BlogView):** `quality: 'auto:good'` - Small previews at medium quality
- Different URLs = different cached versions (no data duplication, only downloads requested version)

**Quality Differentiation:**
- **auto:best (90-100%):** Project detail slideshows, blog post heroes, home featured images
- **auto:good (80-90%):** Filmography grid, filmography list, journal listing thumbnails
- Saves ~15-20% file size on thumbnails with imperceptible quality difference at small sizes

**Technical Details:**
- `format: 'auto'` during upload converts JPEG/PNG → WebP for efficient storage
- WebP at `auto:best` maintains visual quality while reducing file size ~25-35%
- Cloudinary's smart compression optimizes per-image without visible quality loss
- Cloudinary caches each transformation URL separately (different quality = different cached file)
- Browser only downloads the version requested (no duplication or waste)

**Impact:** Full-size images display at maximum quality, while small thumbnails use optimized settings for faster page loads. Overall performance improved by ~15-20% on listing pages without visible quality loss.

---

### November 27, 2025 - Fixed Hero Image Resolution on Desktop
**What Changed:** Fixed front page hero image to always serve original high-resolution image on desktop (1024px+).

**The Problem:**
- Hero image had `useOriginalOnDesktop={true}` prop set
- `<picture>` element was configured with media queries for desktop vs mobile
- BUT: The `<img src>` fallback was pointing to `currentSrc` (optimized WebP) instead of original
- Browsers were defaulting to the 1600px WebP instead of the full-resolution Airtable image
- Result: Hero looked lower quality than it should on desktop

**The Solution:**
- Changed `<img src={currentSrc}>` to `<img src={imageUrls.fallbackUrl}>` in `OptimizedImage.tsx`
- Now desktop browsers default to the original high-res image as intended
- Mobile still gets optimized WebP for performance

**Updated Files:**
- `components/common/OptimizedImage.tsx` - Fixed img src attribute (line 187)

**How It Works:**
- `<picture>` element with `<source media="(min-width: 1024px)">` serves original Airtable image
- `<source media="(max-width: 1023px)">` serves optimized WebP (1600px @ 90% quality)
- `<img src>` now defaults to original image, matching desktop intent
- Browser picks appropriate source based on screen width

**Impact:** Front page hero now displays at maximum quality on desktop devices. Original Airtable images (typically 4000-6000px) are served on screens 1024px+, while mobile devices still get optimized WebP for fast loading.

---

### November 27, 2025 - Fixed Local Development Server to Use Netlify Functions
**What Changed:** Updated dev script to use `netlify dev` instead of plain `vite` for access to cached data.

**The Problem:**
- Running `npm run dev` used Vite's dev server directly
- No access to Netlify Functions or cached data from `get-data.js`
- Local development showed blank/empty data

**The Solution:**
- Changed `dev` script from `vite` to `netlify dev`
- Added `dev:vite` script as fallback for direct Vite access
- Netlify Dev wraps Vite and provides access to Functions

**Updated Files:**
- `package.json` - Changed dev script

**How It Works:**
- `netlify dev` starts both Vite dev server (port 3000) and Netlify Functions proxy (port 8888)
- Access the site at **`http://localhost:8888`** (not 3000)
- Functions like `/.netlify/functions/get-data` now work locally with cached data
- Environment variables from `.env.local` are automatically injected

**Impact:** Local development now has access to all cached Airtable data via Netlify Functions, matching production behavior.

---

### November 27, 2025 - Fixed Sticky Navigation and Close Button
**What Changed:** Fixed navigation bar and close button not remaining sticky during scroll.

**The Problem:**
- Navigation and close button had `fixed` positioning but were scrolling with the page
- `overflow-x: hidden` on `<body>` element was causing fixed elements to behave as absolute
- Page transition animations (opacity + transform) on parent container were creating a new stacking context
- Fixed elements inside animated containers lose their viewport-relative positioning
- Close button was rendered inside view components (ProjectDetailView, BlogPostView), which were inside the `overflow-x-hidden` container

**The Solution:**
- Removed `overflow-x: hidden` from body in `index.html`
- Added `overflow-x-hidden` to the main App container div in `App.tsx`
- **Moved Navigation and Cursor outside the transitioning container**
- Navigation and Cursor now render before the animated content wrapper
- **Updated CloseButton to use React portal** - renders directly to `document.body`
- All fixed elements (Navigation, CloseButton, Cursor) now remain properly fixed to viewport

**Updated Files:**
- `index.html` - Removed `overflow-x: hidden` from body styles (line 115)
- `App.tsx` - Restructured component hierarchy (lines 108-115, 210-212)
  - GlobalStyles, Cursor, Navigation now outside animated container
  - Main content wrapper retains transition effects without affecting fixed elements
- `components/common/CloseButton.tsx` - Added `createPortal` to render to `document.body`
  - Button now renders outside any parent container's overflow context
  - Maintains all existing functionality and styling

**Technical Details:**
- Fixed positioning is relative to the viewport, not the scroll container
- `overflow-x: hidden` on body creates a new containing block for fixed elements
- CSS transforms and opacity transitions can also create containing blocks
- Moving fixed elements outside animated wrappers preserves proper fixed positioning
- **React portals** allow components to render outside their parent DOM hierarchy
- CloseButton portal pattern matches Cursor implementation for consistency
- Z-index layering: CloseButton (z-100) > Navigation (z-50)

**Impact:** Navigation and close button now stay fixed at top of screen during scroll on all pages (home, filmography, project detail, journal, post detail), even with page transition animations enabled.

---

### November 27, 2025 - Linked Records Resolution Fix: Festivals & Production Company
**What Changed:** Fixed festivals and production companies displaying record IDs instead of names.

**The Problem:**
- Sync functions were fetching from "Awards" table but Airtable has "Festivals" table
- Sync functions were looking for "Company Name" field but Airtable has "Company" field
- When table/field lookups failed, raw Airtable record IDs were displayed instead of names
- Example: Showing "recABC123" instead of "Sundance Film Festival 2024"

**The Solution:**
- Updated both sync functions to fetch from correct table: `'Awards'` → `'Festivals'`
- Updated Client Book field mapping: Check `'Company'` first, then fallback to `'Company Name'` → `'Client'`
- Lookup maps now populate correctly and resolve IDs to actual names

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Fixed table name and field mapping

**Verification:**
- Check Netlify function logs: Should show "Fetched X records from Festivals" and "Fetched Y records from Client Book"
- Check cached data: `awards` arrays should contain festival names, `productionCompany` should contain company names
- Frontend display: Project detail pages now show proper festival and production company names

**Impact:** All linked record references now resolve correctly. No more record IDs visible to users.

---

### November 27, 2025 - Field Naming Fix: Production Company & Client
**What Changed:** Fixed semantic mismatch between Airtable column names and their display meanings.

**The Problem:**
- Airtable "Client" column was being displayed as "Production Company" (incorrect)
- Airtable "Brand" column was being displayed as "Brand" but semantically meant "Client"
- Cached data broke this display because field mappings were unclear

**The Solution:**
- Renamed Airtable columns: "Client" → "Production Company", "Brand" → "Client"
- Updated code to use `productionCompany` and `client` fields correctly
- Updated all display logic: Client shows first (brand/agency), Production Company shows second

**Updated Files:**
- `netlify/functions/scheduled-sync.mjs` - Field mapping from Airtable
- `types.ts` - TypeScript interface updated
- `components/views/ProjectDetailView.tsx` - Display logic fixed
- `components/views/IndexView.tsx` - List/grid display priorities
- `components/SEO.tsx` - Structured data metadata
- `data/staticData.ts` - Fallback data structure
- `theme.ts` - Updated comments for clarity

**Display Logic:**
- **ProjectDetailView:** Shows "Client" label for `project.client`, "Production Company" for `project.productionCompany`
- **IndexView:** Prioritizes `project.client` (brand), falls back to `project.productionCompany`
- **SEO:** Uses `productionCompany` for structured data, `client` for sponsor field (commercials)

**Impact:** Field labels now match their semantic meaning. Airtable column names align with code property names.

---

### November 27, 2025 - Video Thumbnail Fallback Fix
**What Changed:** Fixed blank thumbnails for projects with videos but no still images, including Vimeo private videos.

**Details:**
- Projects with video URLs but no gallery images now correctly show video thumbnails
- Changed `totalImages` parameter from `gallery.length || 2` to `gallery.length || 0`
- When `totalImages = 0`, OptimizedImage skips looking for non-existent WebP files
- Directly uses video thumbnail URL (YouTube/Vimeo) as fallback
- Applies to HomeView, IndexView (both list and grid modes)

**Vimeo Private Video Support:**
- Updated `getVideoId()` to capture hash parameter from private Vimeo URLs (e.g., `vimeo.com/881242794/e394444e54`)
- Updated `fetchVideoThumbnail()` to use Vimeo OEmbed API for private videos with hash
- Public Vimeo videos continue using v2 API (faster, no authentication)
- OEmbed API extracts thumbnail from full URL including hash parameter

**Technical:**
- Backend (`scheduled-sync.mjs`) now properly handles both public and private Vimeo URLs
- Frontend issue fixed: passing `totalImages=2` caused lookup for `project-{id}-0.webp` (doesn't exist)
- Now passes `totalImages=0` → immediately uses `heroImage` (video thumbnail URL)
- Added debug logging to track thumbnail fetching success/failure

**Video URL Formats Supported:**
- YouTube: All standard formats (`youtube.com/watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`)
- Vimeo Public: `vimeo.com/123456` or `vimeo.com/video/123456`
- Vimeo Private: `vimeo.com/123456/abcd1234` (with hash parameter)

**Impact:** Projects with only video links (including private Vimeo) now display thumbnails correctly across all views.

**Files Updated:** 
- `components/views/HomeView.tsx` - Fixed hero and grid thumbnails
- `components/views/IndexView.tsx` - Fixed list and grid view thumbnails (needs update for totalImages=0)
- `components/common/OptimizedImage.tsx` - Skip WebP lookup when totalImages=0
- `netlify/functions/scheduled-sync.mjs` - Vimeo private video support + debug logging

---

### November 26, 2025 - Image Loading Optimization
**What Changed:** Fixed image lazy loading with clean fade-in effect.

**Details:**
- Removed shimmer loading animation that caused flickering when switching categories
- Implemented simple opacity transition for smooth fade-in
- Images start at `opacity-0` to avoid broken icon flash during lazy load
- Fixed fallback URL handling to properly reset loading state
- Preserved hover breathing animations on thumbnails (no interference with parent transitions)
- Component uses `useMemo` for optimized URL generation

**Impact:** Smooth, flicker-free experience when navigating between categories, clean fade-in on initial load, and proper hover scale animations.

**Files Updated:** `components/common/OptimizedImage.tsx`

---

### November 26, 2025 - Procedural Hero Animation, CTA, and Fallbacks
**What Changed:** Procedural SVG artwork is now used as an animated, textless hero when no video/gallery is present. The contact CTA is interactive (routes to About), and the Next Project panel falls back to a procedural visual if it lacks an image.

**Details:**
- Textless hero art via `useProceduralThumbnail(title, year, type, undefined, undefined, { showTitle: false, showMetadata: false })`
- Animated look: `hero-anim` (hue rotation) and `hero-anim-gradient` (gradient drift) injected in `GlobalStyles.tsx`
- Visual punch: procedural slide adds mild `saturate`, `brightness`, and `contrast` boosts
- Hero CTA: when no video, a button appears that navigates to `/about` and tracks `contact_cta_click`
  - Mobile: CTA centered in hero (no overlap with title)
  - md+: CTA bottom-right (`md:bottom-24 md:right-12`)
- Next Project fallback: if no image/video, render textless procedural background via `generateProceduralThumbnail()`

**Files Updated:** `components/views/ProjectDetailView.tsx`, `components/GlobalStyles.tsx`, `components/ProceduralThumbnail.tsx`, `utils/thumbnailGenerator.ts`, `docs/PROCEDURAL_THUMBNAILS.md`, `PROCEDURAL_THUMBNAILS_SUMMARY.md`, `QUICKSTART_THUMBNAILS.md`

---

### November 26, 2025 - Performance Optimization (PageSpeed Improvements)
**What Changed:** Major performance improvements based on PageSpeed Insights analysis.

**Optimizations:**
- **Image Settings:** Reduced image width (1600px→1200px) and quality (92%→82%) for 40% smaller files
- **Browser Caching:** Added 1-year cache headers for static assets (images, JS, CSS)
- **Font Loading:** Implemented async font loading to eliminate render-blocking
- **Accessibility:** Removed `user-scalable=no` from viewport meta
- **Vite Config:** Added dependency pre-bundling for faster HMR

**Impact:** Expected PageSpeed score improvement from 67 to 85+. Page weight reduced by ~31% (4,658 KiB → ~3,200 KiB).

**Files Updated:** `scripts/optimize-images.mjs`, `netlify.toml`, `index.html`, `vite.config.ts`

---

### November 26, 2025 - Image Optimization for Social Sharing
**What Changed:** Fixed social sharing meta tags (Open Graph, Twitter Cards) to use optimized WebP images instead of original Airtable JPEGs.

**Fixes:**
- Updated `ProjectDetailView.tsx` to pass optimized image URL to SEO component
- Updated `BlogPostView.tsx` to pass optimized image URL to SEO component
- Social shares now use cached WebP images (smaller file size, faster loading)
- Maintains fallback to original URLs if optimized version doesn't exist

**Impact:** Social media previews now load faster and use less bandwidth. All images across entire site (display + meta tags) now consistently use optimized WebP format.

**Files Updated:** `components/views/ProjectDetailView.tsx`, `components/views/BlogPostView.tsx`

---

### November 26, 2025 - Netlify Build Cache Configuration
**What Changed:** Fixed image caching system to properly cache all 30+ optimized images between builds.

**Fixes:**
- Added `netlify-plugin-cache` to `package.json` devDependencies
- Updated cache paths to include both `public/images/portfolio` and `dist/images/portfolio`
- Cache now properly restores all optimized images (was only caching 2 files before)

**Impact:** Build times significantly reduced - no longer re-downloads and re-optimizes unchanged images from Airtable on every build. Incremental optimization only processes new images.

**Files Updated:** `package.json`, `netlify.toml`

---

### November 26, 2025 - GitHub Actions Workflow Fixes
**What Changed:** Fixed permission issues and double deployment in GitHub Actions workflows.

**Fixes:**
- Added `permissions: contents: write` to manual deploy workflow
- Removed duplicate Netlify build hook call (was causing two deploys)
- Workflow now only creates `[deploy]` marker commit (Netlify auto-detects)
- Added user's reason to commit message for better tracking

**Impact:** Manual deploys now trigger only ONE Netlify build instead of two, saving build minutes.

**Files Updated:** `.github/workflows/manual-deploy.yml`

---

### November 26, 2025 - Code Refactoring: Shared Utilities
**What Changed:** Eliminated ~590 lines of duplicate code by consolidating utilities into centralized modules.

**New Shared Utilities:**
- `utils/videoHelpers.ts` + `.mjs` - Video URL parsing, thumbnails, embed generation
- `utils/textHelpers.ts` + `.mjs` - Text processing, normalization, reading time
- `utils/slugify.mjs` - Slug generation for backend

**Impact:** All video/text processing now uses single source of truth. Changes to video parsing (e.g., adding TikTok support) only need updating in one place.

**Files Updated:** `cmsService.ts`, `get-data.js`, `sitemap.js`, `generate-share-meta.mjs`, `vite.config.ts`

**See:** `REFACTORING_SUMMARY.md` for complete details.

---

## 🎯 Project Overview

### What This Is
A production-ready portfolio website for **Gabriel Athanasiou**, a London/Athens-based film director. The site showcases:
- **Film projects** - Narrative, Commercial, Music Videos, Documentary
- **Journal/blog posts** - Behind-the-scenes, insights, updates
- **About/contact** - Bio, representatives, social links
- **Showreel video** - Featured work compilation

### Core Philosophy & Architecture

**Headless CMS Approach:**
- Content managed in Airtable (no code deployments for content updates)
- Scheduled sync updates data daily (midnight UTC)
- Changes appear within 24 hours automatically

**Performance-First Design:**
- CDN caching at multiple levels (browser, edge, origin)
- Image optimization via Cloudinary (WebP/AVIF auto-format)
- Page loads: 100-300ms (10x faster than direct Airtable calls)
- 99.9% fewer API calls (cached at edge)

**Resilient & Fault-Tolerant:**
- Three-tier fallback system (Cloudinary → Local WebP → Airtable)
- Static data fallback if all services fail
- Stale-while-revalidate keeps site available during outages
- Error boundaries prevent full-page crashes

**SEO & Analytics Optimized:**
- Dynamic meta tags for social sharing
- Google Analytics 4 integration
- Structured data (Schema.org)
- Sitemap auto-generated daily
- Edge functions for SSR-like meta tag injection

**Theme-Driven Styling:**
- Global design system in `theme.ts`
- Consistent Tailwind utility classes
- No scattered inline styles
- Single source of truth for all visual properties

### Technology Stack Summary

**Frontend:** React 19 + TypeScript + Vite + React Router  
**Backend:** Airtable (CMS) + Netlify Functions (API/Sync)  
**CDN:** Netlify (hosting) + Cloudinary (images)  
**Analytics:** Google Analytics 4  
**Deployment:** Netlify with GitHub Actions CI/CD

### Key Metrics

**Performance (November 2025):**
- PageSpeed Score: 85+ ✅
- Page Load: 100-300ms ✅
- Page Weight: 1.5-2.4MB (down from 6-10MB) ✅
- LCP: < 1.8s ✅

**Content:**
- 40+ film projects
- Multiple journal posts
- Dynamic showreel
- Responsive design (mobile-first)

---

## ⚠️ CRITICAL: Read This First

**FOR ALL AI AGENTS WORKING ON THIS CODEBASE:**

1. **📖 READ THIS ENTIRE DOCUMENT BEFORE MAKING ANY CHANGES**
2. **✏️ UPDATE THIS DOCUMENTATION AFTER EVERY CHANGE YOU MAKE**
3. **🔍 Verify documentation accuracy matches current code state**
4. **🚫 NEVER commit code without updating relevant documentation**

**Documentation-First Workflow:**
- Before editing code → Read relevant sections here
- After editing code → Update this guide immediately
- After completing a feature → Document the change in detail
- Before committing → Verify all documentation is current
- If you change behavior → Update the relevant section explaining how it works

**This guide is the source of truth for the entire codebase architecture.**

**Last Major Update:** November 27, 2025 - Cloudinary cache invalidation for quality updates

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & System Design](#architecture--system-design)
3. [Tech Stack](#tech-stack)
4. [Data Structures & Schema](#data-structures--schema)
5. [Key Systems](#key-systems)
6. [Environment Setup](#environment-setup)
7. [Development Workflow](#development-workflow)
8. [Deployment & CI/CD](#deployment--cicd)
9. [Performance & Optimization](#performance--optimization)
10. [Troubleshooting](#troubleshooting)
11. [Common Tasks](#common-tasks)
12. [Changelog](#changelog)

---

## 📝 Changelog

All major changes are documented here in reverse chronological order (newest first).

---

## 🏗️ Architecture & System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  React SPA (Vite) + React Router + Client-side Analytics    │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ├─ Cached Data (5 min browser, 1h CDN)
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                      NETLIFY CDN/EDGE                        │
│  Edge Functions (Meta Tags) + CDN Cache + Static Assets     │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ├─ Cache Miss or Scheduled Sync
                    ↓
┌─────────────────────────────────────────────────────────────┐
│                    NETLIFY FUNCTIONS                         │
│  get-data.js (API) + scheduled-sync.mjs (Daily)             │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ├─ Fetch Content + Upload Images
                    ↓
┌──────────────────────────┬──────────────────────────────────┐
│    AIRTABLE (CMS)        │    CLOUDINARY (Images CDN)       │
│  Projects, Journal,      │  Optimized WebP/AVIF Images      │
│  Settings, Awards        │  Auto Format + Quality           │
└──────────────────────────┴──────────────────────────────────┘
```

### CDN Cache Architecture

**Before (Client-Side Fetching):**
```
Browser → Airtable API (every page load)
- ❌ Slow (~2-5 seconds)
- ❌ Rate limits
- ❌ API keys exposed
```

**After (CDN-Cached Server-Side):**
```
Browser → Netlify CDN → Function (if cache miss) → Airtable
- ✅ Fast (~100-300ms)
- ✅ No rate limits
- ✅ API keys secure
- ✅ Automatic cache invalidation
```

**Cache Headers Strategy:**
```javascript
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
```

- `max-age=300`: Browser caches for 5 minutes
- `s-maxage=3600`: CDN caches for 1 hour
- `stale-while-revalidate=86400`: Serve stale for 24h while updating in background

**Performance Benefits:**
- **10x faster page loads** (2-5s → 100-300ms)
- **99.9% fewer Airtable API calls** (only on cache miss)
- **Page weight reduced 70-75%** with Cloudinary image optimization

### Request Flow

1. **Initial Load:** Browser requests `index.html` → React hydrates → `App.tsx` calls `cmsService.fetchAll()`
2. **CMS Service:** Tries CDN cache → Netlify Function → Airtable API → Static fallback
3. **Routing:** `react-router-dom` handles navigation (SPA mode, no page reloads)
4. **Analytics:** `analyticsService` tracks page views and events
5. **SEO:** `<SEO>` component updates meta tags dynamically per route
6. **Background Sync:** `useBackgroundDataSync` checks for updates every 30 minutes

### Image Delivery Architecture

**Three-Tier Fallback System:**

1. **Primary: Cloudinary CDN** (Production)
   - Auto format selection (WebP/AVIF based on browser)
   - Quality: `auto:best` (highest quality with smart compression)
   - Responsive widths: 600px → 1920px depending on context
   - Retina support: `dpr_auto`
   - Global CDN delivery

2. **Secondary: Local WebP** (Build-time optimization)
   - Pre-generated WebP files from Airtable images
   - Served from `/public/images/portfolio/`
   - 1200px width @ 90% quality

3. **Tertiary: Airtable URLs** (Original source)
   - Direct Airtable attachment URLs
   - JPEG/PNG originals

**Image Processing Flow:**
```
Airtable (Original) → Scheduled Sync → Cloudinary Upload (q:auto:best)
                                    ↓
                              Cloudinary CDN → Transformations
                                    ↓
                              Browser (WebP/AVIF optimized)
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19.2.0** - UI library
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool & dev server
- **React Router 6.22.3** - Client-side routing
- **Tailwind CSS** - Utility-first styling (via `theme.ts` mappings)

### Backend/Infrastructure
- **Airtable** - Headless CMS (database)
- **Cloudinary** - Image CDN & optimization (25GB free tier)
- **Netlify** - Hosting, CDN, Functions, Edge Functions
- **Sharp** - Local image optimization (build-time)
- **Google Analytics 4** - User analytics

### Key Dependencies
```json
{
  "airtable": "^0.12.2",
  "cloudinary": "^2.5.1",
  "react-router-dom": "^6.22.3",
  "dotenv": "^17.2.3",
  "sharp": "^0.33.2"
}
```

---

## 📊 Data Structures & Schema
                    ├─► Netlify CDN (Static Assets)
                    │   └─► Optimized WebP Images
                    │
                    ├─► Netlify Functions (get-data.js)
                    │   └─► Cloudinary CDN (portfolio-data.json)
                    │
                    └─► Fallback Hierarchy:
                        1. staticData.ts (emergency fallback)
```

### Request Flow

1. **Initial Load:** Browser requests `index.html` → React hydrates → `App.tsx` calls `cmsService.fetchAll()`
2. **CMS Service:** Fetches data directly from Cloudinary CDN → Falls back to static data if Cloudinary unavailable
3. **Routing:** `react-router-dom` handles navigation (SPA mode, no page reloads)
4. **Analytics:** `analyticsService` tracks page views and events
5. **SEO:** `<SEO>` component updates meta tags dynamically per route

---

## 🛠️ Tech Stack

### Frontend
- **React 19.2.0** - UI library
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool & dev server
- **React Router 6.22.3** - Client-side routing
- **Tailwind CSS** - Utility-first styling (via `theme.ts` mappings)

### Backend/Infrastructure
- **Airtable** - Headless CMS (database)
- **Netlify** - Hosting, CDN, Functions, Edge Functions
- **Sharp** - Image optimization (build-time)
- **Google Analytics 4** - User analytics

### Key Dependencies
```json
{
  "airtable": "^0.12.2",
  "sharp": "^0.34.5",
  "@netlify/functions": "^2.8.1",
  "dotenv": "^17.2.3"
}
```

---

## 🔑 Key Systems

### 1. CMS Service (`services/cmsService.ts`)

**Purpose:** Fetch and normalize data from Airtable with fallback strategies.

**Methods:**
- `fetchAll()` → Returns `{ projects: Project[], posts: BlogPost[], config: HomeConfig }`
- `getProjects()` → Returns just projects
- `getBlogPosts()` → Returns just posts
- `getHomeConfig()` → Returns just config

**Data Sources (in order of priority):**
1. **Cloudinary CDN** - Primary source for all static data (portfolio-data.json, share-meta.json)
2. **staticData.ts** - Hardcoded fallback if Cloudinary fails

**Architecture:** The site fetches all data directly from Cloudinary CDN. There are no local file fallbacks in production. Cloudinary serves as the single source of truth for static content delivery.

**Key Features:**
- Resolves YouTube/Vimeo URLs (handles vanity URLs, hashes, embeds)
- Auto-generates thumbnails from video URLs
- Normalizes project types (Narrative/Commercial/Music Video/Documentary)
- Parses credits from text format (`Role: Name`)
- **Filters credits by Allowed Roles** - Only shows your roles that match Settings
- Filters projects by allowed roles (from Settings table)
- Attaches unique slugs for SEO-friendly URLs

**Credits System:**
- Reads "Role" field from Projects (your roles on the project)
- Filters these roles against "Allowed Roles" from Settings table
- Example: If Allowed Roles = `["Director"]` and Project has `["Director", "Cinematographer"]`
  - Only "Director - Gabriel Athanasiou" appears in credits
  - Other roles from "Credits Text" field are shown unchanged
- This ensures your credits only show the roles you want to highlight

**Important Notes:**
- Caches result in memory (`cachedData`) to avoid redundant calls
- Instagram integration is DISABLED by default (toggle via `ENABLE_INSTAGRAM_INTEGRATION`)
- Uses OEmbed for private/unlisted Vimeo videos
- **Imports shared utilities** from `utils/videoHelpers` and `utils/textHelpers` (refactored Nov 2025)

---

### 2. Shared Utilities System (`utils/`)

**Purpose:** Centralized, reusable utilities used across frontend, backend, and build scripts.

#### Architecture Overview
- **TypeScript versions** (`.ts`) - Used by frontend React code
- **ES Module versions** (`.mjs`) - Used by Netlify functions and Node.js scripts
- **Single source of truth** - Changes apply everywhere automatically

#### A. Video Helpers (`utils/videoHelpers.ts` / `.mjs`)

**Functions:**
```typescript
getVideoId(url: string): { type: 'youtube' | 'vimeo' | null, id: string | null, hash?: string | null }
// Extracts video ID from various URL formats
// Supports: YouTube (watch, embed, youtu.be, shorts, live)
//          Vimeo (with private hash support)

resolveVideoUrl(url: string): Promise<string>
// Resolves vanity URLs to canonical format
// Uses OEmbed API for Vimeo vanity URLs

getEmbedUrl(url: string, autoplay?: boolean, muted?: boolean): string | null
// Generates iframe embed URL with optimal parameters
// Returns null if URL is invalid

fetchVideoThumbnail(url: string): Promise<string>
// Gets best quality thumbnail URL
// YouTube: maxresdefault.jpg
// Vimeo: OEmbed API → vumbnail.com fallback
```

**Used By:**
- `services/cmsService.ts` - Data fetching and processing
- `components/VideoEmbed.tsx` - Video player component
- `netlify/functions/get-data.js` - Server-side data API
- `netlify/functions/scheduled-sync.mjs` - Scheduled data sync
- `scripts/generate-share-meta.mjs` - Legacy build script (now in scheduled-sync)

**Why Both Versions?**
- `.ts` version uses browser `fetch()` API
- `.mjs` version uses Node.js `https` module for server compatibility

#### B. Text Helpers (`utils/textHelpers.ts` / `.mjs`)

**Functions:**
```typescript
normalizeTitle(title: string): string
// Converts "some_title-here" → "Some Title Here"
// Title case with space normalization

parseCreditsText(text: string): Array<{ role: string, name: string }>
// Parses "Director: John Doe, Producer: Jane Smith"
// Supports comma, pipe, and newline delimiters

escapeHtml(text: string): string
// Sanitizes HTML for safe meta tag injection
// Used by edge functions for dynamic meta tags

calculateReadingTime(content: string): string
// Returns "X min read" based on 225 WPM
// Strips HTML tags for accurate word count
```

**Used By:**
- `services/cmsService.ts` - Title normalization, credits parsing
- `netlify/functions/get-data.js` - Server-side processing
- `netlify/functions/sitemap.js` - Sitemap generation
- `netlify/functions/scheduled-sync.mjs` - Scheduled data sync
- `netlify/edge-functions/meta-rewrite.ts` - Dynamic meta tags
- `scripts/generate-share-meta.mjs` - Legacy build script (now in scheduled-sync)

#### C. Slug Helpers (`utils/slugify.ts` / `.mjs`)

**Functions:**
```typescript
slugify(input: string): string
// Converts "My Project 2024" → "my-project-2024"
// Handles diacritics, special chars, multiple hyphens

makeUniqueSlug(base: string, used: Set<string>, fallbackId?: string): string
// Ensures unique slugs with collision handling
// Adds numeric suffix or record ID if needed
```

**Collision Handling:**
1. Try base slug: `my-project`
2. Try with fallback ID: `my-project-abc123`
3. Try numeric suffix: `my-project-2`, `my-project-3`, etc.

**Used By:**
- `services/cmsService.ts` - Frontend slug generation
- `netlify/functions/get-data.js` - Backend slug generation
- `netlify/functions/sitemap.js` - Sitemap slug generation

#### D. Import Strategy

**Frontend (TypeScript):**
```typescript
import { getVideoId, fetchVideoThumbnail } from '../utils/videoHelpers';
import { normalizeTitle } from '../utils/textHelpers';
```

**Backend (Node.js):**
```javascript
import { getVideoId, getVideoThumbnail } from '../../utils/videoHelpers.mjs';
import { normalizeTitle } from '../../utils/textHelpers.mjs';
```

**Vite Configuration:**
- Extension resolution order: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.json`
- Ensures TypeScript files are preferred in frontend imports
- Prevents .mjs from being used in browser builds

#### Benefits of This Architecture
✅ **Single Source of Truth** - Fix bugs once, apply everywhere  
✅ **Type Safety** - TypeScript catches errors at compile time  
✅ **Easy Testing** - Utilities can be unit tested independently  
✅ **Consistent Behavior** - Same logic across frontend/backend  
✅ **Easy Feature Addition** - Add TikTok support? Update one file  

**See:** `REFACTORING_SUMMARY.md` for complete refactoring details.

---

### 3. Analytics Service (`services/analyticsService.ts`)

**Purpose:** Google Analytics 4 integration with privacy-friendly defaults.

**Setup:** Initialized once in `App.tsx`:
```typescript
analyticsService.init('G-EJ62G0X6Q5');
```

**Key Methods:**
- `trackPageView(path, title)` - Called on route change
- `trackVideoPlay(projectId, projectTitle)` - Video engagement
- `trackSocialShare(platform, title, url)` - Share button clicks
- `trackExternalLink(label, url)` - External link clicks
- `trackProjectView(projectId, projectTitle, projectType)` - Project detail views
- `trackBlogPostView(postId, postTitle)` - Blog post views

**Privacy Features:**
- `anonymize_ip: true`
- `allow_google_signals: false`
- `allow_ad_personalization_signals: false`

**Usage Example:**
```typescript
// In VideoEmbed.tsx
analyticsService.trackVideoPlay(project.id, project.title);
```

---

### 4. Image Optimization System

**Components:**

#### A. Build-Time Optimization (`scripts/optimize-images.mjs`)
- Runs during `npm run build` (via `npm run optimize:images`)
- Fetches featured projects + public journal images from Airtable
- Downloads and converts to WebP format (1600px wide, 92% quality)
- Saves to `/public/images/portfolio/` with naming:
  - Single image: `project-{recordId}.webp` or `journal-{recordId}.webp`
  - Multiple images: `project-{recordId}-0.webp`, `project-{recordId}-1.webp`, etc.
- **Incremental:** Only processes NEW images (skips existing)
- **Automatic Cleanup:** Deletes orphaned images removed from Airtable
  - Compares existing files with current Airtable content
  - Removes WebP files for deleted projects/posts
  - Prevents storage waste from old content

#### B. Runtime Components (`components/common/OptimizedImage.tsx`)
```tsx
<OptimizedImage
  recordId={record.id}
  fallbackUrl={record.heroImage}
  type="project" // or "journal"
  index={0}
  totalImages={1}
  alt={record.title}
  className="w-full h-full object-cover"
  loading="lazy"
/> 
```
- Standardized image component for all views
- Serves optimized local WebP (`/images/portfolio/{type}-{recordId}.webp`)
- Clean fade-in effect (starts invisible to avoid broken icon during lazy load)
- Automatic fallback to Airtable URL on error
- Preserves parent component's hover animations (breathing scale effects)
- Minimizes boilerplate and keeps UX consistent

**Usage locations (required):**
- `HomeView.tsx` — Hero, featured grid, featured journal
- `IndexView.tsx` — Filmography thumbnails (list + grid)
- `BlogView.tsx` — Journal listing covers
- `BlogPostView.tsx` — Post hero + related project thumbnail

**Special cases (keep helper functions):**
- `SEO.tsx` — Keep using `getOptimizedImageUrl()` for meta image URLs
- `ProjectDetailView.tsx` — Slideshow uses absolute positioning; retain current approach or wrap with an absolute-friendly variant of `OptimizedImage`
- `Cursor.tsx` — Hover preview uses dynamic state; keep existing logic or adapt later

#### C. Manual Verification (`scripts/test-image-fetch.mjs`)
```bash
npm run test:images
```
- Tests Airtable connection and image URL retrieval
- Does NOT optimize, just verifies data

---

### 5. SEO System (`components/SEO.tsx` + Edge Function)

**Purpose:** Dynamic meta tags and structured data for social sharing and search engines.

**Architecture (Server + Client):**

**Server-Side (Edge Function):**
- `netlify/edge-functions/meta-rewrite.ts` intercepts `/work/*` and `/journal/*` requests
- Fetches data from `portfolio-data.json` (has all fields)
- Generates and injects into HTML before it reaches browser:
  - Meta tags (title, OG, Twitter Card)
  - Canonical URLs
  - Structured data (JSON-LD):
    - **Movie** schema for narrative projects
    - **VideoObject** schema for commercials/music videos
    - **Article** schema for blog posts
    - **Person** schema for homepage
- Search engines see complete SEO data on first request (no JavaScript needed)

**Client-Side (React Component):**
- `components/SEO.tsx` updates meta tags during SPA navigation
- Handles title, OG tags, canonical URL changes
- Does NOT generate structured data (handled by edge function)
- Keeps social previews working during client-side routing

**Features:**
- Rich structured data with director info, credits, awards, genres
- Proper ISO 8601 date formatting (releaseDate > workDate > year)
- Uses optimized WebP images for social sharing previews
- Per-route customization
- 100% static - no runtime API calls

**Usage:**
```tsx
<SEO 
  title="Project Title" 
  description="Project description..."
  image={getOptimizedImageUrl(project.id, project.heroImage, 'project', 0)}
  type="article"
  project={project} // Optional: for rich metadata
/>
```

**Important:** Always pass optimized image URLs to the `image` prop using `getOptimizedImageUrl()`. This ensures social media previews (Facebook, Twitter, LinkedIn) use smaller WebP files instead of large Airtable JPEGs.

**Testing:**
```bash
# Test structured data in HTML
curl https://your-site.com/work/project-slug | grep -A 100 "application/ld+json"

# Validate with Google Rich Results Test
https://search.google.com/test/rich-results
```

---

### 6. Theme System (`theme.ts`)

**Purpose:** Centralized design system. All visual styling controlled here.

**Key Sections:**
- **Colors:** Background, text, accent, selection
- **Typography:** Font scales for h1-h3, body, meta, nav
- **Layout:** Header height, padding, hero dimensions
- **Filmography:** Grid/list view settings, tabs, columns
- **Project Detail:** Sidebar, credits, next project preview
- **Animations:** Durations, easing functions, stagger delays
- **UI Elements:** Buttons, cursors, close button positioning

**Example:**
```typescript
export const THEME = {
  hero: {
    height: "h-screen",
    overlayOpacity: 0.1,
    textAlignment: "text-left"
  }
}
```

**Usage in Components:**
```tsx
import { THEME } from '../theme';
<div className={THEME.hero.height} />
```

---

## 📊 Data Flow

### 🗺️ Complete Data Structure Map

This map shows exactly how data flows from Airtable → Backend Processing → Frontend Display:

```
AIRTABLE COLUMN NAME          →  CODE PROPERTY NAME    →  FRONTEND DISPLAY LABEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Projects Table:
  "Production Company" (link)  →  productionCompany     →  "Production Company"
  "Client" (text)              →  client                →  "Client"
  "Name" (text)                →  title                 →  [Project Title]
  "Project Type" (select)      →  type                  →  [Filmography Tab]
  "Genre" (multi-select)       →  genre[]               →  "Genre" tags
  "Release Date" (date)        →  year                  →  [Year display]
  "About" (long text)          →  description           →  [Description paragraphs]
  "Gallery" (attachments)      →  gallery[]             →  [Image slideshow]
  "Video URL" (text)           →  videoUrl              →  [Video player]
  "Role" (multi-select)        →  [filtered credits]    →  [Your credits only]
  "Credits Text" (text)        →  credits[]             →  [All credits display]
  "Festivals" (link)           →  awards[]              →  "Awards & Festivals"
  "External Links" (text)      →  externalLinks[]       →  [Link buttons]
  "Related Article" (link)     →  relatedArticleId      →  "Behind the Scenes" link
  "Feature" (checkbox)         →  [filter only]         →  [Visibility control]
  "Front Page" (checkbox)      →  isFeatured            →  [Home page display]

📰 Journal Table:
  "Title" (text)               →  title                 →  [Post Title]
  "Date" (date)                →  date                  →  [Publication date]
  "Content" (long text)        →  content               →  [Article body]
  "Cover Image" (attachment)   →  imageUrl              →  [Hero image]
  "Tags" (multi-select)        →  tags[]                →  [Tag pills]
  "Related Project" (link)     →  relatedProjectId      →  [Project card]
  "Links" (text)               →  relatedLinks[]        →  [External links]
  "Status" (select)            →  [filter: Public only] →  [Visibility control]

⚙️ Settings Table:
  "Showreel URL" (text)        →  config.showreel.videoUrl        →  [Home hero video]
  "Showreel Enabled" (checkbox) →  config.showreel.enabled        →  [Show/hide showreel]
  "Contact Email" (email)      →  config.contact.email            →  [About page]
  "Rep UK" (text)              →  config.contact.repUK            →  [About page]
  "Rep USA" (text)             →  config.contact.repUSA           →  [About page]
  "Instagram URL" (url)        →  config.contact.instagram        →  [Social links]
  "Vimeo URL" (url)            →  config.contact.vimeo            →  [Social links]
  "LinkedIn URL" (url)         →  config.contact.linkedin         →  [Social links]
  "Bio" (long text)            →  config.about.bio                →  [About page bio]
  "About Image" (attachment)   →  config.about.profileImage       →  [About page photo]
  "Allowed Roles" (multi-sel)  →  config.allowedRoles[]           →  [Credit filtering]
  "Default OG Image" (attach)  →  config.defaultOgImage           →  [Social share fallback]

🏆 Festivals/Awards Table:
  "Name" (text)                →  [resolved to string]  →  [Award display name]
  "Display Name" (text)        →  [override if exists]  →  [Shortened festival name]

📊 Client Book Table:
  "Company" (text)             →  [resolved via link]   →  [Production company name]
```

### Key Processing Rules

**Production Company Resolution:**
- Airtable stores a **link** to the "Client Book" table
- Backend resolves the link ID → "Company" field (primary field name)
- Stored as `productionCompany` string in cached data
- Fallback chain: `'Company'` → `'Company Name'` → `'Client'` for field name flexibility

**Client Field:**
- Airtable stores **plain text** (not a link)
- Passed directly through as `client` string
- Used for brand/agency names in commercials

**Display Priority:**
- **IndexView (list/grid):** Shows `client` first, falls back to `productionCompany`
- **ProjectDetailView:** Shows both fields with proper labels
  - "Client" section: Shows `project.client` (brand/agency)
  - "Production Company" section: Shows `project.productionCompany` (producer)

**Credits Filtering:**
- "Role" field (your roles) is filtered by "Allowed Roles" from Settings
- "Credits Text" (all crew) is parsed and shown unfiltered
- Only your matching roles appear in credits list

---

### Projects Data Model (`types.ts`)

```typescript
interface Project {
  id: string;              // Airtable record ID
  title: string;           // Normalized title
  slug?: string;           // URL-friendly slug (auto-generated)
  type: ProjectType;       // Narrative | Commercial | Music Video | Documentary
  genre?: string[];        // ["Sci-Fi", "Drama"]
  productionCompany: string; // Production company (resolved from Production Company field → Client Book table)
  client?: string;         // Client/brand/agency name (optional)
  year: string;            // Release year (YYYY) - extracted from releaseDate or workDate
  releaseDate?: string;    // **NEW:** Full release date from Airtable (YYYY-MM-DD format)
  workDate?: string;       // **NEW:** Full work/production date from Airtable (YYYY-MM-DD format)
  description: string;     // Project description
  isFeatured: boolean;     // Show on home page? (true if Display Status = Featured or Hero)
  isHero?: boolean;        // **NEW:** Eligible for hero slot? (true only if Display Status = Hero)
  
  // Media
  heroImage: string;       // Main thumbnail (gallery[0] or video thumbnail)
  videoUrl?: string;       // Main video (YouTube/Vimeo)
  additionalVideos?: string[]; // Extra videos from External Links
  gallery: string[];       // Image URLs from Gallery field
  
  // Metadata
  awards?: string[];       // Resolved from Festivals field
  externalLinks?: ExternalLink[]; // IMDb, LinkedIn, etc.
  relatedArticleId?: string; // Link to Journal entry
  
  // Credits
  credits: Credit[];       // [{ role: "Director", name: "Gabriel" }]
}
```

**Field Notes:**
- `year`: Auto-extracted from `releaseDate` OR `workDate` (first available)
- `isFeatured`: Derived from Display Status (Featured OR Hero = true, Portfolio Only/Hidden = false)
- `isHero`: Derived from Display Status (Hero only = true, all others = false)
- `releaseDate` & `workDate`: Optional fields preserve full date info for advanced sorting/filtering
- Projects automatically sorted by date (newest first) at build time

### Airtable Schema

#### Projects Table (Required)
| Field | Type | Purpose |
|-------|------|---------|
| `Name` | Single Line Text | Project title |
| `Display Status` | Single Select | **NEW:** Hidden / Portfolio Only / Featured / Hero (replaces Front Page checkbox) |
| `Project Type` | Single Select | Narrative/Commercial/Music Video/Documentary |
| `Genre` | Multiple Select | ["Sci-Fi", "Drama"] |
| `Production Company` | Link to Client Book | Production company that produced the work |
| `Client` | Single Line Text | Client/brand/agency name |
| `Release Date` | Date | **NEW:** Full release date (YYYY-MM-DD) - primary sort field |
| `Work Date` | Date | **NEW:** Production/work date (YYYY-MM-DD) - fallback if no release date |
| `About` | Long Text | Description |
| `Gallery` | Attachments | Images |
| `Video URL` | Long Text | YouTube/Vimeo URLs (comma-separated) |
| `Role` | Multiple Select | Gabriel's role(s) |
| `Credits Text` | Long Text | `Role: Name, Role: Name` |
| `Festivals` | Link to Awards | Award names |
| `External Links` | Long Text | URLs (comma-separated) |
| `Related Article` | Link to Journal | Related blog post |

**Display Status Options (in order):**
1. **Hidden** - Project completely excluded from sync (drafts, unpublished work)
2. **Portfolio Only** - Syncs to site but not featured on homepage (sets `isFeatured: false`)
3. **Featured** - Appears on front page grid (sets `isFeatured: true`)
4. **Hero** - Eligible for hero slot on homepage (sets `isFeatured: true` and `isHero: true`)

**Date Fields:**
- **Release Date**: Official release/publication date (primary)
- **Work Date**: When the project was created/produced (fallback)
- **Year field**: Auto-extracted from Release Date OR Work Date (first available)
- **Sorting**: Projects automatically sorted by Release Date → Work Date (newest first)

#### Journal Table (Optional)
| Field | Type | Purpose |
|-------|------|---------|
| `Title` | Single Line Text | Post title |
| `Date` | Date | Publish date |
| `Status` | Single Select | Public / Scheduled / Draft |
| `Content` | Long Text | Markdown content |
| `Cover Image` | Attachments | Featured image |
| `Tags` | Multiple Select | Categories |
| `Related Project` | Link to Projects | Related project |
| `Links` | Long Text | External URLs |

#### Settings Table (Required)
| Field | Type | Purpose |
|-------|------|---------|
| `Showreel Enabled` | Checkbox | Show showreel on home? |
| `Showreel URL` | Single Line Text | Vimeo/YouTube URL |
| `Showreel Placeholder` | Attachments | Thumbnail |
| `Contact Email` | Email | Contact email |
| `Rep UK` | Single Line Text | UK representative |
| `Rep USA` | Single Line Text | USA representative |
| `Instagram URL` | URL | Instagram link |
| `Vimeo URL` | URL | Vimeo link |
| `LinkedIn URL` | URL | LinkedIn link |
| `Bio` | Long Text | About page bio |
| `About Image` | Attachments | Profile photo |
| `Allowed Roles` | Multiple Select | Filter projects by role |
| `Default OG Image` | Attachments | Fallback share image |

#### Awards/Festivals Table (Optional)
| Field | Type | Purpose |
|-------|------|---------|
| `Name` | Single Line Text | Festival full name |
| `Display Name` | Single Line Text | Optional override for display (shorter version) |

**Note:** Awards are linked from Projects → Festivals field. If a festival name is too long or needs custom formatting, add a "Display Name" field override in the Festivals table.

#### Client Book Table (Required for Production Companies)
| Field | Type | Purpose |
|-------|------|---------|
| `Company` | Single Line Text | Production company name |

**Note:** This table is linked from Projects → Production Company field. The sync functions check for `'Company'` field first, with fallbacks to `'Company Name'` or `'Client'` for schema flexibility.

---

## 📁 File Structure

```
gabriel-athanasiou-portfolio--TEST/
│
├── App.tsx                    # Main app component, routing, data fetching
├── index.tsx                  # Entry point, React root
├── theme.ts                   # Global design system (CRITICAL)
├── types.ts                   # TypeScript interfaces
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript config
├── package.json               # Dependencies & scripts
├── netlify.toml               # Netlify deployment config
│
├── components/
│   ├── Navigation.tsx         # Header navigation
│   ├── SEO.tsx                # Dynamic meta tags
│   ├── Cursor.tsx             # Custom cursor (desktop)
│   ├── ErrorBoundary.tsx      # React error boundary
│   ├── GlobalStyles.tsx       # Global CSS injection
│   ├── SocialShare.tsx        # Share buttons
│   ├── VideoEmbed.tsx         # YouTube/Vimeo player
│   ├── common/
│   │   └── CloseButton.tsx    # Reusable close button
│   └── views/
│       ├── HomeView.tsx       # Featured projects + showreel
│       ├── IndexView.tsx      # Filmography (grid/list)
│       ├── ProjectDetailView.tsx  # Project detail page
│       ├── BlogView.tsx       # Journal list
│       ├── BlogPostView.tsx   # Journal post detail
│       └── AboutView.tsx      # About page
│
├── services/
│   ├── cmsService.ts          # Airtable data fetching (CRITICAL)
│   │                          # 🔄 Now imports from utils/videoHelpers & textHelpers
│   ├── analyticsService.ts    # Google Analytics 4
│   └── instagramService.ts    # Instagram integration (disabled)
│
├── utils/
│   ├── videoHelpers.ts        # 🆕 Video URL parsing & thumbnails (frontend)
│   ├── videoHelpers.mjs       # 🆕 Video utilities (Node.js/backend)
│   ├── textHelpers.ts         # 🆕 Text processing utilities (frontend)
│   ├── textHelpers.mjs        # 🆕 Text utilities (Node.js/backend)
│   ├── slugify.ts             # Slug generation (frontend)
│   ├── slugify.mjs            # 🆕 Slug generation (Node.js/backend)
│   ├── imageOptimization.ts   # Image URL helpers
│   ├── markdown.ts            # Markdown parser
│   └── sitemapGenerator.ts    # Sitemap generation
│
├── data/
│   └── staticData.ts          # Emergency fallback data
│
├── scripts/
│   ├── lib/
│   │   ├── sync-core.mjs      # 🆕 Shared sync orchestration logic
│   │   ├── airtable-helpers.mjs # 🆕 Shared Airtable utilities
│   │   └── README.md          # 🆕 Documentation for shared library
│   ├── sync-data.mjs          # Sync from Airtable (uses sync-core)
│   ├── generate-share-meta.mjs # Generate share metadata
│   ├── generate-sitemap.mjs   # Generate sitemap
│   ├── sync-static-to-cloudinary.mjs # Upload static files to Cloudinary
│   ├── fix-cloudinary-preset.mjs # Cloudinary preset fix utility
│   ├── fix-cloudinary-urls.mjs # Cloudinary URL fix utility
│   └── ignore-netlify-build.sh # Selective deployment logic
│
├── .github/
│   └── workflows/
│       ├── sync-data.yml      # 🔄 Manual: Sync data & upload to Cloudinary
│       └── manual-deploy.yml  # 🔄 Manual: Trigger Netlify deployment
│
├── netlify/
│   ├── functions/
│   │   ├── sync-now.mjs       # 🔄 Webhook endpoint (uses sync-core)
│   │   ├── get-data.js        # Serves static portfolio data
│   │   └── sitemap.js         # Dynamic sitemap generation
│   ├── functions-backup/
│   │   └── airtable-sync.mjs.old # 🗃️ Archived (replaced by sync-core)
│   └── edge-functions/
│       └── meta-rewrite.ts    # SEO meta tags + structured data injection
│
├── public/
│   ├── _redirects            # Netlify redirects
│   ├── robots.txt            # SEO crawler rules
│   ├── share-meta.json       # Build-time manifest (generated)
│   └── images/
│       └── portfolio/         # Optimized images (WebP)
│
└── docs/                      # Additional documentation
    ├── ANALYTICS_SETUP.md
    ├── ANALYTICS_TESTING.md
    └── ENV_SETUP.md
```

---

## 🔧 Environment Setup

### Local Development Setup

#### 1. Prerequisites
- **Node.js**: v18 or higher (Netlify uses Node 18)
- **npm**: v8 or higher
- **Git**: For version control
- **Airtable Account**: For CMS access
- **Cloudinary Account** (optional): For image CDN

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Create Environment Variables

Create `.env.local` in the project root:

```bash
# .env.local (NEVER COMMIT THIS FILE)

# Airtable API Credentials (Required)
VITE_AIRTABLE_TOKEN=keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# For Backend Functions (Same values as above)
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX    # Same as VITE_AIRTABLE_TOKEN
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX    # Same as VITE_AIRTABLE_BASE_ID

# Google Analytics 4 (Optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Cloudinary (Optional - for image optimization)
CLOUDINARY_CLOUD_NAME=date24ay6
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
USE_CLOUDINARY=false  # Set to true to enable
```

**Getting Airtable Credentials:**
1. Go to https://airtable.com/account
2. Click **Generate API key** (or use existing)
3. Copy the API key (starts with `key...`)
4. Go to your base → Help → API documentation
5. Find your Base ID (starts with `app...`)

**Getting Google Analytics ID:**
1. Go to https://analytics.google.com
2. Admin → Data Streams → Web stream
3. Copy Measurement ID (format: `G-XXXXXXXXXX`)

**Getting Cloudinary Credentials:**
1. Sign up at https://cloudinary.com/users/register/free
2. Dashboard → Copy Cloud Name, API Key, API Secret

#### 4. Verify Setup

```bash
# Test environment variables loaded
npm run dev

# Check console for:
# ✅ "Vite dev server started"
# ✅ "Analytics initialized" (if GA configured)
```

### Environment Variables Reference

**Frontend (Vite - prefix with `VITE_`):**
- `VITE_AIRTABLE_TOKEN` - Airtable API key
- `VITE_AIRTABLE_BASE_ID` - Airtable base ID
- `VITE_GA_MEASUREMENT_ID` - Google Analytics measurement ID

**Backend (Netlify Functions - no prefix):**
- `AIRTABLE_API_KEY` - Airtable API key (same value as VITE_AIRTABLE_TOKEN)
- `AIRTABLE_BASE_ID` - Airtable base ID (same value as VITE_AIRTABLE_BASE_ID)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `USE_CLOUDINARY` - Enable/disable Cloudinary (`true`/`false`)

**Security Notes:**
- ✅ `.env.local` is already in `.gitignore` (never committed)
- ✅ Use different values for dev/production if needed
- ✅ Rotate keys if compromised
- ✅ Never share your `.env.local` file

### Netlify Environment Variables

For production deployment, add all environment variables to Netlify:

1. Go to **Netlify Dashboard** → Your site
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add a variable**
4. Add each variable from `.env.local` (without `VITE_` prefix for backend vars)

**Required for Production:**
```
VITE_AIRTABLE_TOKEN = keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX
AIRTABLE_API_KEY = keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX
CLOUDINARY_CLOUD_NAME = date24ay6
CLOUDINARY_API_KEY = your-api-key
CLOUDINARY_API_SECRET = your-api-secret
USE_CLOUDINARY = true  # Enable in production
```

---

## 💻 Development Workflow

### Environment Setup

1. **Install Dependencies:**
```bash
npm install
```

2. **Create `.env.local`:**
```bash
VITE_AIRTABLE_TOKEN=keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
GEMINI_API_KEY=xxxxx  # Optional, for AI features
```

3. **Start Dev Server:**
```bash
npm run dev
# Opens at http://localhost:8888 (Netlify Dev with Functions)
# Note: Vite runs on port 3000, but use 8888 for full functionality
```

### Development Commands

```bash
# Development - Portfolio-Specific (Recommended)
npm run dev:directing      # Start Vite for DIRECTING portfolio (http://localhost:3000)
npm run dev:postprod       # Start Vite for POST-PRODUCTION portfolio (http://localhost:3000)
npm run dev:directing:full # Build data + static files + start Vite (directing)
npm run dev:postprod:full  # Build data + static files + start Vite (postproduction)

# Development - General
npm run dev                # Start Netlify Dev with Functions (http://localhost:8888)
npm run dev:vite           # Start Vite only (no Functions, http://localhost:3000)
npm run preview            # Preview production build locally

# Building
npm run build              # Vite production build
npm run build:directing    # Full directing portfolio build
npm run build:postprod     # Full postproduction portfolio build
npm run build:static:all   # Generate static files for both portfolios

# Data Sync
npm run sync:directing     # Sync Airtable data for directing
npm run sync:postprod      # Sync Airtable data for postproduction
npm run sync:both          # Sync data for both portfolios
npm run sync:all           # Sync data + static files + upload to Cloudinary

# Instagram Studio (Sub-app at studio.lemonpost.studio)
npm run instagram-studio          # Start Instagram Studio dev server
npm run instagram-studio:install  # Install Instagram Studio dependencies
npm run instagram-studio:build    # Build Instagram Studio for production

# Testing
npm run test               # Run Vitest tests
npm run test:ui            # Run Vitest with UI
```

### Git Workflow

**Current Branch:** `updates`  
**Main Branch:** `main`

```bash
# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "feat: description of changes"

# Push to updates branch
git push origin updates

# Merge to main (when ready to deploy)
git checkout main
git merge updates
git commit -m "feat: description [deploy]"  # Include [deploy] to trigger build
git push origin main
```

---

## 🚀 Deployment & CI/CD

### Production URL
- **Live Site:** https://directedbygabriel.com
- **Netlify URL:** https://directedbygabriel.netlify.app

### Netlify Configuration (`netlify.toml`)

```toml
[build]
command = "npm run build"
publish = "dist"
functions = "netlify/functions"
ignore = "bash scripts/ignore-netlify-build.sh"  # Only build on [deploy] commits

# Scheduled Functions
[functions]
  directory = "netlify/functions"

[functions."scheduled-sync"]
  schedule = "@daily"  # Runs at midnight UTC

# Browser caching for static assets
[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Cache optimized images between builds
[[plugins]]
  package = "netlify-plugin-cache"
  [plugins.inputs]
    paths = ["dist/images/portfolio", "public/images/portfolio"]

# Redirects
[[redirects]]
  from = "/sitemap.xml"
  to = "/.netlify/functions/sitemap"
  status = 200
```

**How Build Caching Works:**
1. **First build:** Downloads images from Airtable → Optimizes to WebP → Saves to cache
2. **Subsequent builds:** Restores cached images → Only processes NEW images
3. **Automatic cleanup:** Deletes orphaned images for deleted projects/posts
4. **Result:** 5-10 second builds for new images only (vs 30-120s for all)

### Deployment Triggers

#### Automatic Deployments

**1. Push to `main` with Deploy Marker**
```bash
git commit -m "feat: new feature [deploy]"
git push origin main
```
- Triggers: Immediate build
- Detects: `[deploy]` or `[force-deploy]` in commit message
- Logic: `scripts/ignore-netlify-build.sh` checks last commit

**2. Scheduled Content Sync**
- **Daily (2 AM UTC):** Content-only check
- **Weekly (Sunday 3 AM UTC):** Code + content check
- Workflow: `.github/workflows/scheduled-deploy.yml`
- Smart: Only deploys if changes detected

**3. Scheduled Data Sync**
- **Daily (Midnight UTC):** `scheduled-sync.mjs` runs
- Updates: Cached data, sitemap.xml, share-meta.json
- Uploads: New images to Cloudinary
- No deploy needed: CDN serves updated cached data

#### Manual Deployments

**Option 1: GitHub Actions (Recommended)**
```
1. Go to GitHub → Actions tab
2. Select "Manual Deploy to Netlify"
3. Click "Run workflow"
4. Optional: Add reason
5. Wait for deployment (1-2 minutes)
```

**Option 2: Manual Sync Functions**
```bash
# Trigger incremental sync (respects change detection)
curl -X POST https://directedbygabriel.com/.netlify/functions/sync-now

# Trigger realtime sync (uploads all images fresh)
curl -X POST https://directedbygabriel.com/.netlify/functions/sync-now-realtime
```

**Option 3: Netlify Dashboard**
```
1. Go to Netlify Dashboard
2. Select site → Deploys
3. Click "Trigger deploy"
4. Note: Bypasses smart build logic
```

### GitHub Actions Workflows

#### 1. Manual Deploy (`.github/workflows/manual-deploy.yml`)

**Purpose:** Manually trigger deployment with optional reason

**How It Works:**
1. Creates a `[deploy]` marker commit
2. Includes user's reason in commit message
3. Pushes to `main` branch
4. Netlify detects marker and builds

**Usage:**
```
Actions → Manual Deploy to Netlify → Run workflow
Optional reason: "Fixed video thumbnail bug"
```

**Permissions:** `contents: write` (to push commits)

**Fixed Nov 2025:** Previously created duplicate deploys, now creates only ONE

#### 2. Scheduled Deploy (`.github/workflows/scheduled-deploy.yml`)

**Purpose:** Auto-deploy when content or code changes detected

**Schedule:**
- **Daily (2 AM UTC):** Content-only check
  - Generates share-meta.json from Airtable
  - Compares hash with previous version
  - Deploys if content changed
  
- **Weekly (Sunday 3 AM UTC):** Full check
  - Checks for git commits (code changes)
  - Also checks content changes
  - Deploys if either changed

**Smart Detection:**
```javascript
// Content changes (Airtable)
const newHash = crypto.createHash('md5')
  .update(JSON.stringify(data))
  .digest('hex');
const oldHash = fs.readFileSync('public/share-meta.hash', 'utf8');
if (newHash !== oldHash) {
  // Deploy needed
}

// Code changes (Git)
const lastDeploy = await getLastSuccessfulDeployDate();
const commits = await getCommitsSince(lastDeploy);
if (commits.length > 0 && !commits[0].message.includes('[ci skip]')) {
  // Deploy needed
}
```

**Benefits:**
- ✅ Saves build minutes (only builds when needed)
- ✅ Fresh content within 24 hours
- ✅ Code changes deployed within 7 days
- ✅ No unnecessary builds for docs updates

**Setup Required:** See `.github/SCHEDULED_DEPLOY_SETUP.md`

#### 3. Selective Build Logic (`scripts/ignore-netlify-build.sh`)

```bash
#!/bin/bash
LAST_COMMIT=$(git log -1 --pretty=%B)

if [[ "$LAST_COMMIT" =~ \[deploy\] ]] || [[ "$LAST_COMMIT" =~ \[force-deploy\] ]]; then
  echo "Deploy marker found - building"
  exit 1  # Build
else
  echo "No deploy marker - skipping build"
  exit 0  # Skip
fi
```

**Purpose:** Prevents builds for documentation-only updates

**Usage:** Include `[deploy]` in commit message to force build

### Build Process

**Complete Build Pipeline:**

```
1. npm run build
   ├─ npm run optimize:images
   │  ├─ Fetch featured projects from Airtable
   │  ├─ Fetch public journal posts from Airtable
   │  ├─ Download new images
   │  ├─ Optimize to WebP (1200px @ 90%)
   │  └─ Clean up orphaned images
   │
   └─ vite build
      ├─ Bundle React app
      ├─ Minify JS/CSS
      ├─ Generate source maps
      └─ Output to dist/

2. Netlify Functions
   ├─ Bundle serverless functions
   ├─ Deploy to AWS Lambda
   └─ Configure scheduled triggers

3. Edge Functions
   ├─ Deploy meta-rewrite.ts to Netlify Edge
   ├─ SSR-like dynamic meta tags (OG, Twitter)
   └─ Server-side structured data (JSON-LD) generation

4. CDN Distribution
   ├─ Upload dist/ to Netlify CDN
   ├─ Configure cache headers
   └─ Enable Brotli compression
```

**Build Times:**
- **First build:** 30-120 seconds (all images)
- **Incremental:** 5-15 seconds (new images only)
- **Code-only:** 20-30 seconds (no images)

### Scheduled Sync System

**Two Sync Strategies:**

#### 1. Incremental Sync (`scheduled-sync.mjs`)
**Used For:** Daily scheduled runs, manual triggers

**Features:**
- Smart change detection via `cloudinary-mapping.json`
- Only uploads new or changed images
- Maintains hash mapping file
- Generates sitemap.xml and share-meta.json
- Efficient for scheduled operations

**Runs:**
- Automatically: Daily at midnight UTC
- Manually: `POST /.netlify/functions/sync-now`

#### 2. Realtime Sync (`scheduled-sync-realtime.mjs`)
**Used For:** On-demand API calls via `get-data.js`

**Features:**
- Real-time uploads during each call
- No change detection (always fresh)
- Uploads to Cloudinary with `q_auto:best`
- Returns Cloudinary URLs when `USE_CLOUDINARY=true`
- Guaranteed fresh data for API endpoints

**Runs:**
- Via: `get-data.js` function calls
- Manually: `POST /.netlify/functions/sync-now-realtime`

**Common Features (Both):**
- Feature flag respect (`USE_CLOUDINARY`)
- Progress logging
- Automatic retry logic
- Airtable fallback URLs preserved
- Cache invalidation (`invalidate: true`, `overwrite: true`)

### Environment Variables (Netlify)

**Required for Production:**
```
# Airtable (Required)
AIRTABLE_API_KEY = keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX
VITE_AIRTABLE_TOKEN = keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX

# Cloudinary (Required for image optimization)
CLOUDINARY_CLOUD_NAME = date24ay6
CLOUDINARY_API_KEY = your-api-key
CLOUDINARY_API_SECRET = your-api-secret
USE_CLOUDINARY = true

# Analytics (Optional)
VITE_GA_MEASUREMENT_ID = G-EJ62G0X6Q5
```

**Setup Instructions:**
1. Netlify Dashboard → Site Settings
2. Environment Variables → Add variable
3. Add each variable above
4. Redeploy for changes to take effect

### Deployment Checklist

Before deploying major changes:

- [ ] All tests passing locally (`npm run dev`)
- [ ] Environment variables configured in Netlify
- [ ] Images optimized (`npm run optimize:images`)
- [ ] No console errors in browser
- [ ] Analytics tracking verified
- [ ] SEO meta tags correct
- [ ] Mobile responsive
- [ ] Cross-browser tested (Chrome, Safari, Firefox)
- [ ] Documentation updated in `AI_AGENT_GUIDE.md`
- [ ] Commit message includes change description
- [ ] Include `[deploy]` marker if forcing build

### Monitoring Production

**Netlify Dashboard:**
- Deploy status and logs
- Function execution logs
- Analytics and bandwidth usage
- Error tracking

**Google Analytics:**
- Real-time user tracking
- Page views and events
- User demographics

**Cloudinary Dashboard:**
- Image delivery stats
- Bandwidth usage
- Storage usage
- Transformation counts

**Alert Thresholds:**
- Cloudinary: 80% bandwidth usage
- Netlify: Build failures
- Analytics: Error rate >1%

### Rollback Procedure

If deployment fails or causes issues:

**Option 1: Netlify Dashboard (Instant)**
```
1. Netlify Dashboard → Deploys
2. Find last working deploy
3. Click options → "Publish deploy"
4. Confirms in 30 seconds
```

**Option 2: Git Revert (Safe)**
```bash
git revert HEAD
git commit -m "Revert: description [deploy]"
git push origin main
```

**Option 3: Cloudinary Disable (Images Only)**
```
1. Netlify Dashboard → Environment Variables
2. Set USE_CLOUDINARY=false
3. Trigger redeploy
4. Falls back to local WebP + Airtable
```

### Deployment FAQ

**Q: How often should I deploy?**
A: Let scheduled deploys handle routine updates. Only manual deploy for urgent fixes or major features.

**Q: Why isn't my change showing?**
A: Check browser cache (Cmd+Shift+R), wait for CDN propagation (1-5 min), verify deploy completed.

**Q: Can I test before deploying?**
A: Yes, use Netlify Deploy Previews (automatic on PRs) or deploy to separate test site.

**Q: What if Airtable is down?**
A: Site continues serving cached data (up to 24h stale). CDN cache prevents full outage.

---

```toml
[build]
command = "npm run build"
publish = "dist"
functions = "netlify/functions"
ignore = "bash scripts/ignore-netlify-build.sh"  # Only build on [deploy] commits

# Cache optimized images between builds
[[plugins]]
  package = "netlify-plugin-cache"
  [plugins.inputs]
    paths = ["dist/images/portfolio", "public/images/portfolio"]
```

**How caching works:**
1. **First build:** Downloads images from Airtable → Optimizes to WebP → Saves to cache
2. **Subsequent builds:** Restores cached images → Only processes NEW images
3. **Automatic cleanup:** Deletes orphaned images for deleted projects/posts

### Deployment Triggers

**Manual-Only Workflows:**
All deployments and syncs are now manual-trigger only for complete control.

**GitHub Actions Workflows:**

#### 1. Sync Data & Static Files (`.github/workflows/sync-data.yml`)
**Purpose:** Fetch data from Airtable and upload to Cloudinary CDN.

**What It Does:**
1. Fetches data from Airtable (Projects, Journal, About)
2. Generates static files (portfolio-data.json, share-meta.json, sitemap.xml)
3. Uploads all files to Cloudinary CDN
4. Commits changes to GitHub with `[ci skip]` (prevents deployment loop)

**Triggers:**
- Manual only via GitHub Actions UI
- Optional "force upload" parameter to re-upload all Cloudinary files

**Usage:**
```
Actions → Sync Data & Static Files → Run workflow
Optional: Check "Force Cloudinary upload" box
```

**When to Use:**
- After updating projects in Airtable
- After publishing new journal posts
- After updating about page content
- When you want to refresh cached Cloudinary files

**Important:** The site fetches data from Cloudinary at runtime, so **no deployment is needed** to see updated content! Users will see new data on their next page load (or refresh).

---

#### 2. Deploy to Netlify (`.github/workflows/manual-deploy.yml`)
**Purpose:** Trigger a Netlify deployment for code changes only.

**What It Does:**
1. Creates an empty commit with `[deploy]` marker
2. Pushes to main branch
3. Netlify detects marker and builds/deploys the site

**Triggers:**
- Manual only via GitHub Actions UI

**Usage:**
```
Actions → Deploy to Netlify → Run workflow
Optional: Add deployment reason
```

**When to Use:**
- After code changes (components, styling, features)
- To rebuild with latest dependencies
- To fix build issues
- Emergency deployments

**Note:** Deployment is NOT needed for content updates - the site fetches data from Cloudinary CDN at runtime. Only deploy for code/build changes.

---

**Netlify Function Webhook (Alternative to GitHub Actions):**

#### 3. Sync via Webhook (`netlify/functions/sync-now.mjs`)
**Purpose:** API endpoint to trigger sync from external services (like Airtable automations).

**Endpoint:** `https://your-site.netlify.app/.netlify/functions/sync-now`

**Authentication:** Optional Bearer token via `SYNC_TOKEN` environment variable

**Usage:**
```bash
# Basic sync
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN"

# Force full sync
curl -X POST "https://your-site.netlify.app/.netlify/functions/sync-now?force=true" \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN"
```

**Airtable Automation Setup:**
1. Go to Airtable Automations
2. Trigger: "When record matches conditions" (Status = Published)
3. Action: "Send webhook"
4. URL: Your function endpoint
5. Method: POST
6. Headers: `Authorization: Bearer YOUR_TOKEN`

**What It Does:**
- Uses same shared `sync-core.mjs` logic as GitHub Actions
- Fetches from Airtable
- Generates static files
- Uploads to Cloudinary CDN
- Site updates immediately (no deployment needed)
- Returns JSON response with sync stats

**Benefits:**
- Automatic sync when you publish in Airtable
- No need to manually trigger GitHub Actions
- Instant content updates (site fetches from Cloudinary)
- No deployment required for content changes

---

**Local Development:**

#### 4. Manual Scripts
```bash
# Sync data from Airtable
npm run build:data

# Generate share metadata
npm run build:content

# Generate sitemap
npm run build:sitemap

# Upload to Cloudinary
npm run sync:static

# Full build (includes all of the above + Vite build)
npm run build:full
```

---

**Content Update Flow:**

**Option A: GitHub Actions (Manual)**
```
1. Update content in Airtable
2. Go to GitHub → Actions → "Sync Data & Static Files" → Run
3. Wait for sync to complete (~30 seconds)
4. ✅ Done! Site shows new content (fetches from Cloudinary)
   - No deployment needed
   - Users see updates on next page load/refresh
```

**Option B: Webhook (Automated)**
```
1. Update content in Airtable
2. Set status to "Published"
3. Airtable automation triggers webhook
4. Sync uploads to Cloudinary (~30 seconds)
5. ✅ Done! Site shows new content immediately
   - No deployment needed
   - No manual GitHub Actions trigger
```

**Option C: Local Development**
```bash
1. Update content in Airtable
2. Run: npm run build:data && npm run sync:static
3. ✅ Done! Site shows new content
   - No deployment needed
   - Optional: Commit to GitHub for version control
```

**Code Deployment Flow (Separate):**
```
1. Make code changes (components, styles, etc.)
2. Commit and push to GitHub
3. Go to Actions → "Deploy to Netlify" → Run
4. Wait for build and deployment
5. ✅ Code changes live
```

---

**Smart Build Detection:**
Netlify only builds when it sees the `[deploy]` marker in commits:
- `scripts/ignore-netlify-build.sh` checks last commit message
- Commits with `[ci skip]` are ignored (like data sync commits)
- Commits with `[deploy]` or `[force-deploy]` trigger builds
- Prevents unnecessary builds and saves build minutes
- Prevents unnecessary builds (e.g., README updates)

### Build Process

1. `npm run optimize:images` → Downloads & optimizes images to `/public/images/portfolio/`
2. Sitemap & Share-meta → Generated daily by `scheduled-sync.mjs` (not during build)
3. `vite build` → Bundles React app to `/dist/`
4. Netlify deploys `/dist/` to CDN
5. Netlify Functions deployed to serverless endpoints

### Environment Variables (Netlify)

Go to **Site Settings → Environment Variables**:
```
AIRTABLE_API_KEY = keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX
VITE_AIRTABLE_TOKEN = keyXXXXXXXXXXXXXX  # Same as AIRTABLE_API_KEY
VITE_AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX  # Same as AIRTABLE_BASE_ID
```

**Note:** Both `AIRTABLE_*` and `VITE_AIRTABLE_*` are needed (functions vs. client-side).

---

### Festival/Awards Display System

**Purpose:** Smart grouping of multiple awards from the same festival for cleaner presentation.

**Supported Formats:**
1. **"Award Name - Festival Name Year"** (with dash)
   - Example: `Best Director - Sundance Film Festival 2024`
2. **"Award Name: Festival Name Year"** (with colon)
   - Example: `Best Comedy: Symi International Film Festival 2021`
3. **Standalone festival names** (no award specified)
   - Example: `Lift off Global Network: Austin 2022`

**How It Works:**
- Parses award strings to extract award name and festival name
- Groups multiple awards from same festival together
- Awards with keywords like "best", "winner", "official selection", "nominee", etc. trigger colon parsing
- Festival names without recognizable award keywords display as standalone with "Official Selection" label
- Festival names can be customized via "Display Name" field in Festivals table

**Display Example:**
```
✦ Sundance Film Festival 2024
  • Best Director
  • Best Cinematography

✦ Cannes Film Festival 2023
  • Official Selection

✦ Lift off Global Network: Austin 2022
  • Official Selection
```

**Visual Styling:**
- ✦ symbol precedes each festival name (subtle white/20 opacity)
- Festival names in white, medium weight
- Individual awards indented with bullet points in white/60 opacity
- Consistent spacing between festival groups

**Custom Display Names:**
Add "Display Name" column to Festivals table in Airtable to override long festival names:
- "International Film Festival of Rotterdam" → Display as "IFFR"
- Priority: Display Name > Short Name > Name > Award

**Award Keywords (for colon parsing):**
`best`, `winner`, `award`, `prize`, `official selection`, `nominee`, `finalist`, `honorable mention`, `grand jury`, `audience`, `special mention`

**Implementation:**
- Logic in `ProjectDetailView.tsx` → `groupAwardsByFestival()` function
- Fetches display names via `cmsService.ts` → `fetchAwardsMap()`
- Uses consistent styling via `theme.ts` typography system

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Loading Static Fallback Data" in Console
**Cause:** Airtable API connection failed or credentials missing.

**Fix:**
- Check `.env.local` has correct `VITE_AIRTABLE_TOKEN` and `VITE_AIRTABLE_BASE_ID`
- Verify Airtable API key is valid (go to Airtable → Account → API)
- Check network connection
- Verify Airtable base ID matches your base

#### 2. Images Not Loading
**Possible Causes:**
- Image optimization not run (`npm run optimize:images`)
- Image path mismatch (check naming convention)
- Airtable Gallery field empty

**Fix:**
```bash
# Re-run optimization
npm run optimize:images

# Verify images exist
ls -la public/images/portfolio/

# Test Airtable connection
npm run test:images
```

#### 3. Video Not Embedding
**Cause:** Unsupported video URL format.

**Supported:**
- YouTube: `youtube.com/watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`
- Vimeo: `vimeo.com/123456`, `vimeo.com/123456/hash`, `player.vimeo.com/video/123456`

**Fix:**
- Use standard video URLs
- Check `cmsService.ts` → `getVideoId()` function for regex patterns
- For unlisted/private Vimeo, ensure hash is in URL: `vimeo.com/123456/abcdef123`

#### 4. Build Failing on Netlify
**Check:**
- Build logs in Netlify dashboard
- Environment variables are set
- Node version matches (Netlify uses Node 18 by default)

**Common Fixes:**
```bash
# Clear cache and retry
# (In Netlify: Site Settings → Build & Deploy → Clear cache)

# Check for missing dependencies
npm ci  # Clean install

# Verify build works locally
npm run build
```

#### 5. Slugs Colliding (Two Projects Have Same URL)
**Cause:** Duplicate titles and years.

**Fix:**
- `utils/slugify.ts` → `makeUniqueSlug()` auto-handles collisions with record ID suffix
- Ensure projects have unique titles or years

#### 6. Analytics Not Tracking
**Check:**
- `analyticsService.init()` is called in `App.tsx` (it is by default)
- Measurement ID is correct: `G-EJ62G0X6Q5`
- Check browser console for GA errors
- Verify in Google Analytics dashboard (Real-time reports)

---

## ✅ Common Tasks

### Add a New Project (Airtable)

1. Go to Airtable → Projects table
2. Add new record:
   - **Name:** Project title
   - **Feature:** ✓ (to make visible)
   - **Front Page:** ✓ (to show on home)
   - **Project Type:** Select type
   - **Client:** Link to Client Book
   - **Release Date:** YYYY-MM-DD
   - **About:** Description
   - **Gallery:** Upload images
   - **Video URL:** YouTube/Vimeo URL
   - **Role:** Select role(s)
3. Save → Wait 5-15 minutes for CDN cache to clear (or force deploy)

### Add a New Journal Post

1. Airtable → Journal table
2. Add record:
   - **Title:** Post title
   - **Date:** YYYY-MM-DD
   - **Status:** "Public" (or "Scheduled" for future)
   - **Content:** Markdown text
   - **Cover Image:** Upload image
   - **Tags:** Add tags
3. Save → Auto-published

### Change Theme Settings

1. Open `theme.ts`
2. Modify values (e.g., change hero height, colors, fonts)
3. Save → Changes apply instantly in dev mode
4. Example:
```typescript
// Before
hero: { height: "h-screen" }

// After
hero: { height: "h-[80vh]" }
```

### Add New Analytics Event

1. Open component where event occurs (e.g., `VideoEmbed.tsx`)
2. Import analytics service:
```typescript
import { analyticsService } from '../services/analyticsService';
```
3. Track event:
```typescript
const handleClick = () => {
  analyticsService.trackEvent('custom_event', { 
    category: 'engagement',
    label: 'button_click'
  });
};
```

### Add New View/Route

1. Create component in `components/views/`:
```typescript
// components/views/NewView.tsx
import React from 'react';

export const NewView: React.FC = () => {
  return <div>New View Content</div>;
};
```

2. Add route in `App.tsx`:
```typescript
import { NewView } from './components/views/NewView';

// Inside <Routes>
<Route path="/new-route" element={
  <>
    <SEO title="New Page" />
    <NewView />
  </>
} />
```

3. Add navigation link in `Navigation.tsx`:
```typescript
<NavLink to="/new-route" className={({ isActive }) => getBtnClass(isActive)}>
  New Route
</NavLink>
```

### Update Airtable Schema

**Adding a New Field:**
1. Airtable → Projects table → Add field
2. Update `types.ts` interface:
```typescript
interface Project {
  // ... existing fields
  newField?: string;  // Add new field
}
```
3. Update `cmsService.ts` → `processProjects()`:
```typescript
return {
  // ... existing fields
  newField: record.get('New Field') || ''
};
```

### Force Cache Clear

**Client-Side:**
```typescript
// In cmsService.ts
cachedData = null;  // Clear cached data
```

**Netlify Functions:**
- Wait 15 minutes for TTL expiry
- Or redeploy site (clears all caches)

---

## 🔐 Security Notes

### API Keys
- **Airtable API Key:** Has full read/write access to base. Keep secret!
- **Never commit `.env.local`** (already in `.gitignore`)
- Netlify environment variables are encrypted at rest

### Content Security
- Airtable authentication via Bearer token (HTTPS only)
- No client-side secrets (all API calls via Netlify Functions)
- CORS handled by Netlify (no cross-origin issues)

---

## ⚡ Performance & Optimization

### Performance Strategy Overview

The site uses a **multi-layered optimization strategy** to achieve fast load times:

1. **CDN Caching** - Netlify edge cache (1h) + browser cache (5m)
2. **Image Optimization** - Cloudinary transformations + local WebP fallbacks
3. **Code Splitting** - React lazy loading + Vite chunk optimization
4. **Asset Caching** - 1-year cache headers for immutable assets
5. **Compression** - Brotli/Gzip automatic compression
6. **Lazy Loading** - Images and routes loaded on-demand

### Current Performance Metrics

**PageSpeed Insights (November 2025):**
- **Score:** 85+ (Mobile & Desktop)
- **FCP (First Contentful Paint):** < 0.6s ✅
- **LCP (Largest Contentful Paint):** < 1.8s ✅
- **TBT (Total Blocking Time):** < 200ms ✅
- **CLS (Cumulative Layout Shift):** 0 ✅
- **Page Weight:** ~1.5-2.4MB (down from 6-10MB) ✅

**Real-World Performance:**
- **Initial load:** 100-300ms (CDN cache hit)
- **Subsequent pages:** < 50ms (SPA navigation)
- **Image load:** 80-200ms (Cloudinary CDN)

### Image Optimization

#### Responsive Width Strategy

Images use **context-aware widths** to minimize data transfer:

```typescript
// Context-specific widths
const WIDTHS = {
  HERO_HOME: 1920,      // Homepage hero (maximum quality)
  HERO_POST: 1600,      // Blog post heroes (full editorial)
  GRID_THUMB: 800,      // Grid/list thumbnails
  SMALL_THUMB: 600,     // Related content, sidebar
};
```

**Implementation:**
```tsx
// Homepage hero - largest, highest quality
<OptimizedImage
  recordId={project.id}
  fallbackUrl={project.heroImage}
  width={1920}
  quality="auto:best"
/>

// Grid thumbnails - optimized for size
<OptimizedImage
  recordId={project.id}
  fallbackUrl={project.heroImage}
  width={800}
  quality="auto:good"
/>
```

**Performance Impact:**
- **Before:** All images at 1600px = 400-500KB each
- **After:** Contextual sizing = 150-250KB average
- **Savings:** ~40-50% bandwidth reduction

#### Quality Differentiation

**Two-tier quality system:**

1. **`auto:best` (90-100% quality)** - High-impact images
   - Project detail slideshows
   - Blog post heroes
   - Home featured images
   - Use: `quality="auto:best"` prop

2. **`auto:good` (80-90% quality)** - Thumbnails
   - Filmography grid/list
   - Journal listing covers
   - Related content previews
   - Use: `quality="auto:good"` prop

**File Size Comparison:**
```
Same 800px image:
- auto:best = ~200KB WebP
- auto:good = ~150KB WebP
- Savings: 25% smaller with minimal visual difference
```

#### Three-Tier Fallback System

**Primary: Cloudinary (Production)**
```
https://res.cloudinary.com/date24ay6/image/upload/
  f_auto,q_auto:best,c_limit,dpr_auto,w_1920/
  portfolio-projects-{recordId}-0
```

**Features:**
- Auto format (WebP/AVIF based on browser)
- Smart quality compression
- Retina display support (`dpr_auto`)
- Global CDN delivery
- 25GB free bandwidth/month

**Secondary: Local WebP (Build-time)**
```
/images/portfolio/project-{recordId}-0.webp
```

**Features:**
- Pre-generated during build
- 1200px @ 90% quality
- Netlify CDN served
- No API dependencies

**Tertiary: Airtable URLs (Original)**
```
https://v5.airtableusercontent.com/...
```

**Features:**
- Original high-res images
- Airtable CDN served
- JPEG/PNG formats
- Fallback of last resort

### CDN Caching Strategy

**Multi-Level Cache Hierarchy:**

```
Browser Cache (5 min)
    ↓ (miss)
Netlify CDN (1 hour)
    ↓ (miss)
Function Execution → Airtable
    ↓
Stale-While-Revalidate (24 hours)
```

**Cache Headers:**
```javascript
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
```

**What This Means:**
- **First 5 minutes:** Instant load from browser
- **After 5 minutes:** Fast load from CDN
- **After 1 hour:** CDN refreshes from function
- **After 24 hours:** Serves stale while updating

**Benefits:**
- ✅ 99.9% requests served from cache
- ✅ No Airtable API rate limit issues
- ✅ Resilient to API outages
- ✅ Sub-200ms response times

### Asset Optimization

#### Long-Term Caching

**Immutable Assets (1 year cache):**
```toml
# netlify.toml
[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

**Why This Works:**
- Vite generates content-hash filenames (e.g., `app.abc123.js`)
- File content changes = new filename = cache miss
- Old files remain cached forever (immutable)
- No bandwidth waste redownloading unchanged files

#### Font Loading Optimization

**Strategy: Async font loading with system font fallback**

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
```

**Benefits:**
- ✅ Non-blocking font load
- ✅ System font renders immediately
- ✅ Custom font swaps in when ready
- ✅ No layout shift (font-display: swap)

#### Code Splitting

**Vite Automatic Splitting:**
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'analytics': ['./src/services/analyticsService'],
        }
      }
    }
  }
});
```

**Result:**
- Core app bundle: ~150KB
- Vendor bundle: ~140KB
- Route chunks: 10-30KB each
- Total: ~300KB initial load

### Build-Time Optimizations

#### Image Pre-Processing

**Incremental Optimization:**
```bash
# Only processes new/changed images
npm run optimize:images

# Logic:
1. Compare existing files with Airtable
2. Download only new images
3. Optimize to WebP (1200px @ 90%)
4. Delete orphaned images
5. Cache for next build
```

**Performance:**
- First build: 30-120s (all images)
- Incremental: 5-15s (new only)
- Savings: 80-90% build time

#### Dependency Pre-Bundling

**Vite Pre-Bundling:**
```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'airtable']
  }
});
```

**Benefits:**
- ✅ Faster dev server startup
- ✅ Fewer HTTP requests
- ✅ Better HMR performance

### Runtime Optimizations

#### Lazy Loading

**Images:**
```tsx
<OptimizedImage
  loading="lazy"  // Native browser lazy loading
  alt="Project thumbnail"
/>
```

**Routes:**
```tsx
// App.tsx
const ProjectDetailView = lazy(() => import('./components/views/ProjectDetailView'));
```

#### Background Data Sync

**Non-Blocking Updates:**
```typescript
// hooks/useBackgroundDataSync.ts
useEffect(() => {
  const interval = setInterval(async () => {
    const fresh = await cmsService.fetchAll();
    // Silently update cache, no UI blocking
  }, 30 * 60 * 1000); // Every 30 minutes
}, []);
```

### Compression

**Automatic Compression (Netlify):**
- Brotli compression for modern browsers (20-30% better than gzip)
- Gzip fallback for older browsers
- Applied to HTML, JS, CSS, JSON

**File Size Comparison:**
```
dist/app.js (uncompressed): 450KB
dist/app.js (gzip): 125KB
dist/app.js (brotli): 105KB
Savings: 76% (brotli vs uncompressed)
```

### Monitoring & Metrics

**Tools for Performance Monitoring:**

1. **Google PageSpeed Insights**
   - URL: https://pagespeed.web.dev
   - Test: Mobile & Desktop
   - Frequency: After major changes

2. **Netlify Analytics** (Built-in)
   - Page load times
   - Bandwidth usage
   - Top pages

3. **Google Analytics 4**
   - Real user monitoring
   - Page load times
   - Device breakdowns

4. **Cloudinary Analytics**
   - Image delivery stats
   - Bandwidth usage
   - Transformation counts

**Key Metrics to Track:**
- Time to First Byte (TTFB) < 200ms
- First Contentful Paint (FCP) < 1s
- Largest Contentful Paint (LCP) < 2.5s
- Total Blocking Time (TBT) < 200ms
- Cumulative Layout Shift (CLS) < 0.1

### Performance Budget

**Current Limits:**
- **Page Weight:** < 3MB per page
- **Image Weight:** < 300KB per image (full size)
- **JS Bundle:** < 500KB total
- **CSS Bundle:** < 50KB
- **API Response:** < 500ms

**Alerts:**
- Cloudinary: 80% of 25GB bandwidth/month
- Netlify: Build time > 5 minutes
- PageSpeed: Score < 80

### Future Optimizations

**Planned Enhancements:**

1. **Service Worker**
   - Offline support
   - Background sync
   - Push notifications

2. **HTTP/3 & QUIC**
   - Faster connection setup
   - Better mobile performance

3. **Image Placeholders**
   - Blur-up technique
   - LQIP (Low Quality Image Placeholder)

4. **Route Pre-Fetching**
   - Predict next navigation
   - Pre-load likely routes

5. **Critical CSS**
   - Inline above-fold CSS
   - Defer non-critical styles

---

### Current Optimizations

1. **Image Optimization:**
   - WebP format (50-80% smaller than JPEG)
   - Max width 1600px (retina displays)
   - Incremental builds (only process new images)

2. **Caching Strategy:**
   - `share-meta.json` manifest (instant load, no API call)
   - Netlify Functions cache: 15 minutes (900s TTL)
   - CDN edge cache: 24 hours (stale-while-revalidate)

3. **Bundle Optimization:**
   - Vite code splitting (lazy load routes)
   - Tree shaking (unused code removed)
   - Minification (production builds)

4. **Lazy Loading:**
   - Images use native lazy loading (`loading="lazy"`)
   - Routes lazy loaded via React Router

### Performance Metrics (Target)

**Current Status (Nov 26, 2025):**
- **PageSpeed Score:** 85+ (after optimization)
- **FCP:** < 0.6s ✅
- **LCP:** < 1.8s ✅
- **TBT:** < 200ms (improved with async fonts)
- **CLS:** 0 ✅
- **Page Weight:** ~3,200 KiB (down from 4,658 KiB)

**Optimization Summary:**
- ✅ Images optimized (1200px, 82% quality WebP)
- ✅ Static asset caching (1-year cache headers)
- ✅ Async font loading (no render blocking)
- ✅ Dependency pre-bundling (faster dev/build)
- ✅ All images use optimized WebP with fallback

---

## 🧪 Testing

### Manual Testing Checklist

**Navigation:**
- [ ] Home → Filmography → Project Detail
- [ ] Journal → Post Detail
- [ ] About page
- [ ] Browser back/forward buttons work

**Content:**
- [ ] Projects load with images
- [ ] Videos embed and play
- [ ] Journal posts render markdown
- [ ] Credits expand/collapse
- [ ] Social share buttons work

**Responsive:**
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1440px)
- [ ] Navigation adapts to mobile

**SEO:**
- [ ] Page titles update per route
- [ ] Open Graph tags correct (check via Facebook Debugger)
- [ ] Twitter Cards correct
- [ ] Canonical URLs set

**Analytics:**
- [ ] Page views tracked (check GA4 Real-time)
- [ ] Video play events tracked
- [ ] Social share events tracked

**Image Optimization:**
- [ ] New images optimized during build
- [ ] Orphaned images cleaned up automatically
- [ ] WebP files served correctly

---

## 📚 Additional Resources

### Documentation Files
- `ANALYTICS_SETUP.md` - Analytics configuration guide
- `ANALYTICS_TESTING.md` - How to test analytics
- `ENV_SETUP.md` - Environment variable setup
- `DEPLOYMENT_GUIDE.md` - Step-by-step deployment
- `IMAGE_OPTIMIZATION.md` - Image optimization details

### External Documentation
- [Airtable API](https://airtable.com/developers/web/api/introduction)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Router](https://reactrouter.com/en/main)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Google Analytics 4](https://developers.google.com/analytics/devguides/collection/ga4)

---

## 🆘 Emergency Contacts

### Key People
- **Developer:** (Current maintainer)
- **Content Manager:** Gabriel Athanasiou
- **Hosting:** Netlify (automated)

### Support Resources
- **Airtable Support:** https://support.airtable.com
- **Netlify Support:** https://answers.netlify.com
- **GitHub Issues:** (If this becomes a repo with issues enabled)

---

## 🎯 Future Improvements

### Planned Features
- [ ] Admin dashboard for content preview
- [ ] Multi-language support (i18n)
- [ ] Advanced search/filtering
- [ ] Blog RSS feed
- [ ] Newsletter integration
- [ ] Video hosting migration to Mux/Cloudflare Stream

### Known Limitations
- Instagram integration disabled (requires access token renewal)
- No content versioning (Airtable native only)
- No user authentication (static site)
- Limited Airtable API rate (5 requests/second)

---

## 📝 Code Style Guide

### TypeScript
- Use `interface` for data models, `type` for unions
- Always define return types for functions
- Prefer `async/await` over `.then()`

### React
- Functional components only (no class components)
- Props destructuring in function signature
- Use `React.FC<Props>` type annotation

### Naming Conventions
- **Components:** PascalCase (`ProjectDetailView.tsx`)
- **Utilities:** camelCase (`imageOptimization.ts`)
- **Constants:** UPPER_SNAKE_CASE (`AIRTABLE_TOKEN`)
- **CSS Classes:** Tailwind utility classes (via `theme.ts`)

### File Organization
- One component per file
- Co-locate types with usage (or in `types.ts` if shared)
- Group imports: React → Libraries → Local

### Documentation Requirements
**MANDATORY for all code changes:**
1. **Update AI_AGENT_GUIDE.md immediately after code changes**
   - Document new features in the relevant section
   - Update "Last Major Update" date at the top
   - Explain how the feature works and why
2. **Update relevant section documentation files** (IMAGE_OPTIMIZATION.md, etc.)
3. **Update README.md if user-facing changes**
4. **Keep comments in code accurate and up-to-date**
5. **Document breaking changes prominently**
6. **Never commit without updating documentation**

**Guide Aliases for AI Agents/Bots**
- Canonical guide: `AI_AGENT_GUIDE.md` (root)
- Quick reference: `.github/copilot-instructions.md` (GitHub Copilot's standard location)
- Why: GitHub Copilot looks for `.github/copilot-instructions.md` by convention.

**Documentation Checklist Before Committing:**
- [ ] AI_AGENT_GUIDE.md updated with changes
- [ ] Code comments added/updated where needed
- [ ] Related documentation files updated
- [ ] Examples added for complex features
- [ ] "Last Major Update" timestamp updated

---

## 🌿 Git Workflow & Branch Management

### Overview: Feature Branch Development

This project uses a **feature branch workflow** to keep the main site stable while developing and testing new features. This approach:
- Keeps `main` branch always deployable
- Allows testing features in isolation
- Saves Netlify build minutes through smart build optimization
- Enables easy rollback if something breaks

### Branch Strategy

**Main Branch (Production)**
- **Branch:** `main`
- **Purpose:** Live production site
- **Auto-deploys:** Yes, every push
- **URL:** Your main production URL
- **Protection:** Never push broken code here

**Feature Branches**
- **Naming:** `feature/descriptive-name` (e.g., `feature/optimistic-loading`)
- **Purpose:** Develop and test new features
- **Auto-deploys:** No (saves build minutes)
- **Testing:** Local first, then deploy preview via PR

**Hotfix Branches**
- **Naming:** `hotfix/issue-description`
- **Purpose:** Emergency fixes for production
- **Workflow:** Create → Fix → PR → Merge immediately

### Complete Feature Development Workflow

#### 1. Create a New Feature Branch

```bash
# Make sure you're on main and it's up to date
git checkout main
git pull origin main

# Create and switch to new feature branch
git checkout -b feature/your-feature-name

# Example:
git checkout -b feature/image-lazy-loading
```

#### 2. Develop and Test Locally

```bash
# Start local development server
npm run dev

# Site runs at http://localhost:3000
# Netlify functions at http://localhost:8888/.netlify/functions/*

# Make your changes, test thoroughly locally
# Commit frequently with descriptive messages
git add .
git commit -m "feat: add lazy loading to hero images"
```

**Best Practice:** Test everything possible locally before pushing. This includes:
- UI changes and interactions
- Component behavior
- Edge functions with `netlify dev`
- Different viewport sizes
- Performance with DevTools

#### 3. Push Feature Branch (No Build Triggered)

```bash
# Push to GitHub (does NOT trigger Netlify build)
git push origin feature/your-feature-name
```

**What happens:**
- ✅ Code pushed to GitHub
- ❌ No Netlify build (saves build minutes)
- ❌ No deploy preview yet

**Why:** The `ignore-netlify-build.sh` script prevents automatic builds on feature branches unless you force it.

#### 4. Create Pull Request for Testing

When you're ready to test on a live URL (for mobile testing, sharing with others, or testing CDN behavior):

**Option A: Via GitHub Web Interface**
1. Go to your GitHub repository
2. Click "Pull requests" → "New pull request"
3. Base: `main` ← Compare: `feature/your-feature-name`
4. Click "Create pull request"
5. Add description of what you're testing

**Option B: Via GitHub CLI**
```bash
# Install gh CLI if needed: brew install gh
gh pr create --base main --head feature/your-feature-name --title "Feature: Your Feature Name" --body "Description of changes"
```

**What happens:**
- ✅ Netlify creates a deploy preview (costs 1 build minute)
- ✅ You get a unique URL: `deploy-preview-123--yoursite.netlify.app`
- ✅ Every new commit to the feature branch updates the same preview
- ✅ Comments, reviews, and feedback tracked in PR

#### 5. Test Deploy Preview

```bash
# Continue making changes on your feature branch
git add .
git commit -m "fix: adjust loading animation timing"
git push origin feature/your-feature-name

# Each push updates the SAME deploy preview
# No additional build minutes consumed per push
```

**Testing Checklist:**
- [ ] Test on mobile devices (scan QR code from Netlify)
- [ ] Test on different browsers
- [ ] Verify edge functions work correctly
- [ ] Check CDN caching behavior
- [ ] Verify images load from Cloudinary
- [ ] Test with production data
- [ ] Check analytics tracking
- [ ] Verify SEO metadata

#### 6. Merge to Production

When testing is complete and everything works:

**Via GitHub Web Interface:**
1. Go to your PR on GitHub
2. Review all changes one final time
3. Click "Merge pull request"
4. Choose merge type:
   - **Squash and merge** (recommended) - Combines all commits into one clean commit
   - **Merge commit** - Keeps all individual commits
   - **Rebase and merge** - Replays commits on top of main
5. Confirm merge
6. Delete feature branch (optional but recommended)

**Via Command Line:**
```bash
# Switch to main branch
git checkout main

# Merge feature branch
git merge feature/your-feature-name

# Push to production
git push origin main

# Delete feature branch locally
git branch -d feature/your-feature-name

# Delete feature branch remotely
git push origin --delete feature/your-feature-name
```

**What happens:**
- ✅ Feature branch merged into `main`
- ✅ Netlify automatically builds and deploys to production
- ✅ Your live site updates within 2-3 minutes
- ✅ Deploy preview is automatically cleaned up

### Build Minute Optimization

#### How Builds Are Controlled

The `scripts/ignore-netlify-build.sh` script controls when Netlify builds run:

```bash
# Always builds:
✅ Pull request deploy previews
✅ Main branch commits with [deploy] or [force-deploy] marker
✅ Commits from scheduled-sync.mjs (when content changes)
✅ Commits from GitHub Action weekly check (Sundays)

# Never builds (saves minutes):
❌ Regular commits to main without [deploy] marker
❌ Feature branch commits (unless forced with [deploy])
❌ Commits with [skip ci] in message
```

**Build Triggers:**
1. **Content changes** - Midnight sync detects changes → Triggers build via webhook → Commit message contains "Scheduled sync"
2. **Weekly code check** - Sunday 3 AM GitHub Action → Creates commit with [deploy] marker
3. **Manual deploys** - Add [deploy] to commit message when pushing to main
4. **Pull requests** - Always build deploy previews for testing

#### Current Build Configuration

**What triggers builds:**
1. **Push to `main`** - Automatic production deploy
2. **Open/update PR** - Automatic deploy preview
3. **Force build on feature branch** - Add `[deploy]` to commit message

**What doesn't trigger builds:**
- Regular commits to feature branches
- Commits with `[skip ci]` or `[skip netlify]` in message

#### Force Build on Feature Branch

If you need to test a feature branch without creating a PR:

```bash
# Add [deploy] to commit message
git commit -m "feat: test live behavior [deploy]"
git push origin feature/your-feature-name

# Netlify will build this specific commit
# Creates a branch deploy at: feature-branch-name--yoursite.netlify.app
```

**When to use:**
- Testing urgent fixes before PR
- Sharing a quick preview without formal PR
- Testing deployment-specific behavior

**When NOT to use:**
- Regular development (test locally instead)
- Multiple iterations (use PR deploy preview instead)

### Branch Management Commands

#### Check Current Branch
```bash
git branch
# * feature/your-feature-name  (asterisk shows current branch)
#   main
```

#### Switch Between Branches
```bash
# Switch to existing branch
git checkout main
git checkout feature/your-feature-name

# Create and switch to new branch
git checkout -b feature/new-feature
```

#### Update Feature Branch with Latest Main
```bash
# On your feature branch
git checkout feature/your-feature-name

# Fetch latest from main
git fetch origin main

# Merge main into your feature branch
git merge origin/main

# Or rebase onto main (cleaner history)
git rebase origin/main

# Push updated feature branch
git push origin feature/your-feature-name
```

#### Delete Branches
```bash
# Delete local branch (must not be on that branch)
git branch -d feature/old-feature

# Force delete if not merged
git branch -D feature/abandoned-feature

# Delete remote branch
git push origin --delete feature/old-feature
```

#### View All Branches
```bash
# Local branches only
git branch

# All branches (local + remote)
git branch -a

# Remote branches only
git branch -r
```

### Common Scenarios

#### Scenario 1: Quick Fix to Production

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/fix-broken-link

# Make fix and test locally
# ... make changes ...
git add .
git commit -m "fix: correct project link URL"

# Push and create PR
git push origin hotfix/fix-broken-link
gh pr create --title "Hotfix: Fix broken project link" --body "Urgent fix for broken link"

# Test deploy preview quickly
# If good, merge immediately via GitHub

# Or merge directly if very urgent
git checkout main
git merge hotfix/fix-broken-link
git push origin main
```

#### Scenario 2: Abandoned Feature (Clean Up)

```bash
# You decided not to finish a feature
# First, make sure you're not on that branch
git checkout main

# Delete local branch
git branch -D feature/abandoned-idea

# Delete remote branch
git push origin --delete feature/abandoned-idea
```

#### Scenario 3: Long-Running Feature (Keep Updated)

```bash
# Feature takes several days, main has moved ahead
git checkout feature/long-feature

# Get latest changes from main
git fetch origin main
git merge origin/main

# Resolve any conflicts if they appear
# ... fix conflicts ...
git add .
git commit -m "merge: resolve conflicts with main"

# Continue working on feature
```

#### Scenario 4: Test Multiple Features Together

```bash
# Create integration branch
git checkout -b integration/test-multiple-features

# Merge first feature
git merge feature/feature-one

# Merge second feature
git merge feature/feature-two

# Test combined changes locally
npm run dev

# Push with [deploy] to test live
git push origin integration/test-multiple-features
git commit --allow-empty -m "test: integration test [deploy]"
git push origin integration/test-multiple-features
```

### Netlify Dashboard Configuration

#### Enable Branch Deploys (Optional)

If you want specific feature branches to auto-deploy:

1. Go to Netlify Dashboard
2. Select your site
3. Go to **Site settings** → **Build & deploy** → **Continuous Deployment**
4. Under **Branch deploys**, click **Edit settings**
5. Select **Let me add individual branches**
6. Add specific branches you want to auto-deploy (e.g., `feature/optimistic-loading`)
7. Save

**Note:** This increases build minute usage. Only enable for branches you're actively testing.

#### Deploy Contexts

You can configure different build commands for different contexts:

```toml
# In netlify.toml

[context.production]
  command = "npm run build"

[context.deploy-preview]
  command = "npm run build:preview"  # Could use different env vars

[context.branch-deploy]
  command = "npm run build:staging"
```

### Git Best Practices

#### Commit Message Convention

Use conventional commits for clarity:

```bash
# Feature
git commit -m "feat: add image lazy loading"

# Fix
git commit -m "fix: resolve navigation menu overlap"

# Documentation
git commit -m "docs: update deployment guide"

# Style/Formatting
git commit -m "style: fix indentation in Navigation component"

# Refactor
git commit -m "refactor: extract image optimization logic"

# Performance
git commit -m "perf: optimize thumbnail generation"

# Test
git commit -m "test: add tests for image compression"

# Chore (maintenance)
git commit -m "chore: update dependencies"

# Force deployment
git commit -m "feat: add new feature [deploy]"

# Skip CI
git commit -m "docs: update readme [skip ci]"
```

#### Commit Frequency

- **Commit often** during development (every logical change)
- **Don't commit broken code** to main
- **Test before committing** when possible
- **Write descriptive messages** (future you will thank you)

#### Branch Naming

```bash
# Good
feature/image-optimization
feature/add-contact-form
hotfix/fix-mobile-nav
fix/cloudinary-timeout

# Bad
feature/stuff
test
my-branch
update
```

### Troubleshooting

#### I'm on the wrong branch!

```bash
# Check current branch
git branch

# If you made commits on main by mistake
git checkout -b feature/my-changes  # Creates new branch with your commits
git checkout main
git reset --hard origin/main  # Resets main to remote state
```

#### I want to undo my last commit

```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Undo commit and discard changes
git reset --hard HEAD~1

# Undo push to remote (dangerous!)
git push origin +feature/your-branch  # Force push
```

#### My feature branch is behind main

```bash
git checkout feature/your-branch
git fetch origin main
git merge origin/main
# Or: git rebase origin/main (cleaner history)
git push origin feature/your-branch
```

#### Merge conflicts!

```bash
# Git will tell you which files have conflicts
git status

# Open conflicted files, look for:
<<<<<<< HEAD
your changes
=======
incoming changes
>>>>>>> branch-name

# Choose which version to keep, remove markers
# Then:
git add .
git commit -m "merge: resolve conflicts"
```

#### I pushed to the wrong branch

```bash
# If you haven't pushed yet
git reset --soft HEAD~1
git checkout correct-branch
git commit -m "your message"

# If you already pushed
# On wrong branch
git reset --hard HEAD~1
git push origin +wrong-branch  # Force push to remove

# On correct branch
git cherry-pick <commit-hash>  # Apply the commit here
git push origin correct-branch
```

### Build Minute Monitoring

#### Check Current Usage

1. Netlify Dashboard → [Your Site] → Team settings → Billing
2. View "Build minutes used this month"
3. Free tier: 300 minutes/month
4. Pro tier: 25,000 minutes/month

#### Estimated Build Times

- **Main branch deploy:** ~2-3 minutes
- **Deploy preview:** ~2-3 minutes
- **Feature branch (if enabled):** ~2-3 minutes

#### Monthly Build Estimate

With optimized workflow:
- **Daily content updates:** 0 builds (auto-synced via function)
- **Weekly code updates:** 4 builds × 3 min = 12 min/month
- **Feature development:** 3 features × 5 PR iterations × 3 min = 45 min/month
- **Total:** ~57 minutes/month (19% of free tier)

**Without optimization (old way):**
- **Daily builds:** 30 builds × 3 min = 90 min/month
- **Feature testing:** 10 feature branch builds × 3 min = 30 min/month
- **PR previews:** 45 min/month
- **Total:** ~165 minutes/month (55% of free tier)

### Quick Command Reference

```bash
# Branch Management
git branch                           # List local branches
git branch -a                        # List all branches
git checkout -b feature/name         # Create and switch to new branch
git checkout main                    # Switch to main
git branch -d feature/name           # Delete local branch
git push origin --delete feature/name # Delete remote branch

# Feature Development
git checkout -b feature/name         # Start new feature
git add .                           # Stage changes
git commit -m "feat: description"   # Commit
git push origin feature/name        # Push to GitHub (no build)
gh pr create                        # Create PR (triggers preview)

# Update Feature Branch
git checkout feature/name           # Switch to feature
git fetch origin main              # Get latest main
git merge origin/main              # Merge main into feature

# Deploy to Production
git checkout main                   # Switch to main
git merge feature/name             # Merge feature
git push origin main               # Deploy to production

# Force Build on Feature
git commit -m "feat: test [deploy]" # Add [deploy] to message
git push origin feature/name       # Triggers build

# Emergency Rollback
git revert HEAD                    # Undo last commit
git push origin main               # Deploy reverted version
```

---

## ⚡ Quick Reference

### Start Development
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

### Deploy to Netlify
```bash
git add .
git commit -m "feat: description [deploy]"
git push origin main
```

### Emergency Rollback
1. Netlify Dashboard → Deploys
2. Find previous working deploy
3. Click "Publish deploy" on old version

---

**END OF GUIDE**

> This document is a living reference. Update it as the codebase evolves.  
> Last reviewed: November 28, 2025
