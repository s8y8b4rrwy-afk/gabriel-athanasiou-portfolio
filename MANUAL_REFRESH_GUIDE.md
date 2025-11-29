# Manual Content Refresh Guide

## ✅ Status: All Automatic Refreshes DISABLED

No scheduled content refreshes will run automatically. All updates require manual triggering.

---

## 🎯 Manual Refresh Options

### Option 1: GitHub Actions (Recommended)

**Trigger a manual deployment via GitHub:**

1. Go to: https://github.com/s8y8b4rrwy-afk/gabriel-athanasiou-portfolio/actions
2. Click on "Manual Deploy to Netlify" workflow
3. Click "Run workflow" button
4. Optionally add a reason (e.g., "Content update")
5. Click "Run workflow"

**What it does:**
- Creates a deploy marker commit
- Triggers Netlify build automatically
- Runs `npm run build` which includes:
  - `build:data` - Syncs data from Airtable to `portfolio-data.json`
  - `build:sitemap` - Generates sitemap
  - `sync:static` - Uploads static files to Cloudinary CDN
  - Builds the site

---

### Option 2: Netlify Function (API)

**Trigger sync directly via Netlify Function:**

```bash
# Basic sync (standard)
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now

# Realtime sync (with fresh Cloudinary uploads)
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now-realtime
```

**With authentication (if SYNC_TOKEN is set):**
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/sync-now \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN"
```

**What it does:**
- Fetches latest data from Airtable
- Uploads images to Cloudinary (realtime version only)
- Updates `portfolio-data.json` in memory
- Returns updated data as JSON
- **Does NOT trigger a rebuild** - changes visible on next deploy

---

### Option 3: Local Build Script

**Run the build process locally:**

```bash
# Full build process (syncs data and uploads to Cloudinary)
npm run build:data && npm run build:sitemap && npm run sync:static

# Or run individual steps:
npm run build:data           # Sync from Airtable to portfolio-data.json
npm run build:sitemap        # Generate sitemap.xml
npm run sync:static          # Upload to Cloudinary CDN
```

**What it does:**
- Syncs data from Airtable to local `public/portfolio-data.json`
- Generates sitemap
- Uploads static files to Cloudinary
- **Requires pushing changes and triggering deployment**

---

## 📋 Recommended Workflow

### For Content Updates (When You Have Airtable Credits):

1. **Update content in Airtable** (add/edit projects, blog posts, etc.)
2. **Trigger GitHub Action** (Option 1) to rebuild and deploy
3. **Or** run `npm run build` locally and push changes

### For Content Updates (Without Airtable Credits):

1. Work with existing static data in `public/portfolio-data.json`
2. Manually edit the JSON file if needed
3. Run `npm run sync:static` to upload to Cloudinary
4. Push changes and let Netlify deploy

---

## 🔧 Configuration Files

### Disabled Scheduled Functions:
- ✅ All automatic schedules removed
- ✅ All syncs require manual trigger
- ❌ `.github/workflows/scheduled-deploy.yml` - All cron jobs disabled

### Active Manual Triggers:
- ✅ `.github/workflows/manual-deploy.yml` - Manual workflow dispatch
- ✅ `netlify/functions/sync-now.mjs` - Manual sync endpoint
- ✅ `netlify/functions/sync-now-realtime.mjs` - Manual realtime sync endpoint

---

## 🚀 Quick Reference

| Method | Speed | Requires Airtable | Triggers Deploy | Best For |
|--------|-------|-------------------|-----------------|----------|
| GitHub Actions | Medium | Yes | ✅ Yes | Production updates |
| Netlify Function | Fast | Yes | ❌ No | Testing/previewing |
| Local Build | Slow | Yes | ❌ No | Development work |

---

## 🔐 Security Notes

- Set `SYNC_TOKEN` environment variable in Netlify to protect sync endpoints
- GitHub Actions already protected by repository permissions
- Manual triggers require appropriate access to GitHub repo or Netlify dashboard

---

## ❓ Troubleshooting

**"Why isn't my content updating?"**
- Check if you triggered a rebuild (GitHub Actions or manual deploy)
- Verify Airtable credentials are still valid
- Check Netlify build logs for errors

**"Out of Airtable credits?"**
- Use existing static data in `public/portfolio-data.json`
- Wait for credits to refresh
- Or manually edit the JSON file directly

**"Need to force a deploy without content changes?"**
- Use GitHub Actions "Manual Deploy" workflow
- It creates an empty commit with `[deploy]` marker
- Netlify will rebuild even without code changes
