# Incremental Sync - Quick Reference

## Setup (One-Time)

Add `Last Modified` formula field to **all 5 Airtable tables**:

1. Projects
2. Journal  
3. Festivals
4. Client Book
5. Settings

**Formula:** `LAST_MODIFIED_TIME()`

## Usage

### Normal Sync (Incremental)
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now
```
**API Calls:** 5-10 (when changes exist), 5 (when no changes)

### Force Full Sync
```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/sync-now?force=true"
```
**API Calls:** ~50 (fetches everything)

**Use when:**
- First sync after adding `Last Modified` fields
- Debugging data issues
- After Airtable structure changes

## API Savings

| Scenario | Airtable API | Cloudinary API | Total Savings |
|----------|--------------|----------------|---------------|
| No changes | 5 | 0 | ~95% |
| 1 record changed | 6 | 1-3 images | ~90% |
| 5 records changed | 10 | 5-15 images | ~80% |
| Force full sync | 50+ | 50+ images | 0% |

## Cloudinary Integration

**How it works:**
- Cloudinary checks only run for changed Airtable records
- Uses `cloudinary.api.resource(publicId)` to verify image exists
- Only uploads images that are truly missing
- Deterministic naming: `portfolio-projects-{recordId}-{index}`

**Benefits:**
- No local mapping file dependency
- Works across all environments (CI/CD, Netlify, local)
- Handles corrupted/missing cache gracefully

## Response Example

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

## Troubleshooting

**Problem:** "No Last Modified field found"
**Solution:** Add `Last Modified` formula to all tables, then run `?force=true`

**Problem:** Still seeing high API usage
**Solution:** Check if `?force=true` is being used unnecessarily

**Problem:** Changes not detected
**Solution:** Run `?force=true` once to rebuild cache

---

For detailed documentation, see [INCREMENTAL_SYNC_OPTIMIZATION.md](./INCREMENTAL_SYNC_OPTIMIZATION.md)
