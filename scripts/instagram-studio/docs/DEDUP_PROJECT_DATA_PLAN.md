# Implementation Plan: Remove Duplicate Project Data from Drafts

**Date:** December 20, 2025  
**Status:** ✅ Complete (All Phases 1-5)  
**Risk Level:** 🟢 Low (implemented & tested)

---

## 📋 Summary

**Problem:** Each `PostDraft` stores a complete copy of the `Project` object (~50-100 fields). This leads to:
- Duplicate data (same project stored multiple times across drafts)
- Stale data (project updates in Airtable don't reflect in existing drafts)
- Bloated `schedule-data.json` (~6,685 lines when it should be ~500)

**Solution:** Store only `projectId` in drafts, fetch live project data from `portfolio-data-postproduction.json` at runtime.

---

## ✅ Safety Analysis

### What WON'T Break

| Component | Current Usage | Status |
|-----------|---------------|--------|
| **Scheduled Publishing** | Only uses `draft.projectId`, `draft.selectedImages`, `draft.caption`, `draft.hashtags`, `draft.imageMode` | ✅ **Safe** |
| **Background Publishing** | Same as above | ✅ **Safe** |
| **Draft Storage** | Already stores `projectId` | ✅ **Safe** |
| **Image URLs** | Uses `selectedImages[]` (stored in draft, not from project) | ✅ **Safe** |
| **Caption/Hashtags** | Stored directly in draft | ✅ **Safe** |

### Netlify Function Optimization

The scheduled publish functions run **hourly** but most runs find nothing to publish. We optimize by only fetching project data when needed:

```
┌─────────────────────────────────────────────────────────────────┐
│  Hourly Trigger                                                 │
│       │                                                         │
│       ▼                                                         │
│  Fetch schedule-data.json (small, just drafts + slots)         │
│       │                                                         │
│       ▼                                                         │
│  Check: Any posts due?                                          │
│       │                                                         │
│   NO ─┴─► EXIT (no portfolio fetch - most common case)         │
│       │                                                         │
│  YES ─┴─► Fetch portfolio-data-postproduction.json ONCE        │
│              │                                                  │
│              ▼                                                  │
│         Build project lookup map                                │
│              │                                                  │
│              ▼                                                  │
│         Publish all due posts (reuse lookup)                   │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- 23/24 hourly runs = zero portfolio fetches (nothing to publish)
- When publishing: 1 fetch per batch, not 1 per post
- Project data is always fresh at publish time

### What Needs Updates

| Component | Current Usage | Required Change |
|-----------|---------------|-----------------|
| **ScheduleItem.tsx** | `const { project } = post` | Look up project by ID |
| **PostPreview.tsx** | `project.title`, `project.gallery` | Look up project by ID |
| **App.tsx** | `currentDraft.project` | Keep `selectedProject` state separate |
| **useSchedule.ts** | `saveDraft()` embeds project | Remove project embedding |
| **cloudinarySync.ts** | CSV export uses `draft.project.title` | Look up project for CSV |
| **PostDraft type** | Has `project: Project` field | Remove field |

---

## 🏗️ Implementation Steps

### Phase 1: Create Project Lookup System

**1.1 Create `useProjectLookup` hook**

```typescript
// src/hooks/useProjectLookup.ts
import { useMemo } from 'react';
import type { Project } from '../types';

export function useProjectLookup(projects: Project[]) {
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const getProject = (projectId: string): Project | undefined => {
    return projectMap.get(projectId);
  };

  return { projectMap, getProject };
}
```

**1.2 Create context for app-wide project access**

```typescript
// src/context/ProjectContext.tsx
const ProjectContext = createContext<{
  projects: Project[];
  getProject: (id: string) => Project | undefined;
}>({ projects: [], getProject: () => undefined });
```

### Phase 2: Update Type Definitions

**2.1 Update `PostDraft` type (keep `project` optional for migration)**

```typescript
// src/types/post.ts
export interface PostDraft {
  id: string;
  projectId: string;
  project?: Project; // DEPRECATED: Will be removed after migration
  caption: string;
  hashtags: string[];
  selectedImages: string[];
  imageMode?: ImageDisplayMode;
  createdAt: string;
  updatedAt: string;
}
```

### Phase 3: Update Components

**3.1 ScheduleItem.tsx**
- Receive `getProject` function as prop or use context
- Look up project: `const project = getProject(post.projectId)`
- Add null check: `if (!project) return <Placeholder />`

**3.2 PostPreview.tsx**
- Same pattern as ScheduleItem

**3.3 App.tsx**
- Already manages `selectedProject` state separately ✅
- Update `currentDraft` to not include embedded project

**3.4 useSchedule.ts → saveDraft()**
- Remove `project` parameter embedding
- Only store `projectId`

**3.5 cloudinarySync.ts → CSV export**
- Pass projects array to export function
- Look up project by ID for CSV fields

### Phase 4: Data Migration

**4.1 Migration script (runs once on load)**

```typescript
// In cloudinarySync.ts or useSchedule.ts
function migrateOldDrafts(drafts: PostDraft[]): PostDraft[] {
  return drafts.map(draft => {
    // If draft has embedded project, strip it
    if ('project' in draft && draft.project) {
      const { project, ...cleanDraft } = draft;
      return cleanDraft;
    }
    return draft;
  });
}
```

**4.2 Apply on sync**
- When loading from Cloudinary, strip `project` field
- Save back clean data

### Phase 5: Handle Edge Cases

**5.1 Deleted Projects**
If a project is deleted from Airtable but a draft still references it:
- Show placeholder: "Project no longer available"
- Allow deleting the draft
- Don't break the schedule view

**5.2 Offline/Loading State**
When projects are loading:
- Show skeleton/loading state for project info
- Don't lose draft data

### Phase 6: Update Netlify Publish Functions

**6.1 Add lazy portfolio data fetching**

```javascript
// netlify/functions/instagram-scheduled-publish.mjs

const PORTFOLIO_DATA_URL = 'https://res.cloudinary.com/date24ay6/raw/upload/portfolio-static/portfolio-data-postproduction.json';

// Only called when we have posts to publish
async function fetchProjectsIfNeeded() {
  const response = await fetch(PORTFOLIO_DATA_URL);
  if (!response.ok) {
    console.warn('Could not fetch portfolio data, continuing without project details');
    return new Map();
  }
  const data = await response.json();
  const projectMap = new Map();
  data.projects.forEach(p => projectMap.set(p.id, p));
  return projectMap;
}

// In main handler:
export default async function handler(event) {
  // 1. Fetch schedule data (small file)
  const scheduleData = await fetchScheduleFromCloudinary();
  
  // 2. Find due posts
  const duePosts = findDuePosts(scheduleData);
  
  // 3. Early exit if nothing to publish (NO portfolio fetch)
  if (duePosts.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
  }
  
  // 4. Only NOW fetch portfolio data (posts need publishing)
  const projectMap = await fetchProjectsIfNeeded();
  
  // 5. Publish posts, using projectMap for any needed lookups
  for (const { slot, draft } of duePosts) {
    const project = projectMap.get(draft.projectId);
    // project can be used for logging, future enhancements, etc.
    console.log(`Publishing: ${project?.title || draft.projectId}`);
    // ... rest of publish logic
  }
}
```

**6.2 Files to update:**
- `netlify/functions/instagram-scheduled-publish.mjs`
- `netlify/functions/instagram-publish-now-background.mjs`

---

## 📁 Files to Modify

### Frontend (UI)
| File | Changes |
|------|---------|
| `src/types/post.ts` | Make `project` optional/deprecated |
| `src/hooks/useProjectLookup.ts` | **NEW** - Create lookup hook |
| `src/context/ProjectContext.tsx` | **NEW** - Create context (optional) |
| `src/hooks/useSchedule.ts` | Remove project from `saveDraft()` |
| `src/components/Schedule/ScheduleItem.tsx` | Use lookup for project |
| `src/components/PostPreview/PostPreview.tsx` | Use lookup for project |
| `src/App.tsx` | Wire up project lookup |
| `src/services/cloudinarySync.ts` | Strip project on load, fix CSV export |

### Backend (Netlify Functions)
| File | Changes |
|------|---------|
| `netlify/functions/instagram-scheduled-publish.mjs` | Add lazy portfolio fetch |
| `netlify/functions/instagram-publish-now-background.mjs` | Add lazy portfolio fetch |

---

## 🧪 Testing Checklist

### Before Implementation
- [x] Backup current `schedule-data.json` from Cloudinary
- [x] Export current schedule as CSV
- [x] Note current draft count and scheduled posts

### After Phase 2 (Types)
- [x] Build succeeds with no type errors
- [x] Existing drafts still load

### After Phase 3 (Components)
- [x] Schedule view shows all posts
- [x] Post preview works
- [x] Edit draft works
- [x] Create new draft works
- [x] CSV export includes project titles

### After Phase 4 (Migration)
- [x] Old drafts with embedded projects still work
- [x] New drafts don't have embedded project
- [x] Sync to Cloudinary works
- [x] `schedule-data.json` is significantly smaller (145 KB, was ~6.6 MB)

### Scheduled Publishing
- [x] Scheduled publish function works (uses projectId, not project)
- [x] Images publish correctly
- [x] Caption and hashtags correct

### Edge Cases
- [x] Deleted project shows graceful placeholder (stub projects with type='unknown')
- [x] Loading state during project fetch
- [x] No data loss during migration

---

## 📊 Expected Results

| Metric | Before | After (Actual) |
|--------|--------|----------------|
| `schedule-data.json` size | ~6,685 lines (~6.6 MB) | 145 KB ✅ |
| Draft object size | ~2KB per draft | ~200 bytes per draft ✅ |
| Project data sync | Never updates | Always fresh ✅ |
| Data duplication | High | None ✅ |

---

## 🔄 Rollback Plan

If issues occur:
1. Revert code changes
2. The migration is non-destructive (projects can be re-embedded)
3. Old `instagram-studio-data-backup.json` can be restored

---

## ⏱️ Timeline Estimate

| Phase | Time |
|-------|------|
| Phase 1: Lookup system | 30 min |
| Phase 2: Type updates | 15 min |
| Phase 3: Component updates | 1 hour |
| Phase 4: Migration | 30 min |
| Phase 5: Edge cases | 30 min |
| Testing | 30 min |
| **Total** | **~3 hours** |

---

## 🚀 Ready to Proceed?

This refactor is **safe** because:
1. ✅ Scheduled publishing doesn't use embedded project data
2. ✅ All critical data (`selectedImages`, `caption`, `hashtags`) stays in draft
3. ✅ Migration is backwards-compatible
4. ✅ Can rollback without data loss

**Recommended:** Proceed with implementation.
