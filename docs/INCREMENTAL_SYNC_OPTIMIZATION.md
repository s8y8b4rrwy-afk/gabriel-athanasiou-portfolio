# Incremental Sync Optimization

## Overview

The portfolio sync system has been optimized to **reduce Airtable API usage by up to 90%** through intelligent change detection. Instead of fetching all records from all tables every time, the system now:

1. **Checks for changes** using lightweight timestamp queries (5 API calls)
2. **Fetches only changed records** using targeted queries (1-10 API calls)
3. **Merges with cached data** to maintain complete dataset

---

## API Usage Comparison

### Before Optimization
- **Every sync:** ~50 API calls
- Fetches entire dataset every time
- No change detection

### After Optimization
- **No changes:** 5 API calls (90% reduction)
- **1 project changed:** 6 API calls (88% reduction)
- **5 records changed:** 10 API calls (80% reduction)
- **Force full sync:** 50+ API calls (when needed)

---

## How It Works

### 1. Change Detection (5 API calls)

The system first queries each table for **record IDs and Last Modified timestamps only**:

```bash
GET /Festivals?fields[]=Last%20Modified
GET /Client%20Book?fields[]=Last%20Modified
GET /Projects?fields[]=Last%20Modified
GET /Journal?fields[]=Last%20Modified
GET /Settings?fields[]=Last%20Modified
```

This is extremely lightweight - fetching only two fields per record instead of all fields.

### 2. Comparison

Compares current timestamps with previously stored timestamps to identify:
- **New records** (ID exists in current but not in previous)
- **Changed records** (ID exists in both but timestamp differs)
- **Deleted records** (ID exists in previous but not in current)

### 3. Selective Fetching (1 API call per table with changes)

For tables with changes, fetches **only the specific changed records** using `filterByFormula`:

```bash
GET /Projects?filterByFormula=OR(RECORD_ID()='rec123',RECORD_ID()='rec456')
```

### 4. Data Merging

Merges fetched changes with cached data:
- Changed records → Replaced with fresh data
- Deleted records → Removed from dataset
- Unchanged records → Retrieved from cache (no API call)

---

## Setup Requirements

### One-Time Airtable Configuration

You must add a **Last Modified** formula field to each of these tables:

1. **Projects**
2. **Journal**
3. **Festivals** (Awards)
4. **Client Book**
5. **Settings**

#### Steps:
1. Open table in Airtable
2. Click **+** to add new field
3. Name: `Last Modified`
4. Type: **Formula**
5. Formula: `LAST_MODIFIED_TIME()`
6. Click **Save**

This formula automatically updates whenever any field in the record changes.

> **Note:** Airtable attachment URLs rotate periodically, but `LAST_MODIFIED_TIME()` only updates when actual content changes, not when URLs rotate.

---

## Usage

### Automatic (Default)

When you trigger a manual sync, incremental sync is enabled by default:

```bash
# Via Netlify Function
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now

# Via GitHub Actions
# (Run "Manual Deploy to Netlify" workflow)
```

**Result:** 
- If no changes: 5 API calls, returns cached data
- If changes detected: 5 + N API calls (N = number of changed tables)

### Force Full Sync

To bypass change detection and force a complete refresh:

```bash
# Via Netlify Function
curl -X POST "https://your-site.netlify.app/.netlify/functions/sync-now?force=true"
```

**When to use:**
- First sync after adding `Last Modified` fields
- Suspecting data inconsistency
- Testing
- After Airtable structure changes

---

## Sync Response

The sync endpoint now returns detailed statistics:

```json
{
  "projects": [...],
  "posts": [...],
  "config": {...},
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "version": "1.0",
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

### Response Headers

```
X-Sync-Mode: incremental  (or 'full' or 'cached')
```

---

## Logging Output

Console logs show detailed sync information:

```
=== Starting Airtable Sync ===
Timestamp: 2024-01-15T10:30:00.000Z
Mode: INCREMENTAL (change detection enabled)
🔍 Checking for changes...
  ✏️  Projects: 1 changed record(s)
✅ Change detection complete: 0 new, 1 changed, 0 deleted (5 API calls)
📥 Fetching changed records only...
✅ Fetched 1 changed records from Projects
🔄 Merging with cached data...
Processing data...
...
=== Sync Complete ===
Projects: 23
Posts: 12
API Calls: 6
New: 0, Changed: 1, Deleted: 0, Unchanged: 44
```

---

## Performance Scenarios

### Scenario 1: No Changes
**User action:** Clicks refresh button
**API calls:** 5 (timestamp checks only)
**Result:** Cached data returned immediately
**Time:** ~1 second

### Scenario 2: One Project Updated
**User action:** Edits project title in Airtable, clicks refresh
**API calls:** 6 (5 timestamp checks + 1 fetch changed record)
**Result:** Only updated project fetched, merged with cache
**Time:** ~2 seconds

### Scenario 3: New Journal Post Added
**User action:** Adds new blog post in Airtable, clicks refresh
**API calls:** 6 (5 timestamp checks + 1 fetch new record)
**Result:** New post fetched, added to cached dataset
**Time:** ~2 seconds

### Scenario 4: Multiple Changes Across Tables
**User action:** Updates 2 projects, 1 journal post, 1 client
**API calls:** 9 (5 timestamp checks + 4 table fetches)
**Result:** Changed records fetched from each affected table
**Time:** ~3 seconds

### Scenario 5: Force Full Sync
**User action:** Calls endpoint with `?force=true`
**API calls:** ~50 (fetches all records from all tables)
**Result:** Complete dataset refresh
**Time:** ~10 seconds

---

## Data Storage

### portfolio-data.json Structure

The static JSON file now includes hidden fields for incremental sync:

```json
{
  "projects": [...],
  "posts": [...],
  "config": {...},
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "version": "1.0",
  "source": "scheduled-sync",
  
  // Hidden from API response (stored for next sync)
  "_rawRecords": {
    "projects": [...],      // Raw Airtable records
    "journal": [...],
    "festivals": [...],
    "clients": [...],
    "settings": [...]
  },
  
  "syncMetadata": {
    "lastSync": "2024-01-15T10:30:00.000Z",
    "timestamps": {
      "Projects": {
        "rec123abc": "2024-01-15T09:00:00.000Z",
        "rec456def": "2024-01-14T15:30:00.000Z",
        ...
      },
      "Journal": {...},
      "Festivals": {...},
      "Client Book": {...},
      "Settings": {...}
    }
  }
}
```

### Why Store Raw Records?

Storing raw Airtable records (`_rawRecords`) allows the system to:
- Reconstruct complete dataset without additional API calls
- Merge changed records with unchanged cached records
- Support incremental updates efficiently

---

## Technical Implementation

### Key Functions

#### `fetchTimestamps(tableName)`
Fetches only record IDs and Last Modified timestamps:
```javascript
const timestamps = await fetchTimestamps('Projects');
// Returns: [{ id: 'rec123', lastModified: '2024-01-15T09:00:00.000Z' }, ...]
```

#### `checkForChanges(previousSyncMetadata)`
Compares current timestamps with previous sync:
```javascript
const changes = await checkForChanges(previousData.syncMetadata);
// Returns: {
//   changed: { Projects: ['rec123'] },
//   new: { Journal: ['rec789'] },
//   deleted: { Projects: ['rec456'] },
//   apiCalls: 5,
//   currentTimestamps: {...}
// }
```

#### `fetchChangedRecords(tableName, recordIds, sortField)`
Fetches specific records by ID using filterByFormula:
```javascript
const records = await fetchChangedRecords('Projects', ['rec123', 'rec456'], 'Release Date');
// Returns: Array of full Airtable record objects
```

### Change Detection Logic

```javascript
// For each table
const currentTimestamps = await fetchTimestamps(tableName);
const previousTimestamps = previousData.syncMetadata.timestamps[tableName];

// Find new records
const newRecords = currentTimestamps.filter(r => !previousTimestamps[r.id]);

// Find changed records
const changedRecords = currentTimestamps.filter(r => 
  previousTimestamps[r.id] && 
  previousTimestamps[r.id] !== r.lastModified
);

// Find deleted records
const deletedIds = Object.keys(previousTimestamps).filter(id => 
  !currentTimestamps.find(r => r.id === id)
);
```

---

## Troubleshooting

### "No Last Modified field found"

**Problem:** The `Last Modified` formula field hasn't been added to Airtable tables.

**Solution:** 
1. Add `Last Modified` formula field to all 5 tables (see Setup Requirements above)
2. Run force full sync: `?force=true`

### Unexpected full syncs

**Problem:** System keeps doing full syncs instead of incremental.

**Possible causes:**
- First sync after setup (expected)
- `portfolio-data.json` cache missing or corrupted
- `syncMetadata` missing from cached data
- Timestamp fetch failed (network issue)

**Solution:**
- Check `portfolio-data.json` exists in `/public` or `/tmp`
- Verify `syncMetadata` and `_rawRecords` are present
- Check Netlify function logs for errors

### Changes not detected

**Problem:** Updated records in Airtable but sync shows "no changes".

**Possible causes:**
- Changes made to fields not tracked by `LAST_MODIFIED_TIME()`
- Clock skew between Airtable and your system
- Cached data not saved properly

**Solution:**
- Run force full sync: `?force=true`
- Verify `Last Modified` field updates in Airtable
- Check that changes are to content fields (not views, filters, etc.)

### API usage still high

**Problem:** Still seeing many API calls despite incremental sync.

**Possible causes:**
- Frequent changes to many records
- Force sync being used unnecessarily
- Multiple syncs triggered in quick succession

**Solution:**
- Review change frequency - optimize content workflow
- Only use `?force=true` when necessary
- Implement debouncing for manual sync triggers

---

## Best Practices

### 1. Use Incremental Sync by Default

Let the system automatically detect changes. Only force full sync when:
- Setting up for the first time
- Debugging data issues
- After major Airtable structure changes

### 2. Monitor API Usage

Check sync response logs:
```javascript
{
  "syncStats": {
    "apiCalls": 6,
    "apiCallsSaved": 44  // 88% savings!
  }
}
```

### 3. Batch Content Updates

When making multiple Airtable changes:
1. Make all changes in Airtable
2. **Then** trigger one sync
3. Avoid triggering sync after each individual change

### 4. Understand Cache Behavior

- Syncs update `portfolio-data.json` in `/public` (local) or `/tmp` (deployed)
- CDN caches responses for 1 hour (`max-age=3600`)
- Browser caches for 5 minutes (`max-age=300`)
- If content hasn't changed, sync returns cached data

---

## Migration Guide

### Migrating Existing System

If you're upgrading from the old full-sync approach:

1. **Add `Last Modified` fields** to all 5 Airtable tables (see Setup Requirements)

2. **First sync must be full sync:**
   ```bash
   curl -X POST "https://your-site.netlify.app/.netlify/functions/sync-now?force=true"
   ```
   This populates `syncMetadata` and `_rawRecords` in `portfolio-data.json`

3. **Subsequent syncs are automatic incremental:**
   ```bash
   curl -X POST "https://your-site.netlify.app/.netlify/functions/sync-now"
   ```

4. **Verify in logs:**
   ```
   Mode: INCREMENTAL (change detection enabled)
   ```

---

## Future Enhancements

Potential optimizations for future consideration:

1. **Per-field change tracking** - Track which specific fields changed
2. **Webhook-based sync** - Trigger sync automatically when Airtable changes
3. **Intelligent cache warming** - Pre-fetch likely changes
4. **Multi-level caching** - Cache at record level, not just full dataset
5. **Compression** - Compress `_rawRecords` to reduce storage

---

## Related Documentation

- [SYNC_DEPLOY_GUIDE.md](../SYNC_DEPLOY_GUIDE.md) - Manual sync workflow
- [STATIC_BUILD_ARCHITECTURE.md](../STATIC_BUILD_ARCHITECTURE.md) - Build-time architecture
- [CDN_CACHE_ARCHITECTURE.md](./CDN_CACHE_ARCHITECTURE.md) - CDN caching strategy

---

## Summary

**Before:** 50 API calls every sync
**After:** 5-10 API calls for typical changes (90% reduction)

This optimization significantly extends your Airtable API limits while maintaining fast, accurate content updates.
