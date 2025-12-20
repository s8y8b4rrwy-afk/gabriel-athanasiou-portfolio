# Instagram Studio - Quick Reference

> **Last Updated:** December 20, 2025

## 🌐 URLs

| Environment | URL |
|-------------|-----|
| Production | https://studio.lemonpost.studio |
| Netlify URL | https://gram-studio.netlify.app |
| Local Dev | http://localhost:5174 |

## 📁 Function Inventory

| Function | Purpose | Scheduled? |
|----------|---------|------------|
| `instagram-scheduled-publish.mjs` | Hourly cron - auto-publish due posts | ✅ `'0 * * * *'` |
| `instagram-publish-now-background.mjs` | Manual "Publish Now" button | ❌ Manual only |
| `instagram-publish.mjs` | Create/publish single posts (API) | ❌ On-demand |
| `instagram-auth.mjs` | OAuth token exchange/refresh | ❌ On-demand |
| `instagram-diagnostic.mjs` | Debug endpoint to check status | ❌ On-demand |
| `instagram-studio-sync.mjs` | Save/load schedule data to Cloudinary | ❌ On-demand |
| `lib/instagram-lib.mjs` | Shared library (all core functions) | N/A |

## ⏰ How Scheduled Publishing Works

1. **Hourly cron** runs `instagram-scheduled-publish.mjs` at minute 0
2. Fetches schedule data from Cloudinary (`instagram-studio/schedule-data`)
3. Finds posts with `status: 'pending'` and `scheduledDate/Time <= now`
4. Publishes each post via Instagram Graph API
5. **Immediately saves** status as `'published'` after each post
6. Sends email notification via Resend

## 🔧 Manual Commands

```bash
# Check what's due for publishing
curl https://studio.lemonpost.studio/.netlify/functions/instagram-diagnostic

# Trigger publish now (bypasses schedule)
curl -X POST https://studio.lemonpost.studio/.netlify/functions/instagram-publish-now-background
```

## 📚 Full Documentation

- **Comprehensive Guide:** `docs/features/INSTAGRAM_STUDIO.md`
- **Old Incident Reports:** `docs/deprecated/INSTAGRAM_*.md`

## 🐛 Recent Bug Fixes (Dec 20, 2025)

### Duplicate Posts Bug (Fixed)
**Problem:** Posts were being published 3-4 times.

**Root Causes Found:**
1. **Two scheduled functions** - Both `instagram-scheduled-publish.mjs` AND `instagram-scheduled-publish-background.mjs` had `schedule: '0 * * * *'`, causing BOTH to run hourly
2. **Cloudinary signature bug** - Saves were failing silently, so posts weren't marked as "published" and got re-published next hour

**Fixes Applied:**
- Deleted `instagram-scheduled-publish-background.mjs` (578 lines of duplicate code)
- Fixed Cloudinary signature in `instagram-lib.mjs` (include `folder`, `invalidate`, correct `public_id`)
- Added `instagramPermalink` to saved status
- Changed to immediate-save-after-publish (not batch save at end)

---

**Status:** ✅ Operational
