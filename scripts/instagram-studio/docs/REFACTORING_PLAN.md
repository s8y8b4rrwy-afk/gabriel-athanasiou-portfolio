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
| `instagram-publish-now.mjs` | **DELETE** - redundant file | -579 lines (100%) |
| `instagram-publish-now-background.mjs` | Import from lib, rename to `instagram-publish-now.mjs` | -350 lines (~65%) |
| `instagram-scheduled-publish-background.mjs` | Import from lib, keep cron config | -350 lines (~60%) |

**Total Estimated Code Reduction:** ~1,580 lines (including deleted redundant file)

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

- [ ] **4.1** **DELETE** `instagram-publish-now.mjs` (redundant - use background version)
- [ ] **4.2** Rename `instagram-publish-now-background.mjs` → `instagram-publish-now.mjs` with background config
- [ ] **4.3** Update renamed file to use lib imports
- [ ] **4.4** Update `instagram-scheduled-publish-background.mjs` to use lib
- [ ] **4.5** Test scheduled publishing flow
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

## 🗑️ Redundant Files to Remove

### `instagram-publish-now.mjs` vs `instagram-publish-now-background.mjs`

**Analysis:** These two files are **99% identical** (~540-579 lines each), differing only in timeout constants:

| File | Timeout | Poll Interval | Netlify Mode |
|------|---------|---------------|--------------|
| `instagram-publish-now.mjs` | 30s (hits 10s limit) | 2s | Standard (10s timeout) |
| `instagram-publish-now-background.mjs` | 120s (2 min) | 3s | Background (15 min timeout) |

**Recommendation:** **Keep only `instagram-publish-now-background.mjs`** and delete `instagram-publish-now.mjs`.

**Rationale:**
1. The standard function has a 10s timeout - too short for carousel processing
2. The background version with 15-minute timeout is more reliable
3. Maintaining two nearly identical files is error-prone
4. Background functions can be called the same way - just use `-background` endpoint

**Migration:**
- Update any code/docs referencing `/instagram-publish-now` to use `/instagram-publish-now-background`
- Or keep the endpoint name by renaming the background file to `instagram-publish-now.mjs` with `config.type = "background"`

### Summary of Files After Full Refactoring

| File | Status | Action |
|------|--------|--------|
| `instagram-publish.mjs` | ✅ Keep | Refactor to use lib |
| `instagram-publish-now.mjs` | ❌ Remove | Redundant - use background version |
| `instagram-publish-now-background.mjs` | ✅ Keep (rename?) | Refactor to use lib |
| `instagram-scheduled-publish-background.mjs` | ✅ Keep | Refactor to use lib |
| `lib/instagram-lib.mjs` | ✅ Keep | Enhance with all shared logic |
| `instagram-auth.mjs` | ✅ Keep | No changes needed |
| `instagram-diagnostic.mjs` | ✅ Keep | No changes needed |
| `instagram-studio-sync.mjs` | ✅ Keep | No changes needed |

**Total Files After Refactoring:** 7 (down from 8)

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

## � File Paths Reference

All paths are relative to repository root:

```
scripts/instagram-studio/
├── netlify/
│   └── functions/
│       ├── instagram-publish.mjs              # UI publish endpoint (SOURCE OF TRUTH)
│       ├── instagram-publish-now.mjs          # Manual trigger for scheduled
│       ├── instagram-publish-now-background.mjs # Manual trigger (15min timeout)
│       ├── instagram-scheduled-publish-background.mjs # Hourly cron
│       ├── instagram-auth.mjs                 # OAuth flow
│       ├── instagram-diagnostic.mjs           # Debug endpoint
│       ├── instagram-studio-sync.mjs          # Cloudinary sync
│       └── lib/
│           └── instagram-lib.mjs              # SHARED LIBRARY (enhance this)
├── src/
│   ├── services/
│   │   ├── instagramApi.ts                    # Client-side API (calls server)
│   │   └── cloudinarySync.ts                  # Client-side Cloudinary
│   └── utils/
│       └── imageUtils.ts                      # Image URL utilities
└── docs/
    └── REFACTORING_PLAN.md                    # This file
```

---

## 📝 Current Function Signatures

### From instagram-publish.mjs (SOURCE OF TRUTH)

```javascript
// Constants
const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';
const MAX_PROCESSING_WAIT = 25000; // 25 seconds
const POLL_INTERVAL = 2000; // 2 seconds

// Functions
async function handlePublishSingle(headers, accessToken, accountId, imageUrl, caption)
async function handlePublishCarousel(headers, accessToken, accountId, imageUrls, caption)
async function handleCreateCarouselItem(headers, accessToken, accountId, imageUrl)
async function handleCreateCarouselContainer(headers, accessToken, accountId, childIds, caption)
async function handlePublishContainer(headers, accessToken, accountId, containerId)
async function handleCheckStatus(headers, accessToken, containerId)
async function handleVerifyPublish(headers, accessToken, accountId, containerId)

// Internal helpers
async function waitForProcessing(containerId, accessToken)
  // Returns: { success: boolean, error?: string }
  // Checks: status_code field
  // Ready when: status_code === 'FINISHED'
  // Error when: status_code === 'ERROR' || status_code === 'EXPIRED'

async function publishMedia(containerId, accessToken, accountId)
  // Returns: { success: boolean, postId?: string, permalink?: string, error?: string }
  // Has rate limit detection and verification fallback

async function verifyPublishStatus(containerId, accessToken, accountId)
  // Returns: { verified: boolean, postId?: string, permalink?: string, error?: string }
```

### From instagram-lib.mjs (CURRENT - needs updating)

```javascript
// Constants (same)
export const GRAPH_API_BASE = 'https://graph.instagram.com';
export const GRAPH_API_VERSION = 'v21.0';
export const CLOUDINARY_CLOUD = 'date24ay6';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Cloudinary functions
export async function fetchScheduleData()
  // Returns: schedule data object or null

export async function uploadToCloudinary(data)
  // Returns: Cloudinary upload result

export async function saveWithSmartMerge(statusUpdates)
  // Param: statusUpdates = Map<slotId, { status, publishedAt?, instagramMediaId?, error? }>
  // Has retry logic (3 attempts with exponential backoff)

export async function getInstagramUrls(imageUrls, projectId)
  // Returns: Array of Cloudinary URLs formatted for Instagram

// Instagram functions (NEED UPDATING - uses different field names)
export async function publishPost(post, accessToken, accountId, options = {})
  // post = { imageUrls: string[], caption: string }
  // options = { maxWait?: number, pollInterval?: number }

export async function publishSingleImage(imageUrl, caption, accessToken, accountId, options = {})
export async function publishCarousel(imageUrls, caption, accessToken, accountId, options = {})

export async function waitForMediaReady(mediaId, accessToken, options = {})
  // ⚠️ DIFFERENT: Checks 'status_code' field, looks for 'FINISHED'
  // options = { maxWait?: number, pollInterval?: number }

// Notifications
export async function sendNotification(results, scheduleData, options = {})
  // options = { type?: string, saveSuccess?: boolean, saveError?: Error }
```

### From instagram-publish-now.mjs / instagram-scheduled-publish-background.mjs

```javascript
// These have INLINE copies of all functions (to be removed)
// Constants
const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';
const CLOUDINARY_CLOUD = 'date24ay6';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const MAX_PROCESSING_WAIT = 30000; // or 120000 for background
const POLL_INTERVAL = 2000; // or 3000 for background

// Inline functions (DUPLICATED - to be replaced with imports)
async function fetchScheduleData()
async function saveWithSmartMerge(statusUpdates)
async function uploadToCloudinary(data)
async function getInstagramUrls(imageUrls, projectId)
async function publishPost(post, accessToken, accountId)
async function publishSingleImage(imageUrl, caption, accessToken, accountId)
async function publishCarousel(imageUrls, caption, accessToken, accountId)
async function waitForMediaReady(mediaId, accessToken)
async function sendNotification(results, scheduleData, saveSuccess, saveError)
```

---

## 🔄 Migration Code Examples

### Before (instagram-publish-now.mjs) - ~579 lines

```javascript
import crypto from 'crypto';

const GRAPH_API_BASE = 'https://graph.instagram.com';
const GRAPH_API_VERSION = 'v21.0';
const CLOUDINARY_CLOUD = 'date24ay6';
// ... 50+ more lines of constants and inline functions ...

export const handler = async (event) => {
  // ... handler logic using inline functions ...
  const scheduleData = await fetchScheduleData();
  // ...
  const result = await publishPost({ imageUrls, caption: fullCaption }, accessToken, accountId);
  // ...
  await saveWithSmartMerge(statusUpdates);
  await sendNotification(results, scheduleData, saveSuccess, saveError);
};

// ~450 lines of inline function definitions
async function fetchScheduleData() { ... }
async function saveWithSmartMerge(statusUpdates) { ... }
async function uploadToCloudinary(data) { ... }
async function getInstagramUrls(imageUrls, projectId) { ... }
async function publishPost(post, accessToken, accountId) { ... }
async function publishSingleImage(imageUrl, caption, accessToken, accountId) { ... }
async function publishCarousel(imageUrls, caption, accessToken, accountId) { ... }
async function waitForMediaReady(mediaId, accessToken) { ... }
async function sendNotification(results, scheduleData, saveSuccess, saveError) { ... }
```

### After (instagram-publish-now.mjs) - ~150 lines

```javascript
import {
  CLOUDINARY_CLOUD,
  fetchScheduleData,
  saveWithSmartMerge,
  getInstagramUrls,
  publishPost,
  sendNotification,
} from './lib/instagram-lib.mjs';

// Function-specific constants only
const USE_TODAY_WINDOW = true;
const SCHEDULE_WINDOW_MS = 60 * 60 * 1000;

export const handler = async (event) => {
  // ... same handler logic, but using imported functions ...
  const scheduleData = await fetchScheduleData();
  // ...
  const result = await publishPost(
    { imageUrls, caption: fullCaption }, 
    accessToken, 
    accountId,
    { maxWait: 30000, pollInterval: 2000 } // Pass options for timeout control
  );
  // ...
  await saveWithSmartMerge(statusUpdates);
  await sendNotification(results, scheduleData, { 
    type: 'Manual',
    saveSuccess,
    saveError 
  });
};

// NO inline function definitions - all imported from lib
```

---

## 🔧 Enhanced Library API Design

### Proposed instagram-lib.mjs Structure

```javascript
/**
 * Instagram Studio Shared Library
 * 
 * Single source of truth for:
 * - Constants (API URLs, Cloudinary config)
 * - Cloudinary operations (fetch, upload, merge)
 * - Instagram Graph API (publish single, carousel)
 * - Email notifications (via Resend)
 */

import crypto from 'crypto';

// ============================================
// CONSTANTS
// ============================================
export const GRAPH_API_BASE = 'https://graph.instagram.com';
export const GRAPH_API_VERSION = 'v21.0';
export const CLOUDINARY_CLOUD = 'date24ay6';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Default timing (can be overridden via options)
export const DEFAULT_MAX_WAIT = 60000;  // 60 seconds
export const DEFAULT_POLL_INTERVAL = 2000;  // 2 seconds

// ============================================
// CLOUDINARY OPERATIONS
// ============================================

/**
 * Fetch schedule data from Cloudinary
 * @returns {Promise<Object|null>} Schedule data or null if not found
 */
export async function fetchScheduleData() { ... }

/**
 * Upload data to Cloudinary as raw JSON
 * @param {Object} data - Data to upload
 * @returns {Promise<Object>} Cloudinary upload result
 */
export async function uploadToCloudinary(data) { ... }

/**
 * Save status updates with smart merge and retry logic
 * @param {Map<string, Object>} statusUpdates - Map of slotId to status update
 * @returns {Promise<boolean>} Success status
 */
export async function saveWithSmartMerge(statusUpdates) { ... }

/**
 * Convert image URLs to Instagram-ready Cloudinary URLs
 * @param {string[]} imageUrls - Original image URLs
 * @param {string} projectId - Project ID for Cloudinary path
 * @returns {Promise<string[]>} Instagram-formatted URLs
 */
export async function getInstagramUrls(imageUrls, projectId) { ... }

// ============================================
// INSTAGRAM GRAPH API - LOW LEVEL
// ============================================

/**
 * Create a media container on Instagram
 * @param {string} imageUrl - Image URL
 * @param {string|null} caption - Caption (null for carousel items)
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {boolean} isCarouselItem - Whether this is a carousel item
 * @returns {Promise<{id: string}>} Container ID
 */
export async function createMediaContainer(imageUrl, caption, accessToken, accountId, isCarouselItem = false) { ... }

/**
 * Wait for media container to finish processing
 * @param {string} mediaId - Media container ID
 * @param {string} accessToken - Instagram access token
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function waitForMediaReady(mediaId, accessToken, options = {}) { ... }

/**
 * Publish a media container to Instagram
 * @param {string} containerId - Container ID to publish
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @returns {Promise<{success: boolean, postId?: string, permalink?: string, error?: string}>}
 */
export async function publishMediaContainer(containerId, accessToken, accountId) { ... }

/**
 * Verify if a post was published (fallback for rate limit errors)
 * @param {string} containerId - Container ID
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @returns {Promise<{verified: boolean, postId?: string, permalink?: string}>}
 */
export async function verifyPublishStatus(containerId, accessToken, accountId) { ... }

// ============================================
// INSTAGRAM GRAPH API - HIGH LEVEL
// ============================================

/**
 * Publish a single image post
 * @param {string} imageUrl - Image URL
 * @param {string} caption - Post caption
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, postId?: string, permalink?: string, error?: string}>}
 */
export async function publishSingleImage(imageUrl, caption, accessToken, accountId, options = {}) { ... }

/**
 * Publish a carousel post
 * @param {string[]} imageUrls - Array of image URLs (2-10)
 * @param {string} caption - Post caption
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, postId?: string, permalink?: string, error?: string}>}
 */
export async function publishCarousel(imageUrls, caption, accessToken, accountId, options = {}) { ... }

/**
 * Publish a post (auto-detects single vs carousel)
 * @param {Object} post - { imageUrls: string[], caption: string }
 * @param {string} accessToken - Instagram access token
 * @param {string} accountId - Instagram account ID
 * @param {Object} options - { maxWait?: number, pollInterval?: number }
 * @returns {Promise<{success: boolean, postId?: string, permalink?: string, error?: string}>}
 */
export async function publishPost(post, accessToken, accountId, options = {}) { ... }

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Send notification email via Resend
 * @param {Array} results - Array of publish results
 * @param {Object} scheduleData - Schedule data for context
 * @param {Object} options - { type?: string, saveSuccess?: boolean, saveError?: Error }
 */
export async function sendNotification(results, scheduleData, options = {}) { ... }

// ============================================
// UTILITIES
// ============================================

/**
 * Validate hashtag count in caption
 * @param {string} caption - Caption to validate
 * @returns {{valid: boolean, count: number, error?: string}}
 */
export function validateHashtags(caption) {
  const hashtagCount = (caption?.match(/#\w+/g) || []).length;
  if (hashtagCount > 30) {
    return { valid: false, count: hashtagCount, error: `Too many hashtags (${hashtagCount}). Instagram allows maximum 30.` };
  }
  return { valid: true, count: hashtagCount };
}

/**
 * Build full caption with hashtags
 * @param {string} caption - Base caption
 * @param {string[]} hashtags - Array of hashtags
 * @returns {string} Full caption
 */
export function buildCaption(caption, hashtags = []) {
  let tags = hashtags;
  if (tags.length > 30) {
    console.log(`⚠️ Trimming hashtags from ${tags.length} to 30`);
    tags = tags.slice(0, 30);
  }
  return tags.length > 0 ? `${caption}\n\n${tags.join(' ')}` : caption;
}
```

---

## 🚀 Getting Started

```bash
# 1. Branch already created - switch to it
git checkout feature/instagram-studio-refactor

# 2. Navigate to Instagram Studio
cd scripts/instagram-studio

# 3. Install dependencies if needed
npm install

# 4. Start local development
npm run dev
# Access at http://localhost:8888 (NOT 5174)

# 5. Test current functionality works (before any changes)
# - Connect Instagram account (if not already)
# - Create a draft post
# - Test "Post Now" button
# - Verify post appears on Instagram

# 6. Begin Phase 2 - Enhance lib/instagram-lib.mjs
```

---

## ✅ Implementation Verification Checklist

After each phase, verify:

### Phase 2 (Library Enhancement)
- [ ] `lib/instagram-lib.mjs` exports all functions listed in API design
- [ ] All functions have JSDoc comments
- [ ] `waitForMediaReady` checks `status_code` field (not `status`)
- [ ] `waitForMediaReady` recognizes `FINISHED` status (not `READY`)
- [ ] `publishMediaContainer` has rate limit detection
- [ ] `validateHashtags` and `buildCaption` utilities added

### Phase 3 (instagram-publish.mjs Migration)
- [ ] Imports from `./lib/instagram-lib.mjs` work
- [ ] UI "Post Now" single image works
- [ ] UI "Post Now" carousel (3+ images) works
- [ ] Error messages display correctly
- [ ] Rate limit handling still works

### Phase 4 (Scheduled Functions Migration)
- [ ] `instagram-publish-now.mjs` is deleted (redundant)
- [ ] `instagram-publish-now-background.mjs` renamed and uses library imports
- [ ] `instagram-scheduled-publish-background.mjs` uses library imports
- [ ] Manual trigger works: `curl -X POST https://studio.lemonpost.studio/.netlify/functions/instagram-publish-now`
- [ ] Status updates save to Cloudinary
- [ ] Notification emails send correctly

### Phase 5 (Cleanup)
- [ ] No duplicate function definitions remain
- [ ] All inline constants removed (use exports from lib)
- [ ] Code reduced by estimated ~1,350 lines
- [ ] All tests pass

---

**Branch:** `feature/instagram-studio-refactor` (already created)  
**Next Step:** Start Phase 2 - Enhance `lib/instagram-lib.mjs`
