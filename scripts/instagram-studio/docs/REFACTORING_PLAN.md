# Instagram Studio Refactoring Plan

## 📋 Overview

This document outlines the plan to consolidate duplicate code in Instagram Studio into a shared library, improving maintainability and debugging while ensuring nothing breaks.

**Last Updated:** December 18, 2025  
**Status:** Planning Phase  
**Branch:** `feature/instagram-studio-refactor` (to be created)

---

## 🔍 Current State Analysis

### Files Analyzed

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `netlify/functions/instagram-publish.mjs` | 686 | UI "Publish Now" button endpoint (WORKING) | ✅ Source of Truth |
| `netlify/functions/instagram-publish-now.mjs` | 579 | Manual trigger for scheduled posts | Has duplicates |
| `netlify/functions/instagram-scheduled-publish-background.mjs` | 577 | Hourly cron for auto-publishing | Has duplicates |
| `netlify/functions/lib/instagram-lib.mjs` | 434 | Shared library (partially used) | Needs consolidation |
| `src/services/instagramApi.ts` | 971 | Client-side Instagram API service | OK (calls server) |
| `src/utils/imageUtils.ts` | 942 | Image URL utilities | OK |
| `src/services/cloudinarySync.ts` | 353 | Client-side Cloudinary sync | OK |

### Identified Duplications

#### 1. **Constants Duplicated Across 5+ Files**
```javascript
// Found in: instagram-publish.mjs, instagram-publish-now.mjs, 
//           instagram-scheduled-publish-background.mjs, instagram-lib.mjs
const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';
const CLOUDINARY_CLOUD = 'date24ay6';
```

#### 2. **Instagram Publishing Logic (3 Implementations!)**

| Function | instagram-publish.mjs | instagram-lib.mjs | instagram-scheduled-*.mjs |
|----------|----------------------|-------------------|---------------------------|
| `publishSingleImage()` | ✅ Lines 98-175 | ✅ Lines 191-227 | ✅ Lines 452-488 |
| `publishCarousel()` | ✅ Lines 177-300 | ✅ Lines 229-280 | ✅ Lines 490-540 |
| `waitForProcessing()` | ✅ Lines 322-370 | `waitForMediaReady()` Lines 282-310 | ✅ Lines 542-565 |
| `publishMedia()` | ✅ Lines 394-455 | N/A (inline) | N/A (inline) |

**Key Differences:**
- `instagram-publish.mjs` checks `status_code` field
- `instagram-lib.mjs` checks `status` field (older API?)
- `instagram-scheduled-*.mjs` copy-pasted full functions inline

#### 3. **Cloudinary Functions (Duplicated in 3 Files)**

| Function | instagram-publish-now.mjs | instagram-scheduled-*.mjs | instagram-lib.mjs |
|----------|--------------------------|---------------------------|-------------------|
| `fetchScheduleData()` | ✅ Lines 314-329 | ✅ Lines 303-318 | ✅ Lines 20-36 |
| `uploadToCloudinary()` | ✅ Lines 356-398 | ✅ Lines 344-399 | ✅ Lines 38-80 |
| `saveWithSmartMerge()` | ✅ Lines 331-354 | ✅ Lines 320-342 | ✅ Lines 99-142 |
| `getInstagramUrls()` | ✅ Lines 400-422 | ✅ Lines 401-422 | ✅ Lines 144-169 |

#### 4. **Notification Email (Duplicated in 3 Files)**

| Function | instagram-publish-now.mjs | instagram-scheduled-*.mjs | instagram-lib.mjs |
|----------|--------------------------|---------------------------|-------------------|
| `sendNotification()` | ✅ Lines 23-88 | ✅ Lines 25-90 | ✅ Lines 314-390 |

---

## 🎯 Refactoring Goals

1. **Single Source of Truth** - All shared logic lives in `lib/instagram-lib.mjs`
2. **No Breaking Changes** - UI publish button must continue working exactly as before
3. **Consistent Behavior** - All publish flows use identical Instagram API calls
4. **Easier Debugging** - Fix bugs in one place, applies everywhere
5. **Extensible** - Easy to add new features (e.g., Reels support)

---

## 📐 Proposed Architecture

### New Shared Library Structure

```javascript
// lib/instagram-lib.mjs

// ============================================
// CONSTANTS (exported for reuse)
// ============================================
export const GRAPH_API_BASE = 'https://graph.instagram.com';
export const GRAPH_API_VERSION = 'v21.0';
export const CLOUDINARY_CLOUD = 'date24ay6';

// ============================================
// CLOUDINARY OPERATIONS
// ============================================
export async function fetchScheduleData() { ... }
export async function uploadToCloudinary(data) { ... }
export async function saveWithSmartMerge(statusUpdates) { ... }
export async function getInstagramUrls(imageUrls, projectId) { ... }

// ============================================
// INSTAGRAM GRAPH API
// ============================================
export async function createMediaContainer(imageUrl, caption, accessToken, accountId, isCarouselItem = false) { ... }
export async function waitForMediaReady(mediaId, accessToken, options = {}) { ... }
export async function publishMediaContainer(containerId, accessToken, accountId) { ... }

// High-level publish functions (use above primitives)
export async function publishSingleImage(imageUrl, caption, accessToken, accountId, options = {}) { ... }
export async function publishCarousel(imageUrls, caption, accessToken, accountId, options = {}) { ... }
export async function publishPost(post, accessToken, accountId, options = {}) { ... }

// ============================================
// NOTIFICATIONS
// ============================================
export async function sendNotification(results, scheduleData, options = {}) { ... }

// ============================================
// UTILITIES
// ============================================
export function validateHashtags(caption) { ... }
export function buildCaption(caption, hashtags) { ... }
```

### Files After Refactoring

| File | Changes | Estimated Reduction |
|------|---------|---------------------|
| `lib/instagram-lib.mjs` | Enhanced with all shared logic | +200 lines (consolidated) |
| `instagram-publish.mjs` | Import from lib, keep CORS handlers | -300 lines (~45%) |
| `instagram-publish-now.mjs` | Import from lib, keep handler logic | -350 lines (~60%) |
| `instagram-scheduled-publish-background.mjs` | Import from lib, keep cron config | -350 lines (~60%) |
| `instagram-publish-now-background.mjs` | Same changes | -350 lines (~60%) |

**Total Estimated Code Reduction:** ~1,350 lines of duplicated code

---

## 🔧 Implementation Plan

### Phase 1: Preparation (No Code Changes)

- [ ] **1.1** Create feature branch: `feature/instagram-studio-refactor`
- [ ] **1.2** Document current working behavior (screenshots, test cases)
- [ ] **1.3** Set up local testing environment

### Phase 2: Enhance Shared Library

- [ ] **2.1** Add missing constants to `lib/instagram-lib.mjs`
- [ ] **2.2** Consolidate `waitForProcessing()` / `waitForMediaReady()` into one function
  - Use `status_code` field (newer API, used by working `instagram-publish.mjs`)
  - Support both `FINISHED` and `READY` status values for backward compatibility
- [ ] **2.3** Add `createMediaContainer()` primitive function
- [ ] **2.4** Add `publishMediaContainer()` primitive function
- [ ] **2.5** Update `publishSingleImage()` to use primitives
- [ ] **2.6** Update `publishCarousel()` to use primitives
- [ ] **2.7** Add `validateHashtags()` utility
- [ ] **2.8** Add `buildCaption()` utility

### Phase 3: Migrate instagram-publish.mjs

- [ ] **3.1** Import constants and functions from `lib/instagram-lib.mjs`
- [ ] **3.2** Replace inline `waitForProcessing()` with lib version
- [ ] **3.3** Replace inline `publishMedia()` with lib version
- [ ] **3.4** Keep CORS handling and action routing (function-specific)
- [ ] **3.5** Test UI "Publish Now" button thoroughly
  - Single image publish
  - Carousel publish (2-10 images)
  - Error handling
  - Rate limit handling

### Phase 4: Migrate Scheduled Functions

- [ ] **4.1** Update `instagram-publish-now.mjs` to use lib
- [ ] **4.2** Update `instagram-scheduled-publish-background.mjs` to use lib
- [ ] **4.3** Update `instagram-publish-now-background.mjs` to use lib
- [ ] **4.4** Test scheduled publishing flow
  - Manual trigger via function URL
  - Dry run mode
  - Status updates to Cloudinary
  - Email notifications

### Phase 5: Cleanup & Documentation

- [ ] **5.1** Remove dead code from all files
- [ ] **5.2** Update JSDoc comments
- [ ] **5.3** Update this refactoring plan with completion notes
- [ ] **5.4** Create PR for review

---

## 🧪 Testing Checklist

### Critical Paths (Must Not Break)

| Test | Method | Expected Result |
|------|--------|-----------------|
| **Single image publish from UI** | Press "Post Now" button | Post appears on Instagram |
| **Carousel publish from UI** | Press "Post Now" with 3 images | Carousel appears on Instagram |
| **Scheduled post (manual trigger)** | Call `/instagram-publish-now` | Due posts get published |
| **Scheduled post (cron)** | Wait for hourly run | Due posts get published |
| **Status update after publish** | Publish → check schedule | Slot shows "published" status |
| **Error handling** | Use invalid token | Graceful error, no crash |
| **Notification email** | Publish with email configured | Receive summary email |

### Edge Cases

| Test | Method | Expected Result |
|------|--------|-----------------|
| **30+ hashtags** | Add 35 hashtags to caption | Trimmed to 30, warning logged |
| **Rate limit during publish** | Rapid publishes | Detection + verification fallback |
| **Cloudinary save failure** | Block Cloudinary access | Retry logic, error notification |
| **Token expired** | Use old token | Appropriate error message |

---

## ⚠️ Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Breaking UI publish** | Low | High | Test extensively before merging |
| **Breaking scheduled publish** | Medium | Medium | Test manual trigger first |
| **Import path issues** | Low | Low | Use consistent relative paths |
| **Different status field names** | Medium | High | Support both `status_code` and `status` |

---

## 📝 Notes

### Why instagram-publish.mjs is the Source of Truth

The user confirmed: "The publishing function works well within the studio when I press the button. So that should be the correct one."

This means:
1. The UI calls `src/services/instagramApi.ts` → `publishSingleImage()` / `publishCarouselStepByStep()`
2. These call `/.netlify/functions/instagram-publish` with actions like `createCarouselItem`, `createCarouselContainer`, `publishContainer`
3. `instagram-publish.mjs` handles these actions successfully

Therefore, we should align all other implementations to match `instagram-publish.mjs`'s behavior.

### Key API Differences Found

| Aspect | instagram-publish.mjs | instagram-lib.mjs |
|--------|----------------------|-------------------|
| Status field | `status_code` | `status` |
| Ready value | `FINISHED` | `READY` |
| Poll interval | 2000ms | 3000ms |
| Max wait | 25000ms | 60000ms |

**Decision:** Use `status_code` field with `FINISHED` check (matches working code), but also handle `READY` for backward compatibility.

---

## 🚀 Getting Started

```bash
# 1. Create feature branch
git checkout -b feature/instagram-studio-refactor

# 2. Start local development
cd scripts/instagram-studio
npm run dev

# 3. Test current functionality works (before any changes)
# - Open http://localhost:8888
# - Test publish flow

# 4. Begin Phase 2...
```

---

**Next Step:** Create the feature branch and start Phase 2 (Enhance Shared Library).
