# GitHub Copilot Instructions

> **This is the quick reference for AI assistants. For complete documentation, see [`AI_AGENT_GUIDE.md`](../AI_AGENT_GUIDE.md) at the repo root.**

---

## 🌐 Domains & Data Files

| Portfolio | Domain | Data File | Env Variable |
|-----------|--------|-----------|--------------|
| **Directing** | directedbygabriel.com | `portfolio-data-directing.json` | `PORTFOLIO_MODE=directing` |
| **Post-Production** | lemonpost.studio | `portfolio-data-postproduction.json` | `PORTFOLIO_MODE=postproduction` |
| **Instagram Studio** | studio.lemonpost.studio | N/A (sub-app in `scripts/instagram-studio/`) | — |

Each portfolio uses its own data file synced from Airtable. The `PORTFOLIO_MODE` environment variable controls which data file is loaded and which static files are generated.

---

## 🚀 Quick Dev Commands

```bash
# Portfolio-specific development (RECOMMENDED)
npm run dev:directing      # Directing portfolio (http://localhost:3000)
npm run dev:postprod       # Post-production portfolio (http://localhost:3000)

# Full dev with data sync
npm run dev:directing:full # Sync data + static files + start Vite (directing)
npm run dev:postprod:full  # Sync data + static files + start Vite (postprod)

# General
npm run dev                # Netlify Dev with Functions (http://localhost:8888)
npm run dev:vite           # Vite only, no functions (http://localhost:3000)

# Instagram Studio (sub-app at studio.lemonpost.studio)
npm run instagram-studio   # Start Instagram Studio dev server

# Data Sync
npm run sync:directing     # Sync Airtable → directing data
npm run sync:postprod      # Sync Airtable → postproduction data
npm run sync:both          # Sync both portfolios
npm run sync:all           # Sync data + static files + upload to Cloudinary

# Building
npm run build:directing    # Production build for directing
npm run build:postprod     # Production build for postproduction
```

---

## 📋 AI Agent Workflow

1. **Before making changes:** Read relevant section in `AI_AGENT_GUIDE.md`
2. **After making changes:** Update `AI_AGENT_GUIDE.md` immediately
3. **Before committing:** Verify documentation matches code and update it if needed.

---

## 🚫 Deployment Policy

**NEVER automatically add `[deploy]` or `[force-deploy]` markers to commit messages.**

- Only add deploy markers when the user **explicitly requests** a deployment
- Both the main portfolio sites AND Instagram Studio respect the `[deploy]` marker convention
- Without the marker, Netlify will skip the build (saving build minutes)
- If the user says "push to main" without mentioning deployment, push **without** the marker

**When to add `[deploy]`:**
- User says: "push and deploy", "deploy to production", "trigger a build"
- User explicitly asks for the `[deploy]` marker

**When NOT to add `[deploy]`:**
- User says: "push to main", "commit changes", "push the fix"
- User doesn't mention deployment at all

---

## ⚡ Key Implementation Notes

### Procedural Hero Fallback
- Use `useProceduralThumbnail(title, year, type, undefined, undefined, { showTitle: false, showMetadata: false })` for textless hero
- Procedural slides use `hero-anim` and `hero-anim-gradient` from `GlobalStyles.tsx`

### CTA Behavior (when no hero video)
- Navigate to `/about` and track `contact_cta_click` via `analyticsService`
- Mobile: Center CTA (`absolute inset-0 flex items-center justify-center`)
- Desktop (md+): Bottom-right (`md:bottom-24 md:right-12`)

### Files to Keep in Sync
When modifying hero/CTA logic, update these together:
- `src/components/views/ProjectDetailView.tsx`
- `src/components/GlobalStyles.tsx`
- `src/components/ProceduralThumbnail.tsx`
- `src/utils/thumbnailGenerator.ts`

---

## 📚 Full Documentation

For complete architecture, data structures, changelog, and troubleshooting:

**→ Read [`AI_AGENT_GUIDE.md`](../AI_AGENT_GUIDE.md)**
