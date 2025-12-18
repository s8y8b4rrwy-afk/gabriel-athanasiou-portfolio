# 📚 Documentation Index

> **Quick reference guide to all documentation files**

## 🎯 Primary Documentation

### [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md) - **START HERE**
**The master guide consolidating all documentation**

This is the single source of truth for the entire codebase. Contains:
- ✅ Complete project overview and architecture
- ✅ All recent changes (see [CHANGELOG.md](./CHANGELOG.md) for complete history)
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

### [Configuration & Architecture](./docs/)
- `docs/config/` - Configuration documentation
- `docs/architecture/` - System architecture and design
- `docs/CDN_CACHE_FINAL_IMPLEMENTATION.md` - CDN caching strategy
- `docs/CLOUDINARY_INTEGRATION.md` - Image CDN integration
- `docs/ANALYTICS_SETUP.md` - Analytics configuration
- `docs/SEO_GUIDE.md` - SEO and meta tags
- `docs/PROCEDURAL_THUMBNAILS.md` - SVG artwork generation

---

## 🤖 AI Agent Quick Reference

### Copilot Instructions
- `.github/copilot-instructions.md` - Quick reference for GitHub Copilot (GitHub's standard location)
- Points to `AI_AGENT_GUIDE.md` for full documentation

### Critical Workflow
1. **Before changes:** Read relevant section in `AI_AGENT_GUIDE.md`
2. **After changes:** Update `AI_AGENT_GUIDE.md` immediately
3. **Before commit:** Verify documentation matches code

---

## 📊 Legacy/Archive Files

Files marked as deprecated have been moved to `docs/deprecated/`. These contain historical information but are superseded by the master guide:

- `docs/deprecated/INCREMENTAL_SYNC*.md` - Original incremental sync documentation (content now in AI_AGENT_GUIDE.md)
- `docs/deprecated/DATA_SYNC_FIX.md` - Original data sync fixes
- `docs/deprecated/OWNER_CREDITS_FIX.md` - Original credits formatting fixes
- `docs/deprecated/REFACTORING_SUMMARY.md` - Original refactoring notes

All content from these files has been consolidated into `AI_AGENT_GUIDE.md`.

---

## 🗂️ Documentation Organization

```
gabriel-athanasiou-portfolio--TEST/
│
├── src/                         ⭐ ALL SOURCE CODE (organized)
│   ├── components/              Components organized logically
│   ├── hooks/                   Custom React hooks
│   ├── services/                External API integrations
│   ├── utils/                   Utilities organized by purpose
│   │   ├── helpers/             Text, file, network utilities
│   │   ├── cloudinary/          Cloudinary image handling
│   │   ├── generators/          Sitemap, thumbnails, slugs
│   │   └── __tests__/           Unit tests
│   ├── config/                  Configuration files (JSON)
│   ├── data/                    Static data
│   ├── App.tsx                  Main app component
│   ├── index.tsx                React entry point
│   ├── types.ts                 Global TypeScript types
│   └── theme.ts                 Design tokens and theme
│
├── public/                      Static assets and files
├── scripts/                     Build and utility scripts
│   ├── instagram-studio/        Instagram posting app (separate)
│   └── tests/                   Test utilities and fixtures
├── netlify/                     Netlify functions and edge functions
│
├── docs/                        📚 ALL DOCUMENTATION
│   ├── README.md                Getting started
│   ├── DOCUMENTATION_INDEX.md   This file
│   ├── AI_AGENT_GUIDE.md        Master technical reference ⭐
│   ├── DEPLOYMENT_GUIDE.md      Production deployment
│   ├── IMAGE_OPTIMIZATION.md    Image system details
│   ├── config/                  Configuration documentation
│   │   └── CONFIG_IMAGES_CLOUDINARY.md
│   ├── architecture/            System architecture
│   │   └── STATIC_BUILD.md
│   ├── guides/                  How-to guides
│   │   ├── SYNC_DEPLOY.md
│   │   └── MANUAL_REFRESH.md
│   ├── features/                Feature documentation
│   │   ├── GAME_IMPLEMENTATION.md
│   │   ├── MULTI_PORTFOLIO.md
│   │   ├── INSTAGRAM_STUDIO.md
│   │   └── SHARED_HELPERS.md
│   ├── deprecated/              Archived/obsolete documentation
│   │   ├── INCREMENTAL_SYNC.md
│   │   ├── DATA_SYNC_FIX.md
│   │   └── ... (8 more archived docs)
│   └── testing/                 Test results and logs
│       └── TEST_RESULTS.md
│
├── CODEBASE_ORGANIZATION_PLAN.md  Reference for this reorganization
├── vite.config.ts               Build configuration
├── tsconfig.json                TypeScript configuration
├── package.json                 Dependencies
└── index.html                   HTML entry point (Vite)
```

---

## 💡 Best Practices

### For AI Agents
1. Always read `AI_AGENT_GUIDE.md` before making changes
2. Update the guide after every code change
3. Keep changelog in [CHANGELOG.md](./CHANGELOG.md) updated
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
- Primary: [CHANGELOG.md](./CHANGELOG.md) (complete history)
- Secondary: `AI_AGENT_GUIDE.md` (recent changes only)
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

**Last Updated:** December 6, 2025
