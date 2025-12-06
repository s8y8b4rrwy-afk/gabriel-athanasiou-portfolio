# 📁 Codebase Organization Plan

> Restructuring the codebase for clarity and maintainability without breaking functionality

## Current Issues Identified

### 1. Documentation Sprawl (Root Level)
**Problem:** 25+ markdown files at the root level, many documenting obsolete features or containing duplicated information.

**Files to Move to `docs/`:**
- `CONFIG_IMAGES_CLOUDINARY.md` → `docs/config/CLOUDINARY_CONFIG.md`
- `DATA_SYNC_FIX_DOCUMENTATION.md` → `docs/deprecated/DATA_SYNC_FIX.md`
- `GAME_IMPLEMENTATION_PLAN.md` → `docs/features/GAME_IMPLEMENTATION.md`
- `INCREMENTAL_CLOUDINARY_SYNC.md` → `docs/deprecated/INCREMENTAL_SYNC.md`
- `INCREMENTAL_SYNC_COMPLETE.md` → `docs/deprecated/INCREMENTAL_SYNC_COMPLETE.md`
- `INCREMENTAL_SYNC_IMPLEMENTATION_STATUS.md` → `docs/deprecated/INCREMENTAL_SYNC_STATUS.md`
- `INCREMENTAL_SYNC_QUICK_REF.md` → `docs/deprecated/INCREMENTAL_SYNC_QUICK_REF.md`
- `INCREMENTAL_SYNC_SUMMARY.md` → `docs/deprecated/INCREMENTAL_SYNC_SUMMARY.md`
- `MANUAL_REFRESH_GUIDE.md` → `docs/guides/MANUAL_REFRESH.md`
- `MULTI_PORTFOLIO_PLAN.md` → `docs/features/MULTI_PORTFOLIO.md`
- `OWNER_CREDITS_FIX.md` → `docs/deprecated/OWNER_CREDITS_FIX.md`
- `REFACTORING_SUMMARY.md` → `docs/deprecated/REFACTORING_SUMMARY.md`
- `SHARED_HELPERS_REFACTORING.md` → `docs/features/SHARED_HELPERS.md`
- `STATIC_BUILD_ARCHITECTURE.md` → `docs/architecture/STATIC_BUILD.md`
- `SYNC_DEPLOY_GUIDE.md` → `docs/guides/SYNC_DEPLOY.md`
- `TEST_RESULTS.md` → `docs/testing/TEST_RESULTS.md`
- `INSTAGRAM_STUDIO_IMPLEMENTATION.md` → `docs/features/INSTAGRAM_STUDIO.md`

**Files to Keep at Root (Core Documentation):**
- `README.md` - Quick start (keep at root)
- `AI_AGENT_GUIDE.md` - Master guide (keep at root)
- `DOCUMENTATION_INDEX.md` - Index (keep at root)
- `DEPLOYMENT_GUIDE.md` - Deployment (keep at root)
- `IMAGE_OPTIMIZATION.md` - Core feature (keep at root)

**Alias Files to Keep:**
- `copilot-instructions.md` - Alias to AI_AGENT_GUIDE.md
- `COPILOT.md` - Alias to AI_AGENT_GUIDE.md

### 2. Root-Level Source Files
**Problem:** `App.tsx`, `index.tsx`, `theme.ts`, `types.ts` should be in `src/` directory

**Move to `src/`:**
- `App.tsx` → `src/App.tsx`
- `index.tsx` → `src/index.tsx`
- `index.html` → keep at root (Vite requires it)
- `theme.ts` → `src/theme.ts`
- `types.ts` → `src/types.ts`

### 3. Utils Directory Issues
**Problem:** Mix of `.ts` and `.mjs` files, some duplicate functionality

**Actions:**
- Keep `.ts` files: `imageOptimization.ts`, `markdown.ts`, `scrollRestoration.ts`, `sharedTypes.ts`, `thumbnailGenerator.ts`, `videoHelpers.ts`, `gameSounds.ts`
- Archive `.mjs` files to `legacy/` if they're not used in build
- Organize by category:
  - `utils/helpers/` - Text, file, network helpers
  - `utils/cloudinary/` - Cloudinary-specific utilities
  - `utils/generators/` - Sitemap, thumbnails, etc.

### 4. Services Organization
**Problem:** Services are not well categorized

**Actions:**
- Keep `analyticsService.ts`
- Keep `cmsService.ts` (and delete `cmsService.backup.ts`)
- Keep `instagramService.ts`
- Consider creating `services/` subdirectories if more services are added

### 5. Test Files
**Problem:** Scattered test files in root and no clear test directory structure

**Actions:**
- Move test files to `utils/__tests__/` (already started)
- Keep vitest config at root

### 6. Config Files
**Problem:** Multiple `.env` files and config at root

**Actions:**
- Keep main `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.mjs` at root
- Archive unused `.npmrc 2` file
- Keep `.env.*` files at root (Vite requirement)

### 7. Build Artifacts & Dependencies
**Problem:** These clutter the directory listing

**Actions:**
- Keep `dist/` and `node_modules/` (gitignored)
- Keep `deno.lock` (if using Deno)

### 8. Temporary Files
**Problem:** Test files and temporary build artifacts in root

**Actions:**
- Move `test-credits-format.mjs` → `scripts/tests/`
- Move `test-preset-detection.html` → `scripts/tests/`
- Delete or archive if no longer needed

### 9. Instagram Studio Subdirectory
**Status:** ✅ Well-organized, no changes needed

---

## Proposed New Structure

```
gabriel-athanasiou-portfolio--TEST/
│
├── src/                          # ← ALL SOURCE CODE
│   ├── App.tsx
│   ├── index.tsx
│   ├── theme.ts
│   ├── types.ts
│   ├── components/
│   │   ├── Cursor.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── ... (existing components)
│   │   ├── common/
│   │   └── views/
│   ├── hooks/
│   │   └── useBackgroundDataSync.ts
│   ├── services/
│   │   ├── analyticsService.ts
│   │   ├── cmsService.ts
│   │   └── instagramService.ts
│   ├── utils/
│   │   ├── helpers/             # ← NEW
│   │   │   ├── textHelpers.ts
│   │   │   ├── fileHelpers.ts
│   │   │   └── networkHelpers.ts
│   │   ├── cloudinary/          # ← NEW
│   │   │   ├── cloudinaryConfig.ts
│   │   │   ├── cloudinaryHelpers.ts
│   │   │   └── staticFilesCloudinary.ts
│   │   ├── generators/          # ← NEW
│   │   │   ├── sitemapGenerator.ts
│   │   │   ├── thumbnailGenerator.ts
│   │   │   └── slugify.ts
│   │   ├── imageOptimization.ts
│   │   ├── markdown.ts
│   │   ├── scrollRestoration.ts
│   │   ├── sharedTypes.ts
│   │   ├── videoHelpers.ts
│   │   ├── gameSounds.ts
│   │   └── __tests__/
│   ├── data/                    # ← MOVE HERE
│   └── config/                  # ← MOVE HERE
│
├── public/                       # ← PUBLIC ASSETS
├── docs/                         # ← ALL DOCUMENTATION
│   ├── README.md                 # Main readme
│   ├── DOCUMENTATION_INDEX.md
│   ├── AI_AGENT_GUIDE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── IMAGE_OPTIMIZATION.md
│   ├── config/
│   │   └── CLOUDINARY_CONFIG.md
│   ├── architecture/
│   │   └── STATIC_BUILD.md
│   ├── guides/
│   │   ├── SYNC_DEPLOY.md
│   │   └── MANUAL_REFRESH.md
│   ├── features/
│   │   ├── GAME_IMPLEMENTATION.md
│   │   ├── MULTI_PORTFOLIO.md
│   │   ├── INSTAGRAM_STUDIO.md
│   │   └── SHARED_HELPERS.md
│   ├── deprecated/
│   │   ├── INCREMENTAL_SYNC.md
│   │   ├── INCREMENTAL_SYNC_COMPLETE.md
│   │   ├── ... (other archived docs)
│   └── testing/
│       └── TEST_RESULTS.md
│
├── scripts/
│   ├── lib/
│   ├── tests/                   # ← NEW (test scripts)
│   │   ├── test-credits-format.mjs
│   │   └── test-preset-detection.html
│   ├── instagram-studio/        # ← STAYS AS IS
│   ├── generate-sitemap.mjs
│   ├── ... (other scripts)
│   └── netlify-build.sh
│
├── netlify/                      # ← FUNCTIONS & EDGE
├── .github/                      # ← CI/CD
├── .vscode/                      # ← VS CODE CONFIG
│
├── index.html                    # ← VITE ENTRY (stays here)
├── vite.config.ts               # ← MAIN CONFIG (stays here)
├── tsconfig.json
├── vitest.config.mjs
├── package.json
├── netlify.toml
├── .gitignore
├── .npmrc
└── .env.* files                 # ← ENV CONFIG (stays here)

DELETED/ARCHIVED:
├── .npmrc 2                      ✗ Duplicate
├── copilot-instructions.md       → Keep as alias or delete
├── COPILOT.md                    → Keep as alias or delete
└── cmsService.backup.ts          → Delete
```

---

## Implementation Steps

### Phase 1: Documentation Move
1. Create new `docs/` subdirectories
2. Move markdown files to appropriate locations
3. Update links in `DOCUMENTATION_INDEX.md`
4. Update cross-references in AI_AGENT_GUIDE.md

### Phase 2: Source Code Restructure
1. Create `src/` directory at root
2. Move `App.tsx`, `index.tsx`, `theme.ts`, `types.ts` to `src/`
3. Move `components/`, `hooks/`, `services/`, `utils/`, `data/`, `config/` into `src/`
4. Update all import paths in the codebase
5. Update `vite.config.ts` to point to new `src/` location

### Phase 3: Utils Reorganization
1. Create `src/utils/helpers/`, `src/utils/cloudinary/`, `src/utils/generators/`
2. Move utilities into appropriate subdirectories
3. Update import statements

### Phase 4: Cleanup
1. Delete `cmsService.backup.ts`
2. Delete `.npmrc 2`
3. Move test scripts to `scripts/tests/`

### Phase 5: Testing & Verification
1. Update all import paths
2. Run dev server to verify no broken imports
3. Build to verify production build works
4. Test all major features

---

## Notes

- **No breaking changes:** All imports will be updated automatically
- **Vite config:** Must be updated to handle new `src/` structure
- **Import paths:** All relative imports will be recalculated
- **Git history:** This will show as file moves, preserving blame history

---

**Status:** Planning phase
**Estimated Duration:** 1-2 hours
**Risk Level:** Low (all changes tracked, reversible with Git)
