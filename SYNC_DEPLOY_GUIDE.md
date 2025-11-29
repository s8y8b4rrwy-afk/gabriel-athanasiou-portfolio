# 📊 Data Sync & Deployment Guide

## Overview

Your portfolio now uses a **completely manual, decoupled workflow**:
- **Data syncing** and **deployments** are separate processes
- **NO automatic schedules** - everything is manual-only
- Syncing data does NOT trigger deployments
- You have full control over when things happen

---

## 🔄 Data Sync Workflow

### What It Does
1. Fetches fresh data from Airtable
2. Generates static JSON files (`portfolio-data.json`, `share-meta.json`, `sitemap.xml`)
3. Commits changes to GitHub for version control
4. Uploads files to Cloudinary CDN for fast global delivery

### How to Trigger

**Option 1: GitHub Actions (Recommended)**
1. Go to: https://github.com/YOUR_USERNAME/gabriel-athanasiou-portfolio/actions
2. Click "Sync Data (Airtable → GitHub + Cloudinary)"
3. Click "Run workflow"
4. Enter optional reason
5. Click "Run workflow" button

**Option 2: Local Development**
```bash
# Sync from Airtable to local files
npm run build:data

# Upload to Cloudinary CDN
npm run sync:static

# Then commit and push
git add public/*.json public/sitemap.xml
git commit -m "chore: sync data from Airtable [ci skip]"
git push
```

**Option 3: Netlify Function**
```bash
# Manual sync via API endpoint
curl -X POST https://YOUR_SITE.netlify.app/.netlify/functions/sync-now \
  -H "Authorization: Bearer YOUR_SYNC_TOKEN"
```

### Important Notes
- ⚠️ **Does NOT trigger deployment** - website won't update until you deploy
- ✅ Changes are saved to GitHub (version control)
- ✅ Changes are uploaded to Cloudinary CDN
- 💰 Uses Airtable API credits only when you run it

---

## 🚀 Deployment Workflow

### What It Does
1. Adds a deploy marker commit to trigger Netlify
2. Netlify builds and deploys your site
3. Site goes live with latest code and data

### How to Trigger

**Option 1: GitHub Actions (Recommended)**
1. Go to: https://github.com/YOUR_USERNAME/gabriel-athanasiou-portfolio/actions
2. Click "Deploy to Netlify"
3. Click "Run workflow"
4. Enter optional reason
5. Click "Run workflow" button

**Option 2: Git Commit**
```bash
# Any commit with [deploy] or [force-deploy] in the message
git commit --allow-empty -m "chore: deploy site [deploy]"
git push
```

**Option 3: Netlify Dashboard**
1. Go to https://app.netlify.com
2. Select your site
3. Click "Trigger deploy" → "Deploy site"

### Important Notes
- ⚠️ **Does NOT sync data** - deploys whatever is in GitHub
- ✅ Builds from latest GitHub code
- ✅ Uses data files already in GitHub
- 💡 Run "Sync Data" first if you need fresh content

---

## 📋 Common Workflows

### Update Content and Deploy
```
1. Run "Sync Data" workflow (GitHub Actions)
2. Wait for completion (~2-3 minutes)
3. Run "Deploy to Netlify" workflow (GitHub Actions)
4. Wait for deployment (~3-5 minutes)
5. Your site is live with fresh content! 🎉
```

### Deploy Code Changes Only
```
1. Make code changes locally
2. Commit and push to GitHub
3. Run "Deploy to Netlify" workflow
```

### Update Content Without Deploying
```
1. Run "Sync Data" workflow
2. Files are saved to GitHub + Cloudinary
3. Deploy later when ready
```

---

## 🎯 Key Benefits

✅ **No Surprise Costs** - Airtable API only used when you trigger it  
✅ **Full Control** - You decide when to sync and when to deploy  
✅ **Decoupled** - Data changes don't force rebuilds  
✅ **Version Control** - All data changes tracked in GitHub  
✅ **CDN Delivery** - Fast global content delivery via Cloudinary  
✅ **Resilient** - Multiple fallback layers (CDN → GitHub → Default)  

---

## 🛠️ Technical Details

### Data Flow
```
Airtable (CMS)
    ↓
[Sync Data Workflow]
    ↓
GitHub (version control) + Cloudinary CDN (fast delivery)
    ↓
[Deploy Workflow]
    ↓
Netlify (static site)
    ↓
Your Website (live)
```

### Files Synced
- `public/portfolio-data.json` - All projects, posts, config
- `public/share-meta.json` - Social sharing metadata
- `public/sitemap.xml` - SEO sitemap

### Where Data Lives
1. **Primary**: Cloudinary CDN (`https://res.cloudinary.com/...`)
2. **Fallback**: Local GitHub files (`/portfolio-data.json`)
3. **Last Resort**: Default empty config

---

## ⚠️ Important Changes

### What Was Removed
- ❌ All scheduled/automatic syncs
- ❌ Automatic deployment triggers from sync
- ❌ Midnight data checks
- ❌ Daily Airtable polling

### What You Have Now
- ✅ Manual GitHub Actions workflows
- ✅ Separate sync and deploy processes
- ✅ Full control over when things run
- ✅ Lower Airtable API costs

---

## 🆘 Troubleshooting

**Q: I synced data but the site hasn't updated**  
A: Syncing doesn't deploy. Run the "Deploy to Netlify" workflow.

**Q: Can I automate this?**  
A: No automatic scheduling is configured. All syncs and deploys are manual-only to save costs and give you full control.

**Q: How do I check if sync worked?**  
A: Check the GitHub Actions logs or verify files in the repository.

**Q: The site is loading old data**  
A: Clear your browser cache or check if Cloudinary CDN has the latest files.

---

## 📞 Quick Reference

| Task | Command | Location |
|------|---------|----------|
| Sync Data | GitHub Actions → "Sync Data" | [Actions Tab](https://github.com/YOUR_USERNAME/gabriel-athanasiou-portfolio/actions) |
| Deploy Site | GitHub Actions → "Deploy to Netlify" | [Actions Tab](https://github.com/YOUR_USERNAME/gabriel-athanasiou-portfolio/actions) |
| Local Sync | `npm run build:data` | Terminal |
| Upload to CDN | `npm run sync:static` | Terminal |
| Check Logs | Netlify Dashboard | https://app.netlify.com |

---

**Last Updated**: November 29, 2025  
**Workflow Version**: 2.0 (Manual-Only)
