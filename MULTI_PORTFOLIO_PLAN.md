# Multi-Portfolio Architecture Plan

> **Status**: ✅ IMPLEMENTED - Static Files & Build Architecture Complete  
> **Date**: December 2025  
> **Last Updated**: December 3, 2025

## Implementation Status

### ✅ Completed
- Portfolio-specific static file generation (`sitemap-{mode}.xml`, `share-meta-{mode}.json`, `robots-{mode}.txt`)
- Cloudinary uploads with portfolio-specific public IDs
- Edge function (`meta-rewrite.ts`) portfolio-aware
- Sitemap function (`sitemap.js`) fetches from Cloudinary
- Build scripts for both portfolios
- Incremental sync works for both portfolios

### Domains
- **Directing**: `directedbygabriel.com`
- **Post-Production**: `lemonpost.studio`

---

## Overview

This document outlines the plan to create a **second portfolio website** for post-production work, using the **same codebase** as the existing directing portfolio. Both sites will share the same Airtable database and project records, but display different content based on configuration.

---

## The Idea

### Current State
- Single portfolio website for **directing work**
- Projects filtered by `allowedRoles` (e.g., "Director")
- Single Settings row in Airtable
- Journal/blog functionality
- Single Netlify deployment

### Target State
- **Two portfolio websites** from one codebase:
  - **Directing Portfolio** (existing domain)
  - **Post-Production Portfolio** (new separate domain)
- Same Airtable base, same project records
- Each site shows only relevant projects based on role
- Independent featured/hero status per portfolio
- Different branding (logo, fonts, nav title)
- Journal only on directing site
- Post-production site links back to directing site

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AIRTABLE CMS                            │
├─────────────────────────────────────────────────────────────┤
│  Projects Table (shared)                                    │
│  ├── Project A: Role = "Director"          → Directing only │
│  ├── Project B: Role = "Colorist"          → Post-prod only │
│  └── Project C: Role = ["Director", "Colorist"] → Both      │
├─────────────────────────────────────────────────────────────┤
│  Settings Table                                             │
│  ├── Row 1: Portfolio ID = "directing"                      │
│  │          allowedRoles = ["Director"]                     │
│  │          hasJournal = true                               │
│  │          navTitle = "Gabriel Athanasiou"                 │
│  │                                                          │
│  └── Row 2: Portfolio ID = "postproduction"                 │
│             allowedRoles = ["Colorist", "Editor", "VFX"]    │
│             hasJournal = false                              │
│             navTitle = "TBD"                                │
├─────────────────────────────────────────────────────────────┤
│  Journal Table (only synced for directing)                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    GITHUB REPO                              │
│                  (Single Codebase)                          │
│                                                             │
│   public/portfolio-data.json  ← GITIGNORED                  │
│   (generated at build time, different per site)             │
└─────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────┐      ┌─────────────────────┐
│   NETLIFY SITE 1    │      │   NETLIFY SITE 2    │
│   (Directing)       │      │   (Post-Production) │
├─────────────────────┤      ├─────────────────────┤
│ ENV:                │      │ ENV:                │
│ PORTFOLIO_MODE=     │      │ PORTFOLIO_MODE=     │
│   directing         │      │   postproduction    │
├─────────────────────┤      ├─────────────────────┤
│ Features:           │      │ Features:           │
│ ✅ Journal          │      │ ❌ Journal          │
│ ✅ Director logo    │      │ ✅ Post-prod logo   │
│ ✅ Director SEO     │      │ ✅ Post-prod SEO    │
│ ❌ Other site link  │      │ ✅ Link to directing│
└─────────────────────┘      └─────────────────────┘
           │                              │
           ▼                              ▼
   directingdomain.com         postproddomain.com
```

---

## Key Decisions

| Aspect | Decision |
|--------|----------|
| **Codebase** | Single repo, no duplication |
| **JSON data files** | Same filename (`portfolio-data.json`), different content per build |
| **Settings** | Two rows in Airtable, selected by `Portfolio ID` |
| **Featured status** | Separate field per portfolio |
| **Fonts** | Space Grotesk for post-prod, current font for directing |
| **Nav title** | Configurable via Settings (TBD for post-prod) |
| **Work section label** | "Filmography" for directing, "All Work" for post-prod |
| **Accent color** | Same for now, configurable later |
| **Journal** | Directing only |
| **Cross-portfolio link** | Post-prod footer only |
| **Domains** | Separate domains (TBD) |
| **Role filtering** | Post-prod only - filter by role (Editor, Colourist, VFX, etc.) |

---

## Role-Based Filtering (Post-Production Only)

The post-production portfolio will have an additional filter on the work page that allows visitors to filter projects by the **Role** field. This is separate from and in addition to the existing project type filter.

### Filter Options
- **All** (default) - shows all projects
- **Colourist** - shows projects where Role includes "Colourist"
- **Editor** - shows projects where Role includes "Editor"  
- **VFX & Beauty Work** - shows projects where Role includes "VFX" or similar

### UI Behavior
- Filter appears as a secondary row of buttons/pills below the type filter (or integrated alongside)
- Only visible on post-production site (controlled by `config.showRoleFilter`)
- "All" is selected by default
- Clicking a role filters the project grid in real-time
- Can be combined with type filter (e.g., "Commercial" + "Colourist")

### Implementation Notes
- The available role options will be derived from `config.allowedRoles` 
- The filter will match against the project's `Role` field (which can contain multiple roles)
- This filter only appears on the `/work` page, not on the home featured grid

---

## ⚠️ START HERE: Airtable Setup

Before any code changes, the Airtable schema must be updated.

### Settings Table - Add These Fields

| Field Name | Type | Notes |
|------------|------|-------|
| `Portfolio ID` | Single line text | **Required**. Values: `directing` or `postproduction` |
| `Site Title` | Single line text | Browser tab title, footer text |
| `Nav Title` | Single line text | Text shown in navigation bar |
| `SEO Title` | Single line text | Meta title for search engines |
| `SEO Description` | Long text | Meta description for search engines |
| `Domain` | Single line text | For canonical URLs (e.g., `gabrielathanasiou.com`) |
| `Logo` | Attachment | Portfolio logo image |
| `Favicon` | Attachment | Browser favicon |
| `Font Family` | Single line text | Google Font name (e.g., `Space Grotesk`) |
| `Work Section Label` | Single line text | Label for work section (e.g., `Filmography` or `All Work`) |
| `Has Journal` | Checkbox | Whether to show journal section |
| `Show Role Filter` | Checkbox | Whether to show role-based filter on work page |
| `Show Other Portfolio Link` | Checkbox | Whether to show link to other portfolio |
| `Other Portfolio URL` | URL | Link destination |
| `Other Portfolio Label` | Single line text | Link text (e.g., "Directing Work") |
| `About Layout` | Single select | Options: `standard` (for future expansion) |

### Settings Table - Create Two Rows

**Row 1: Directing Portfolio**
| Field | Value |
|-------|-------|
| Portfolio ID | `directing` |
| Site Title | `Gabriel Athanasiou` |
| Nav Title | `Gabriel Athanasiou` |
| SEO Title | `Gabriel Athanasiou - Director` |
| SEO Description | (your director-focused description) |
| Domain | (your directing domain) |
| Logo | (upload directing logo) |
| Font Family | `Inter` (or current font) |
| Work Section Label | `Filmography` |
| Has Journal | ✅ Checked |
| Show Role Filter | ☐ Unchecked |
| Show Other Portfolio Link | ☐ Unchecked |
| About Layout | `standard` |
| *(keep existing fields)* | *(Bio, Email, Reps, etc.)* |

**Row 2: Post-Production Portfolio**
| Field | Value |
|-------|-------|
| Portfolio ID | `postproduction` |
| Site Title | (TBD) |
| Nav Title | (TBD) |
| SEO Title | (e.g., `Gabriel Athanasiou - Colorist & Editor`) |
| SEO Description | (your post-production focused description) |
| Domain | (TBD) |
| Logo | (upload post-prod logo) |
| Font Family | `Space Grotesk` |
| Work Section Label | `All Work` |
| Has Journal | ☐ Unchecked |
| Show Role Filter | ✅ Checked |
| Show Other Portfolio Link | ✅ Checked |
| Other Portfolio URL | (directing site URL) |
| Other Portfolio Label | `Directing Work` |
| About Layout | `standard` |
| *(fill other fields)* | *(Bio, Email, Reps for post-prod, etc.)* |

### Projects Table - Add This Field

| Field Name | Type | Options |
|------------|------|---------|
| `Display Status (Post)` | Single select | `Hidden`, `Listed`, `Featured`, `Hero` |

This field controls visibility and featured status on the **post-production portfolio**, independent of the existing `Display Status` field (which controls the directing portfolio).

### Projects Table - Update Existing Records

For each project, set the `Display Status (Post)` value:
- **If you want it on the post-prod site as Hero**: `Hero`
- **If you want it featured on post-prod**: `Featured`
- **If you want it listed but not featured**: `Listed`
- **If you don't want it on post-prod**: `Hidden` or leave empty

> **Note**: A project only appears on a portfolio if:
> 1. The project's `Role` field matches the portfolio's `allowedRoles`, AND
> 2. The relevant Display Status field is not `Hidden`/empty

---

## How Project Filtering Works

### Example Scenarios

| Project | Role | Display Status | Display Status (Post) | Result |
|---------|------|----------------|----------------------|--------|
| Brand Film A | Director | Featured | Hidden | Directing only (Featured) |
| Music Video B | Director, Colorist | Hero | Featured | Both sites |
| Commercial C | Colorist | Hidden | Hero | Post-prod only (Hero) |
| Short Film D | Director | Listed | (empty) | Directing only |
| Documentary E | Editor | (empty) | Listed | Post-prod only |

---

## Implementation Plan

### Phase 1: Airtable Setup (YOU DO THIS FIRST)
- [ ] Add all new fields to Settings table (see list above)
- [ ] Create Row 1 with directing configuration
- [ ] Create Row 2 with post-production configuration
- [ ] Add `Display Status (Post)` field to Projects table
- [ ] Go through all projects and set `Display Status (Post)` values
- [ ] Notify developer when complete

### Phase 2: Types & Sync (Code Changes)
- [ ] Update `types.ts` - add new config fields to `HomeConfig`
- [ ] Update `sync-core.mjs` - accept `PORTFOLIO_MODE` environment variable
- [ ] Update `sync-core.mjs` - filter Settings by `portfolioId`
- [ ] Update `sync-core.mjs` - use correct display status field per portfolio
- [ ] Update `sync-core.mjs` - skip Journal sync if `hasJournal = false`
- [ ] Update `sync-data.mjs` - pass `PORTFOLIO_MODE` to sync
- [ ] Test sync with `PORTFOLIO_MODE=directing`
- [ ] Test sync with `PORTFOLIO_MODE=postproduction`

### Phase 3: Frontend Core (Code Changes)
- [ ] Update `Navigation.tsx` - use `config.navTitle` instead of hardcoded name
- [ ] Update `Navigation.tsx` - use `config.logo` for logo image
- [ ] Update `Navigation.tsx` - conditionally show Journal link based on `config.hasJournal`
- [ ] Update `Navigation.tsx` - conditionally show Work Section Label from `config.workSectionLabel`
- [ ] Update `SEO.tsx` - use `config.seoTitle`, `config.seoDescription`, `config.domain`
- [ ] Update `App.tsx` - conditionally register `/journal` routes
- [ ] Update `Footer.tsx` - add "Other Portfolio" link based on config

### Phase 3b: Role Filter (Post-Production Only)
- [ ] Update `IndexView.tsx` - add role filter UI (only when `config.showRoleFilter` is true)
- [ ] Add state for selected role filter (default: "All")
- [ ] Filter projects by role in addition to existing type filter
- [ ] Style role filter to match existing type filter design
- [ ] Ensure filter is responsive on mobile

### Phase 4: Styling (Code Changes)
- [ ] Add Google Fonts loading logic for `config.fontFamily`
- [ ] Add CSS variable injection for font and accent color
- [ ] Update `GlobalStyles.tsx` or `theme.ts` to use CSS variables

### Phase 5: Local Development Setup
- [ ] Add npm scripts for both portfolio modes:
  ```json
  {
    "dev:directing": "PORTFOLIO_MODE=directing npm run sync && vite",
    "dev:postprod": "PORTFOLIO_MODE=postproduction npm run sync && vite",
    "sync:directing": "PORTFOLIO_MODE=directing node scripts/sync-data.mjs",
    "sync:postprod": "PORTFOLIO_MODE=postproduction node scripts/sync-data.mjs"
  }
  ```
- [ ] Ensure `portfolio-data.json` is in `.gitignore`
- [ ] Test both modes locally

### Phase 6: Deployment
- [ ] Create second Netlify site pointing to same GitHub repo
- [ ] Configure environment variables on directing site:
  - `PORTFOLIO_MODE=directing`
  - `AIRTABLE_TOKEN=xxx`
  - `AIRTABLE_BASE_ID=xxx`
- [ ] Configure environment variables on post-production site:
  - `PORTFOLIO_MODE=postproduction`
  - `AIRTABLE_TOKEN=xxx`
  - `AIRTABLE_BASE_ID=xxx`
- [ ] Configure custom domain for post-production site
- [ ] Test both deployments independently
- [ ] Verify syncing works correctly on both

### Phase 7: Polish
- [ ] Fine-tune visual differences between sites
- [ ] Verify SEO tags are correct on both sites
- [ ] Test "Other Portfolio" link on post-prod site
- [ ] Final review of both portfolios

---

## Local Development

Once implemented, use these commands:

```bash
# Work on directing version
npm run dev:directing

# Work on post-production version
npm run dev:postprod

# Sync directing data only
npm run sync:directing

# Sync post-production data only
npm run sync:postprod
```

---

## Debugging Tips

### Verify Correct Data is Loaded
After syncing, check `public/portfolio-data.json`:
- Is `config.portfolioId` correct?
- Are the right projects included?
- Is `config.hasJournal` correct?
- Are `posts` empty for post-production?

### Check Project Filtering
If a project is missing:
1. Does its `Role` field match the portfolio's `allowedRoles`?
2. Is the relevant Display Status field set (not Hidden/empty)?

### Test Both Modes
Always test changes in both portfolio modes before deploying.

---

## Future Enhancements (Optional)

- Different accent colors per portfolio
- Different about page layouts
- Different footer designs
- Additional portfolios (e.g., photography)
- Shared analytics dashboard

---

## Questions to Resolve

- [ ] Post-production site nav title (TBD)
- [ ] Post-production domain (TBD)
- [ ] Any additional design differences?

---

## Contact

When Airtable setup is complete, notify the developer to begin code implementation.
