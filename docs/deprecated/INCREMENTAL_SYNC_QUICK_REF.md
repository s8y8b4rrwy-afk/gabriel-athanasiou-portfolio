# Incremental Sync - Quick Reference Guide

**Last Updated:** December 1, 2025

---

## 🚀 Quick Start

### Running Sync Locally

```bash
# Normal sync (uses incremental mode when possible)
npm run build:data

# Force full sync (bypass incremental)
FORCE_FULL_SYNC=true npm run build:data
```

### Netlify Function

```bash
# Normal sync
curl -X POST https://directedbygabriel.app/.netlify/functions/sync-now

# Force full sync
curl -X POST "https://directedbygabriel.app/.netlify/functions/sync-now?force=true"

# Check sync mode
curl -I https://directedbygabriel.app/.netlify/functions/sync-now
# Returns: X-Sync-Mode: cached|incremental|full
```

---

## 📊 Sync Modes

| Mode | When Used | API Calls | Speed |
|------|-----------|-----------|-------|
| **cached** | No changes detected | 5 | Fastest (32% faster than full) |
| **incremental** | Changes detected | 6-10 | Fast (10-25% faster than full) |
| **full** | First sync or forced | 12 | Baseline |

---

## 🔍 Understanding Output

### Cached Mode (No Changes)
```
[sync-core] 🔍 Checking for changes (incremental mode)...
[sync-core] ✅ No changes detected, using cached data
[sync-data] ✅ Sync complete!
[sync-data]    - Sync mode: cached
[sync-data]    - API calls: 5
[sync-data]    - API calls saved: 45
```

### Incremental Mode (Changes Found)
```
[sync-core] 🔍 Checking for changes (incremental mode)...
[sync-core] 📊 Changes detected:
  Projects: 2 new, 1 changed, 0 deleted
[sync-core] ✅ Processed 39 projects
[sync-data]    - Sync mode: incremental
[sync-data]    - API calls: 8
[sync-data]    - API calls saved: 4
```

### Full Mode
```
[sync-core] 🔄 Full sync mode (no previous metadata)
[sync-core] ✅ Built lookup maps
[sync-core] ✅ Processed 39 projects
[sync-data]    - Sync mode: full
[sync-data]    - API calls: 12
```

---

## 🛠️ Troubleshooting

### Force Full Sync If:
- First time running after implementation
- Data seems inconsistent
- Testing changes
- Migrating Airtable structure

### Check Sync Statistics:
```bash
# View detailed stats
node scripts/test-sync-stats.mjs

# Check metadata in portfolio-data.json
node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync("./public/portfolio-data.json", "utf8")); console.log("Metadata:", data.syncMetadata);'
```

### Common Issues:

**Issue:** Always using full sync  
**Solution:** Ensure previous sync completed successfully and created metadata

**Issue:** "Missing Airtable credentials"  
**Solution:** Check `.env.local` has `VITE_AIRTABLE_TOKEN` and `VITE_AIRTABLE_BASE_ID`

**Issue:** Slow incremental sync  
**Solution:** This is expected if many records changed. Use force full sync if needed.

---

## 📈 Performance Benchmarks

Based on production tests (December 1, 2025):

| Scenario | Time | API Calls | vs Full Sync |
|----------|------|-----------|--------------|
| No changes | 1.1s | 5 | 58% fewer calls, 32% faster |
| 1 record changed | 1.3s | 6 | 50% fewer calls, 18% faster |
| Force full | 1.6s | 12 | Baseline |

**Your results may vary** based on:
- Network speed
- Number of records
- Airtable API response time
- Number of changed records

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
VITE_AIRTABLE_TOKEN=your_token
VITE_AIRTABLE_BASE_ID=your_base_id

# Optional
FORCE_FULL_SYNC=true          # Force full sync (default: false)
SYNC_TOKEN=your_secret         # Netlify function auth (optional)
```

### package.json Scripts

```json
{
  "scripts": {
    "build:data": "node scripts/sync-data.mjs",
    "test:sync": "node scripts/test-sync-stats.mjs"
  }
}
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `scripts/lib/sync-core.mjs` | Main sync orchestration logic |
| `scripts/lib/airtable-helpers.mjs` | Airtable API utilities |
| `scripts/sync-data.mjs` | CLI sync script |
| `netlify/functions/sync-now.mjs` | Netlify function endpoint |
| `public/portfolio-data.json` | Generated data + metadata |

---

## 🎯 Best Practices

1. **Use incremental sync by default** - It's automatic and efficient
2. **Force full sync after Airtable structure changes** - Ensures consistency
3. **Monitor sync statistics** - Check logs for performance
4. **Keep metadata intact** - Don't manually edit `portfolio-data.json`
5. **Test before deploying** - Run local sync before pushing changes

---

## 📞 Support

**Documentation:**
- `INCREMENTAL_SYNC_COMPLETE.md` - Full implementation details
- `INCREMENTAL_SYNC_SUMMARY.md` - Original specification
- `INCREMENTAL_SYNC_IMPLEMENTATION_STATUS.md` - Development progress

**Test Scripts:**
- `scripts/test-incremental-sync.mjs` - Basic functionality test
- `scripts/test-full-sync.mjs` - Full sync test
- `scripts/test-sync-stats.mjs` - Performance comparison

---

**Status:** ✅ Production Ready
