# AI Agent Development Guide
## Gabriel Athanasiou Portfolio Website

> **Last Updated:** November 26, 2025  
> **Purpose:** Complete technical documentation for AI agents working on this codebase

---

## ⚠️ CRITICAL: Read This First

**FOR ALL AI AGENTS WORKING ON THIS CODEBASE:**

1. **📖 READ THIS ENTIRE DOCUMENT BEFORE MAKING ANY CHANGES**
2. **✏️ UPDATE THIS DOCUMENTATION AFTER EVERY CHANGE YOU MAKE**
3. **🔍 Verify documentation accuracy matches current code state**

**Documentation-First Workflow:**
- Before editing code → Read relevant sections here
- After editing code → Update this guide immediately
- Before committing → Verify all documentation is current

**This guide is the source of truth for the entire codebase architecture.**

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Key Systems](#key-systems)
5. [Data Flow](#data-flow)
6. [File Structure](#file-structure)
7. [Development Workflow](#development-workflow)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)
10. [Common Tasks](#common-tasks)

---

## 🎯 Project Overview

### What This Is
A production-ready portfolio website for Gabriel Athanasiou, a London/Athens-based film director. The site showcases:
- Film projects (Narrative, Commercial, Music Videos, Documentary)
- Journal/blog posts
- About/contact information
- Showreel video

### Core Philosophy
- **Headless CMS:** Airtable as the backend (no code deployments needed for content updates)
- **Performance-First:** Static generation, image optimization, CDN delivery
- **Resilient:** Multiple fallback strategies (static data, manifest files, error boundaries)
- **SEO & Analytics:** Full metadata, Google Analytics 4, social sharing
- **Theme-Driven:** Global styling controlled via `theme.ts` (no Tailwind config needed)

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  React SPA (Vite) + React Router + Client-side Analytics    │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ├─► Netlify CDN (Static Assets)
                    │   └─► Optimized WebP Images
                    │
                    ├─► Netlify Functions (get-data.js)
                    │   └─► Airtable API (Projects, Journal, Settings)
                    │
                    └─► Fallback Hierarchy:
                        1. share-meta.json (build-time manifest)
                        2. staticData.ts (emergency fallback)
```

### Request Flow

1. **Initial Load:** Browser requests `index.html` → React hydrates → `App.tsx` calls `cmsService.fetchAll()`
2. **CMS Service:** Tries manifest → Airtable API → Static fallback
3. **Routing:** `react-router-dom` handles navigation (SPA mode, no page reloads)
4. **Analytics:** `analyticsService` tracks page views and events
5. **SEO:** `<SEO>` component updates meta tags dynamically per route

---

## 🛠️ Tech Stack

### Frontend
- **React 19.2.0** - UI library
- **TypeScript 5.8.2** - Type safety
- **Vite 6.2.0** - Build tool & dev server
- **React Router 6.22.3** - Client-side routing
- **Tailwind CSS** - Utility-first styling (via `theme.ts` mappings)

### Backend/Infrastructure
- **Airtable** - Headless CMS (database)
- **Netlify** - Hosting, CDN, Functions, Edge Functions
- **Sharp** - Image optimization (build-time)
- **Google Analytics 4** - User analytics

### Key Dependencies
```json
{
  "airtable": "^0.12.2",
  "sharp": "^0.34.5",
  "@netlify/functions": "^2.8.1",
  "dotenv": "^17.2.3"
}
```

---

## 🔑 Key Systems

### 1. CMS Service (`services/cmsService.ts`)

**Purpose:** Fetch and normalize data from Airtable with fallback strategies.

**Methods:**
- `fetchAll()` → Returns `{ projects: Project[], posts: BlogPost[], config: HomeConfig }`
- `getProjects()` → Returns just projects
- `getBlogPosts()` → Returns just posts
- `getHomeConfig()` → Returns just config

**Data Sources (in order of priority):**
1. **share-meta.json** - Lightweight manifest generated at build time (fastest, no API calls)
2. **Airtable API** - Live data if manifest unavailable
3. **staticData.ts** - Hardcoded fallback if API fails

**Key Features:**
- Resolves YouTube/Vimeo URLs (handles vanity URLs, hashes, embeds)
- Auto-generates thumbnails from video URLs
- Normalizes project types (Narrative/Commercial/Music Video/Documentary)
- Parses credits from text format (`Role: Name`)
- Filters projects by allowed roles (from Settings table)
- Attaches unique slugs for SEO-friendly URLs

**Important Notes:**
- Caches result in memory (`cachedData`) to avoid redundant calls
- Instagram integration is DISABLED by default (toggle via `ENABLE_INSTAGRAM_INTEGRATION`)
- Uses OEmbed for private/unlisted Vimeo videos

---

### 2. Analytics Service (`services/analyticsService.ts`)

**Purpose:** Google Analytics 4 integration with privacy-friendly defaults.

**Setup:** Initialized once in `App.tsx`:
```typescript
analyticsService.init('G-EJ62G0X6Q5');
```

**Key Methods:**
- `trackPageView(path, title)` - Called on route change
- `trackVideoPlay(projectId, projectTitle)` - Video engagement
- `trackSocialShare(platform, title, url)` - Share button clicks
- `trackExternalLink(label, url)` - External link clicks
- `trackProjectView(projectId, projectTitle, projectType)` - Project detail views
- `trackBlogPostView(postId, postTitle)` - Blog post views

**Privacy Features:**
- `anonymize_ip: true`
- `allow_google_signals: false`
- `allow_ad_personalization_signals: false`

**Usage Example:**
```typescript
// In VideoEmbed.tsx
analyticsService.trackVideoPlay(project.id, project.title);
```

---

### 3. Image Optimization System

**Components:**

#### A. Build-Time Optimization (`scripts/optimize-images.mjs`)
- Runs during `npm run build` (via `npm run optimize:images`)
- Fetches featured projects + public journal images from Airtable
- Downloads and converts to WebP format (1600px wide, 92% quality)
- Saves to `/public/images/portfolio/` with naming:
  - Single image: `project-{recordId}.webp` or `journal-{recordId}.webp`
  - Multiple images: `project-{recordId}-0.webp`, `project-{recordId}-1.webp`, etc.
- **Incremental:** Only processes NEW images (skips existing)
- **Automatic Cleanup:** Deletes orphaned images removed from Airtable
  - Compares existing files with current Airtable content
  - Removes WebP files for deleted projects/posts
  - Prevents storage waste from old content

#### B. Runtime Helper (`utils/imageOptimization.ts`)
```typescript
getOptimizedImageUrl(recordId, fallbackUrl, type, index, totalImages)
```
- Returns optimized local path if available
- Falls back to Airtable CDN URL
- Used in all view components for image rendering

#### C. Manual Verification (`scripts/test-image-fetch.mjs`)
```bash
npm run test:images
```
- Tests Airtable connection and image URL retrieval
- Does NOT optimize, just verifies data

---

### 4. SEO System (`components/SEO.tsx`)

**Purpose:** Dynamic meta tags for social sharing and search engines.

**Features:**
- Updates `<title>`, Open Graph tags, Twitter Card tags
- Canonical URLs
- Schema.org structured data (Person/NewsArticle)
- Per-route customization

**Usage:**
```tsx
<SEO 
  title="Project Title" 
  description="Project description..."
  image="https://cdn.url/image.jpg"
  type="article"
/>
```

**Meta Generation Files:**
- `scripts/generate-share-meta.mjs` - Generates `/public/share-meta.json` at build time
- `netlify/edge-functions/meta-rewrite.ts` - Injects meta tags for dynamic routes (SSR-like)

---

### 5. Theme System (`theme.ts`)

**Purpose:** Centralized design system. All visual styling controlled here.

**Key Sections:**
- **Colors:** Background, text, accent, selection
- **Typography:** Font scales for h1-h3, body, meta, nav
- **Layout:** Header height, padding, hero dimensions
- **Filmography:** Grid/list view settings, tabs, columns
- **Project Detail:** Sidebar, credits, next project preview
- **Animations:** Durations, easing functions, stagger delays
- **UI Elements:** Buttons, cursors, close button positioning

**Example:**
```typescript
export const THEME = {
  hero: {
    height: "h-screen",
    overlayOpacity: 0.1,
    textAlignment: "text-left"
  }
}
```

**Usage in Components:**
```tsx
import { THEME } from '../theme';
<div className={THEME.hero.height} />
```

---

## 📊 Data Flow

### Projects Data Model (`types.ts`)

```typescript
interface Project {
  id: string;              // Airtable record ID
  title: string;           // Normalized title
  slug?: string;           // URL-friendly slug (auto-generated)
  type: ProjectType;       // Narrative | Commercial | Music Video | Documentary
  genre?: string[];        // ["Sci-Fi", "Drama"]
  client: string;          // Production company (resolved from Client Book table)
  brand?: string;          // Brand name (if commercial)
  year: string;            // Release year (YYYY)
  description: string;     // Project description
  isFeatured: boolean;     // Show on home page?
  
  // Media
  heroImage: string;       // Main thumbnail (gallery[0] or video thumbnail)
  videoUrl?: string;       // Main video (YouTube/Vimeo)
  additionalVideos?: string[]; // Extra videos from External Links
  gallery: string[];       // Image URLs from Gallery field
  
  // Metadata
  awards?: string[];       // Resolved from Festivals field
  externalLinks?: ExternalLink[]; // IMDb, LinkedIn, etc.
  relatedArticleId?: string; // Link to Journal entry
  
  // Credits
  credits: Credit[];       // [{ role: "Director", name: "Gabriel" }]
}
```

### Airtable Schema

#### Projects Table (Required)
| Field | Type | Purpose |
|-------|------|---------|
| `Name` | Single Line Text | Project title |
| `Feature` | Checkbox | Visible on site? |
| `Front Page` | Checkbox | Show on home page? |
| `Project Type` | Single Select | Narrative/Commercial/Music Video/Documentary |
| `Genre` | Multiple Select | ["Sci-Fi", "Drama"] |
| `Client` | Link to Client Book | Production company |
| `Brand` | Single Line Text | Brand name |
| `Release Date` | Date | YYYY-MM-DD |
| `About` | Long Text | Description |
| `Gallery` | Attachments | Images |
| `Video URL` | Long Text | YouTube/Vimeo URLs (comma-separated) |
| `Role` | Multiple Select | Gabriel's role(s) |
| `Credits Text` | Long Text | `Role: Name, Role: Name` |
| `Festivals` | Link to Awards | Award names |
| `External Links` | Long Text | URLs (comma-separated) |
| `Related Article` | Link to Journal | Related blog post |

#### Journal Table (Optional)
| Field | Type | Purpose |
|-------|------|---------|
| `Title` | Single Line Text | Post title |
| `Date` | Date | Publish date |
| `Status` | Single Select | Public / Scheduled / Draft |
| `Content` | Long Text | Markdown content |
| `Cover Image` | Attachments | Featured image |
| `Tags` | Multiple Select | Categories |
| `Related Project` | Link to Projects | Related project |
| `Links` | Long Text | External URLs |

#### Settings Table (Required)
| Field | Type | Purpose |
|-------|------|---------|
| `Showreel Enabled` | Checkbox | Show showreel on home? |
| `Showreel URL` | Single Line Text | Vimeo/YouTube URL |
| `Showreel Placeholder` | Attachments | Thumbnail |
| `Contact Email` | Email | Contact email |
| `Rep UK` | Single Line Text | UK representative |
| `Rep USA` | Single Line Text | USA representative |
| `Instagram URL` | URL | Instagram link |
| `Vimeo URL` | URL | Vimeo link |
| `LinkedIn URL` | URL | LinkedIn link |
| `Bio` | Long Text | About page bio |
| `About Image` | Attachments | Profile photo |
| `Allowed Roles` | Multiple Select | Filter projects by role |
| `Default OG Image` | Attachments | Fallback share image |

#### Client Book Table (Optional, but recommended)
| Field | Type | Purpose |
|-------|------|---------|
| `Company Name` | Single Line Text | Production company name |

---

## 📁 File Structure

```
gabriel-athanasiou-portfolio--TEST/
│
├── App.tsx                    # Main app component, routing, data fetching
├── index.tsx                  # Entry point, React root
├── theme.ts                   # Global design system (CRITICAL)
├── types.ts                   # TypeScript interfaces
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript config
├── package.json               # Dependencies & scripts
├── netlify.toml               # Netlify deployment config
│
├── components/
│   ├── Navigation.tsx         # Header navigation
│   ├── SEO.tsx                # Dynamic meta tags
│   ├── Cursor.tsx             # Custom cursor (desktop)
│   ├── ErrorBoundary.tsx      # React error boundary
│   ├── GlobalStyles.tsx       # Global CSS injection
│   ├── SocialShare.tsx        # Share buttons
│   ├── VideoEmbed.tsx         # YouTube/Vimeo player
│   ├── common/
│   │   └── CloseButton.tsx    # Reusable close button
│   └── views/
│       ├── HomeView.tsx       # Featured projects + showreel
│       ├── IndexView.tsx      # Filmography (grid/list)
│       ├── ProjectDetailView.tsx  # Project detail page
│       ├── BlogView.tsx       # Journal list
│       ├── BlogPostView.tsx   # Journal post detail
│       └── AboutView.tsx      # About page
│
├── services/
│   ├── cmsService.ts          # Airtable data fetching (CRITICAL)
│   ├── analyticsService.ts    # Google Analytics 4
│   └── instagramService.ts    # Instagram integration (disabled)
│
├── utils/
│   ├── imageOptimization.ts   # Image URL helpers
│   ├── markdown.ts            # Markdown parser
│   ├── slugify.ts             # Slug generation
│   └── sitemapGenerator.ts    # Sitemap generation
│
├── data/
│   └── staticData.ts          # Emergency fallback data
│
├── scripts/
│   ├── optimize-images.mjs    # Image optimization (build-time)
│   ├── test-image-fetch.mjs   # Test Airtable images
│   ├── generate-share-meta.mjs # Generate manifest
│   └── ignore-netlify-build.sh # Selective deployment
│
├── netlify/
│   ├── functions/
│   │   ├── get-data.js        # Airtable API proxy (with caching)
│   │   └── sitemap.js         # Dynamic sitemap
│   └── edge-functions/
│       └── meta-rewrite.ts    # Dynamic meta tag injection
│
├── public/
│   ├── _redirects            # Netlify redirects
│   ├── robots.txt            # SEO crawler rules
│   ├── share-meta.json       # Build-time manifest (generated)
│   └── images/
│       └── portfolio/         # Optimized images (WebP)
│
└── docs/                      # Additional documentation
    ├── ANALYTICS_SETUP.md
    ├── ANALYTICS_TESTING.md
    └── ENV_SETUP.md
```

---

## 💻 Development Workflow

### Environment Setup

1. **Install Dependencies:**
```bash
npm install
```

2. **Create `.env.local`:**
```bash
VITE_AIRTABLE_TOKEN=keyXXXXXXXXXXXXXX
VITE_AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
GEMINI_API_KEY=xxxxx  # Optional, for AI features
```

3. **Start Dev Server:**
```bash
npm run dev
# Opens at http://localhost:3000
```

### Development Commands

```bash
# Development
npm run dev                # Start Vite dev server (hot reload)
npm run preview            # Preview production build locally

# Building
npm run build              # Full production build (with image optimization)
npm run optimize:images    # Run image optimization only
npm run build:content      # Generate share-meta.json only

# Testing
npm run test:images        # Verify Airtable image URLs
```

### Git Workflow

**Current Branch:** `feature/significant-updates`  
**Main Branch:** `main`

```bash
# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "feat: description of changes"

# Push to feature branch
git push origin feature/significant-updates

# Merge to main (when ready)
git checkout main
git merge feature/significant-updates
git push origin main
```

---

## 🚀 Deployment

### Netlify Configuration (`netlify.toml`)

```toml
[build]
command = "npm run build"
publish = "dist"
functions = "netlify/functions"
ignore = "bash scripts/ignore-netlify-build.sh"  # Only build on [deploy] commits
```

### Deployment Triggers

**Automatic:**
- Push to `main` branch with `[deploy]` or `[force-deploy]` in commit message

**Manual:**
- Netlify Dashboard → "Trigger deploy"

**Selective Deployment Logic:**
- `scripts/ignore-netlify-build.sh` compares `share-meta.hash` (featured projects + public posts)
- Only rebuilds if content changes (saves build minutes)

### Build Process

1. `npm run optimize:images` → Downloads & optimizes images to `/public/images/portfolio/`
2. `npm run build:content` → Generates `/public/share-meta.json` manifest
3. `vite build` → Bundles React app to `/dist/`
4. Netlify deploys `/dist/` to CDN
5. Netlify Functions deployed to serverless endpoints

### Environment Variables (Netlify)

Go to **Site Settings → Environment Variables**:
```
AIRTABLE_API_KEY = keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX
VITE_AIRTABLE_TOKEN = keyXXXXXXXXXXXXXX  # Same as AIRTABLE_API_KEY
VITE_AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX  # Same as AIRTABLE_BASE_ID
```

**Note:** Both `AIRTABLE_*` and `VITE_AIRTABLE_*` are needed (functions vs. client-side).

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Loading Static Fallback Data" in Console
**Cause:** Airtable API connection failed or credentials missing.

**Fix:**
- Check `.env.local` has correct `VITE_AIRTABLE_TOKEN` and `VITE_AIRTABLE_BASE_ID`
- Verify Airtable API key is valid (go to Airtable → Account → API)
- Check network connection
- Verify Airtable base ID matches your base

#### 2. Images Not Loading
**Possible Causes:**
- Image optimization not run (`npm run optimize:images`)
- Image path mismatch (check naming convention)
- Airtable Gallery field empty

**Fix:**
```bash
# Re-run optimization
npm run optimize:images

# Verify images exist
ls -la public/images/portfolio/

# Test Airtable connection
npm run test:images
```

#### 3. Video Not Embedding
**Cause:** Unsupported video URL format.

**Supported:**
- YouTube: `youtube.com/watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`
- Vimeo: `vimeo.com/123456`, `vimeo.com/123456/hash`, `player.vimeo.com/video/123456`

**Fix:**
- Use standard video URLs
- Check `cmsService.ts` → `getVideoId()` function for regex patterns
- For unlisted/private Vimeo, ensure hash is in URL: `vimeo.com/123456/abcdef123`

#### 4. Build Failing on Netlify
**Check:**
- Build logs in Netlify dashboard
- Environment variables are set
- Node version matches (Netlify uses Node 18 by default)

**Common Fixes:**
```bash
# Clear cache and retry
# (In Netlify: Site Settings → Build & Deploy → Clear cache)

# Check for missing dependencies
npm ci  # Clean install

# Verify build works locally
npm run build
```

#### 5. Slugs Colliding (Two Projects Have Same URL)
**Cause:** Duplicate titles and years.

**Fix:**
- `utils/slugify.ts` → `makeUniqueSlug()` auto-handles collisions with record ID suffix
- Ensure projects have unique titles or years

#### 6. Analytics Not Tracking
**Check:**
- `analyticsService.init()` is called in `App.tsx` (it is by default)
- Measurement ID is correct: `G-EJ62G0X6Q5`
- Check browser console for GA errors
- Verify in Google Analytics dashboard (Real-time reports)

---

## ✅ Common Tasks

### Add a New Project (Airtable)

1. Go to Airtable → Projects table
2. Add new record:
   - **Name:** Project title
   - **Feature:** ✓ (to make visible)
   - **Front Page:** ✓ (to show on home)
   - **Project Type:** Select type
   - **Client:** Link to Client Book
   - **Release Date:** YYYY-MM-DD
   - **About:** Description
   - **Gallery:** Upload images
   - **Video URL:** YouTube/Vimeo URL
   - **Role:** Select role(s)
3. Save → Wait 5-15 minutes for CDN cache to clear (or force deploy)

### Add a New Journal Post

1. Airtable → Journal table
2. Add record:
   - **Title:** Post title
   - **Date:** YYYY-MM-DD
   - **Status:** "Public" (or "Scheduled" for future)
   - **Content:** Markdown text
   - **Cover Image:** Upload image
   - **Tags:** Add tags
3. Save → Auto-published

### Change Theme Settings

1. Open `theme.ts`
2. Modify values (e.g., change hero height, colors, fonts)
3. Save → Changes apply instantly in dev mode
4. Example:
```typescript
// Before
hero: { height: "h-screen" }

// After
hero: { height: "h-[80vh]" }
```

### Add New Analytics Event

1. Open component where event occurs (e.g., `VideoEmbed.tsx`)
2. Import analytics service:
```typescript
import { analyticsService } from '../services/analyticsService';
```
3. Track event:
```typescript
const handleClick = () => {
  analyticsService.trackEvent('custom_event', { 
    category: 'engagement',
    label: 'button_click'
  });
};
```

### Add New View/Route

1. Create component in `components/views/`:
```typescript
// components/views/NewView.tsx
import React from 'react';

export const NewView: React.FC = () => {
  return <div>New View Content</div>;
};
```

2. Add route in `App.tsx`:
```typescript
import { NewView } from './components/views/NewView';

// Inside <Routes>
<Route path="/new-route" element={
  <>
    <SEO title="New Page" />
    <NewView />
  </>
} />
```

3. Add navigation link in `Navigation.tsx`:
```typescript
<NavLink to="/new-route" className={({ isActive }) => getBtnClass(isActive)}>
  New Route
</NavLink>
```

### Update Airtable Schema

**Adding a New Field:**
1. Airtable → Projects table → Add field
2. Update `types.ts` interface:
```typescript
interface Project {
  // ... existing fields
  newField?: string;  // Add new field
}
```
3. Update `cmsService.ts` → `processProjects()`:
```typescript
return {
  // ... existing fields
  newField: record.get('New Field') || ''
};
```

### Force Cache Clear

**Client-Side:**
```typescript
// In cmsService.ts
cachedData = null;  // Clear cached data
```

**Netlify Functions:**
- Wait 15 minutes for TTL expiry
- Or redeploy site (clears all caches)

---

## 🔐 Security Notes

### API Keys
- **Airtable API Key:** Has full read/write access to base. Keep secret!
- **Never commit `.env.local`** (already in `.gitignore`)
- Netlify environment variables are encrypted at rest

### Content Security
- Airtable authentication via Bearer token (HTTPS only)
- No client-side secrets (all API calls via Netlify Functions)
- CORS handled by Netlify (no cross-origin issues)

---

## 📊 Performance Optimizations

### Current Optimizations

1. **Image Optimization:**
   - WebP format (50-80% smaller than JPEG)
   - Max width 1600px (retina displays)
   - Incremental builds (only process new images)

2. **Caching Strategy:**
   - `share-meta.json` manifest (instant load, no API call)
   - Netlify Functions cache: 15 minutes (900s TTL)
   - CDN edge cache: 24 hours (stale-while-revalidate)

3. **Bundle Optimization:**
   - Vite code splitting (lazy load routes)
   - Tree shaking (unused code removed)
   - Minification (production builds)

4. **Lazy Loading:**
   - Images use native lazy loading (`loading="lazy"`)
   - Routes lazy loaded via React Router

### Performance Metrics (Target)

- **Lighthouse Score:** 90+ (Performance)
- **First Contentful Paint (FCP):** < 1.5s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Cumulative Layout Shift (CLS):** < 0.1
- **Time to Interactive (TTI):** < 3.5s

---

## 🧪 Testing

### Manual Testing Checklist

**Navigation:**
- [ ] Home → Filmography → Project Detail
- [ ] Journal → Post Detail
- [ ] About page
- [ ] Browser back/forward buttons work

**Content:**
- [ ] Projects load with images
- [ ] Videos embed and play
- [ ] Journal posts render markdown
- [ ] Credits expand/collapse
- [ ] Social share buttons work

**Responsive:**
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1440px)
- [ ] Navigation adapts to mobile

**SEO:**
- [ ] Page titles update per route
- [ ] Open Graph tags correct (check via Facebook Debugger)
- [ ] Twitter Cards correct
- [ ] Canonical URLs set

**Analytics:**
- [ ] Page views tracked (check GA4 Real-time)
- [ ] Video play events tracked
- [ ] Social share events tracked

**Image Optimization:**
- [ ] New images optimized during build
- [ ] Orphaned images cleaned up automatically
- [ ] WebP files served correctly

---

## 📚 Additional Resources

### Documentation Files
- `ANALYTICS_SETUP.md` - Analytics configuration guide
- `ANALYTICS_TESTING.md` - How to test analytics
- `ENV_SETUP.md` - Environment variable setup
- `DEPLOYMENT_GUIDE.md` - Step-by-step deployment
- `IMAGE_OPTIMIZATION.md` - Image optimization details

### External Documentation
- [Airtable API](https://airtable.com/developers/web/api/introduction)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Router](https://reactrouter.com/en/main)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Google Analytics 4](https://developers.google.com/analytics/devguides/collection/ga4)

---

## 🆘 Emergency Contacts

### Key People
- **Developer:** (Current maintainer)
- **Content Manager:** Gabriel Athanasiou
- **Hosting:** Netlify (automated)

### Support Resources
- **Airtable Support:** https://support.airtable.com
- **Netlify Support:** https://answers.netlify.com
- **GitHub Issues:** (If this becomes a repo with issues enabled)

---

## 🎯 Future Improvements

### Planned Features
- [ ] Admin dashboard for content preview
- [ ] Multi-language support (i18n)
- [ ] Advanced search/filtering
- [ ] Blog RSS feed
- [ ] Newsletter integration
- [ ] Video hosting migration to Mux/Cloudflare Stream

### Known Limitations
- Instagram integration disabled (requires access token renewal)
- No content versioning (Airtable native only)
- No user authentication (static site)
- Limited Airtable API rate (5 requests/second)

---

## 📝 Code Style Guide

### TypeScript
- Use `interface` for data models, `type` for unions
- Always define return types for functions
- Prefer `async/await` over `.then()`

### React
- Functional components only (no class components)
- Props destructuring in function signature
- Use `React.FC<Props>` type annotation

### Naming Conventions
- **Components:** PascalCase (`ProjectDetailView.tsx`)
- **Utilities:** camelCase (`imageOptimization.ts`)
- **Constants:** UPPER_SNAKE_CASE (`AIRTABLE_TOKEN`)
- **CSS Classes:** Tailwind utility classes (via `theme.ts`)

### File Organization
- One component per file
- Co-locate types with usage (or in `types.ts` if shared)
- Group imports: React → Libraries → Local

### Documentation Requirements
**MANDATORY for all code changes:**
1. Update this guide (AI_AGENT_GUIDE.md) immediately after code changes
2. Update relevant section documentation files (IMAGE_OPTIMIZATION.md, etc.)
3. Update README.md if user-facing changes
4. Keep comments in code accurate and up-to-date
5. Document breaking changes prominently

---

## ⚡ Quick Reference

### Start Development
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

### Deploy to Netlify
```bash
git add .
git commit -m "feat: description [deploy]"
git push origin main
```

### Emergency Rollback
1. Netlify Dashboard → Deploys
2. Find previous working deploy
3. Click "Publish deploy" on old version

---

**END OF GUIDE**

> This document is a living reference. Update it as the codebase evolves.  
> Last reviewed: November 26, 2025
