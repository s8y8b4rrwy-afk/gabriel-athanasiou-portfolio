# 📚 Documentation Index

> **Quick reference guide to all documentation files**

## 🎯 Primary Documentation

### [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) - **START HERE**
**The master guide consolidating all documentation**

This is the single source of truth for the entire codebase. Contains:
- ✅ Complete project overview and architecture
- ✅ All recent changes (changelog at top)
- ✅ Data structures and Airtable schema mappings
- ✅ Environment setup instructions
- ✅ Development workflows
- ✅ Deployment and CI/CD processes
- ✅ Performance optimization details
- ✅ Troubleshooting guides
- ✅ Common tasks and examples

**For AI agents:** Read this file entirely before making any changes.  
**For developers:** Use this as your primary reference for all technical decisions.

---

## 📖 Quick Start Guides

### [README.md](./README.md)
Quick start guide for developers
- Installation instructions
- Basic commands
- Links to detailed documentation

### [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
Step-by-step Netlify deployment guide
- Domain setup instructions
- Squarespace migration
- Troubleshooting deployment issues

---

## 🔧 Supplementary Documentation

These guides provide additional context but **all critical information is in AI_AGENT_GUIDE.md**:

### Core Systems
- `docs/CDN_CACHE_FINAL_IMPLEMENTATION.md` - CDN architecture details
- `docs/CLOUDINARY_INTEGRATION.md` - Image optimization system
- `IMAGE_OPTIMIZATION.md` - Build-time image processing
- **`docs/INCREMENTAL_SYNC_OPTIMIZATION.md`** - 90% API usage reduction guide ⭐
- **`SHARED_HELPERS_REFACTORING.md`** - Shared utilities library and unit tests ⭐ **NEW**
- `docs/INCREMENTAL_SYNC_QUICK_REF.md` - Quick reference for incremental sync

### Setup & Configuration
- `docs/ENV_SETUP.md` - Environment variables reference
- `docs/ANALYTICS_SETUP.md` - Google Analytics configuration
- `docs/SEO_GUIDE.md` - SEO and meta tags

### Features
- `docs/PROCEDURAL_THUMBNAILS.md` - SVG artwork generation
- `docs/SCROLL_RESTORATION.md` - Scroll position handling
- `docs/HOVER_ANIMATIONS.md` - Interactive animations

### CI/CD & Sync
- `.github/SCHEDULED_DEPLOY_SETUP.md` - GitHub Actions workflows
- `SYNC_DEPLOY_GUIDE.md` - Manual sync workflow
- `STATIC_BUILD_ARCHITECTURE.md` - Build-time data architecture
- `docs/COMPRESSION_COMPARISON.md` - Image compression analysis
- **`docs/NETLIFY_SYNC_FUNCTION.md`** - Netlify serverless function limitations ⭐ **NEW**

---

## 🤖 AI Agent Quick Reference

### Alias Files (Point to AI_AGENT_GUIDE.md)
- `copilot-instructions.md` - Copilot alias
- `COPILOT.md` - Copilot alias

These files exist for compatibility but redirect to the master guide.

### Critical Workflow
1. **Before changes:** Read relevant section in `AI_AGENT_GUIDE.md`
2. **After changes:** Update `AI_AGENT_GUIDE.md` immediately
3. **Before commit:** Verify documentation matches code

---

## 📊 Legacy/Archive Files

These files contain historical information but are superseded by the master guide:

- `IMPLEMENTATION_LOG.md` - Original implementation notes (content now in AI_AGENT_GUIDE.md)
- ~~`IMPLEMENTATION_LOG 2.md`~~ ✅ Deleted
- ~~`SPEED_IMPROVEMENTS_SUMMARY 2.md`~~ ✅ Deleted  
- ~~`docs/CDN_CACHE_ARCHITECTURE 2.md`~~ ✅ Deleted
- `docs/CDN_CACHE_ARCHITECTURE.md` - Draft version (superseded by FINAL_IMPLEMENTATION)

**Additional cleaned files:**
- ~~`components/views/ImageCompressionView 2.tsx`~~ ✅ Deleted
- ~~`components/views/ThumbnailPreviewView 2.tsx`~~ ✅ Deleted
- ~~`config/compressionPresets 2.json`~~ ✅ Deleted
- ~~`hooks/useBackgroundDataSync 2.ts`~~ ✅ Deleted
- ~~`scripts/generate-compression-samples 2.mjs`~~ ✅ Deleted

All content from these files has been consolidated into `AI_AGENT_GUIDE.md`.

---

## 🗂️ Documentation Organization

```
gabriel-athanasiou-portfolio--TEST/
│
├── AI_AGENT_GUIDE.md            ⭐ PRIMARY - Start here
├── README.md                    📖 Quick start
├── DEPLOYMENT_GUIDE.md          🚀 Deployment guide
├── IMAGE_OPTIMIZATION.md        🖼️ Image system
├── DOCUMENTATION_INDEX.md       📚 This file
│
├── copilot-instructions.md      🔗 Alias → AI_AGENT_GUIDE.md
├── COPILOT.md                   🔗 Alias → AI_AGENT_GUIDE.md
│
├── docs/                        📁 Supplementary guides
│   ├── CDN_CACHE_FINAL_IMPLEMENTATION.md
│   ├── CLOUDINARY_INTEGRATION.md
│   ├── ENV_SETUP.md
│   ├── ANALYTICS_SETUP.md
│   ├── SEO_GUIDE.md
│   ├── PROCEDURAL_THUMBNAILS.md
│   └── ...
│
└── .github/                     🔧 CI/CD workflows
    └── SCHEDULED_DEPLOY_SETUP.md
```

---

## 💡 Best Practices

### For AI Agents
1. Always read `AI_AGENT_GUIDE.md` before making changes
2. Update the guide after every code change
3. Keep changelog at top of file updated
4. Verify data structure mappings are current

### For Developers
1. Start with `README.md` for quick setup
2. Use `AI_AGENT_GUIDE.md` as primary reference
3. Check supplementary docs for deep dives
4. Update documentation when adding features

### For Content Managers
1. All content managed in Airtable
2. Changes appear within 24 hours automatically
3. No code deployment needed
4. See `AI_AGENT_GUIDE.md` → "Common Tasks" section

---

## 🔄 Keeping Documentation Current

**When to Update:**
- ✅ After adding/removing features
- ✅ After changing data structures
- ✅ After modifying architecture
- ✅ After fixing major bugs
- ✅ After deployment changes

**What to Update:**
- Primary: `AI_AGENT_GUIDE.md` changelog section
- Secondary: Relevant supplementary docs
- Tertiary: This index if file structure changes

---

## 📞 Need Help?

**For technical questions:**
- Check `AI_AGENT_GUIDE.md` → "Troubleshooting" section
- Review relevant supplementary documentation
- Check GitHub Issues (if available)

**For content questions:**
- Airtable documentation: https://airtable.com/api
- See data structure mappings in `AI_AGENT_GUIDE.md`

**For deployment questions:**
- See `DEPLOYMENT_GUIDE.md`
- Check Netlify dashboard logs
- Review `AI_AGENT_GUIDE.md` → "Deployment & CI/CD" section

---

**Last Updated:** November 27, 2025
