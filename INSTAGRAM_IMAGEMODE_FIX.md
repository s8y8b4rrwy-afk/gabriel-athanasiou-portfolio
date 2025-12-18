# Instagram imageMode Fix Plan

## ✅ IMPLEMENTED - December 18, 2025

## Problem Summary

**Published post was cropped incorrectly**: The image was force-cropped to portrait (4:5) when it should have been letterboxed (fit mode with 1.91:1 landscape).

**Root cause**: The backend `getInstagramUrls()` function in `instagram-lib.mjs` **never supported `imageMode`**. It was copied from the old inline function which always used hardcoded portrait crop (`ar_0.8,c_lfill`).

---

## History Analysis (from git)

### What worked (UI Publish Button)

At commit `03625d8`, the **PublishButton.tsx** used the **frontend** `getInstagramPublishUrls()`:

```tsx
// scripts/instagram-studio/src/components/Schedule/PublishButton.tsx
const instagramUrls = await getInstagramPublishUrls(
  draft.selectedImages, 
  draft.projectId, 
  draft.imageMode || 'fill'  // ✅ Passes imageMode!
);
```

The frontend function in `imageUtils.ts` properly:
1. Takes `imageMode` parameter ('fill' | 'fit')
2. Gets image dimensions
3. Determines majority orientation (landscape vs portrait)
4. Uses `c_pad` for 'fit' mode (letterbox)
5. Uses `c_lfill` for 'fill' mode (crop to fill)

### What never worked (Scheduled/Background Publish)

The **backend** function in `instagram-scheduled-publish.mjs` (even at commit `db18f9e`) used a **local** `getInstagramUrls()` that:
1. ❌ Does NOT accept `imageMode` parameter
2. ❌ ALWAYS uses `ar_0.8,c_lfill` (portrait crop)
3. ❌ Ignores image dimensions entirely

When the shared library was created at `5d91771`, this broken implementation was copied verbatim into `instagram-lib.mjs`.

---

## Two Paths That Exist

| Path | Function Used | imageMode Support | Works? |
|------|--------------|-------------------|--------|
| **UI Publish Button** | Frontend `getInstagramPublishUrls()` | ✅ Yes | ✅ Yes |
| **Scheduled Publish** | Backend `getInstagramUrls()` | ❌ No | ❌ No |
| **Background Publish** | Backend `getInstagramUrls()` | ❌ No | ❌ No |

---

## The Fix

### Option A: Port frontend logic to backend (RECOMMENDED)

Port the full `getInstagramPublishUrls()` logic to the backend shared library. This requires:

1. **Add image dimension fetching** to `instagram-lib.mjs`
2. **Add majority orientation detection** (landscape vs portrait count)
3. **Add aspect ratio constants** (1.91:1 landscape, 4:5 portrait)
4. **Update function signature** to accept `imageMode`
5. **Update all callers** to pass `draft.imageMode`

**Pros:**
- Backend has full feature parity with frontend
- Scheduled posts work identically to UI publish
- Single source of truth in shared library

**Cons:**
- More complex backend code
- Need to fetch image dimensions server-side


### Files to modify:

1. **`scripts/instagram-studio/netlify/functions/lib/instagram-lib.mjs`**
   - Add `getImageDimensions()` helper
   - Add `INSTAGRAM_ASPECT_RATIOS` constants
   - Rewrite `getInstagramUrls()` to accept `imageMode` and detect orientation

2. **`scripts/instagram-studio/netlify/functions/instagram-scheduled-publish.mjs`**
   - Update call: `getInstagramUrls(draft.selectedImages, draft.projectId, draft.imageMode || 'fill')`

3. **`scripts/instagram-studio/netlify/functions/instagram-publish-now-background.mjs`**
   - Update call: `getInstagramUrls(draft.selectedImages, draft.projectId, draft.imageMode || 'fill')`

### New `getInstagramUrls()` signature:

```javascript
/**
 * Generate Instagram-ready URLs from Cloudinary portfolio IDs
 * @param {string[]} imageUrls - Original image URLs
 * @param {string} projectId - Project record ID
 * @param {'fill' | 'fit'} imageMode - 'fill' = crop to fill, 'fit' = letterbox
 * @returns {Promise<string[]>} Instagram-optimized Cloudinary URLs
 */
export async function getInstagramUrls(imageUrls, projectId, imageMode = 'fill')
```

### Key logic to port:

```javascript
// 1. Get dimensions for all images
const dimensions = await Promise.all(imageUrls.map(url => getImageDimensions(url)));

// 2. Count orientations
let landscapeCount = 0, portraitCount = 0, normalCount = 0;
for (const dim of dimensions) {
  if (dim) {
    const ratio = dim.width / dim.height;
    if (ratio > 1.0) landscapeCount++;
    else if (ratio < 0.8) portraitCount++;
    else normalCount++;
  }
}

// 3. Determine majority
const isLandscapeMajority = landscapeCount >= portraitCount && landscapeCount >= normalCount;

// 4. Choose aspect ratio
const targetAspectRatio = isLandscapeMajority ? '1.91' : '0.8';

// 5. Choose crop mode based on imageMode
const cropMode = imageMode === 'fit' ? 'c_pad' : 'c_lfill';

// 6. Build URLs with chosen transforms
```

---

## Testing Plan

After implementing:

1. **Unit test**: Create test draft with `imageMode: 'fit'` and landscape images
2. **Dry run**: `curl -X POST "...?dry_run=true"` and verify logged URLs use `c_pad`
3. **Visual test**: Check Cloudinary URL in browser shows letterboxed image
4. **Live test**: Publish a test post and verify on Instagram

---

## Timeline

- ✅ **IMPLEMENTED**: Fix in `instagram-lib.mjs` with full imageMode support
- ✅ **IMPLEMENTED**: Updated callers in scheduled-publish and publish-now-background
- **Then**: Test with dry run
- **Then**: Deploy and verify

---

## Implementation Details

### Changes Made (December 18, 2025)

**1. `scripts/instagram-studio/netlify/functions/lib/instagram-lib.mjs`:**
- Added `INSTAGRAM_ASPECT_RATIOS` constants
- Added `getImageDimensions()` function using Cloudinary's `fl_getinfo` flag
- Added `buildCloudinaryUrlForCarousel()` helper
- Rewrote `getInstagramUrls()` to:
  - Accept `imageMode` parameter ('fill' | 'fit')
  - Fetch dimensions for all images
  - Detect majority orientation (landscape vs portrait)
  - Use `c_pad` for 'fit' mode (letterbox)
  - Use `c_lfill` for 'fill' mode (crop to fill)

**2. `scripts/instagram-studio/netlify/functions/instagram-scheduled-publish.mjs`:**
- Updated call: `getInstagramUrls(draft.selectedImages, draft.projectId, draft.imageMode || 'fill')`

**3. `scripts/instagram-studio/netlify/functions/instagram-publish-now-background.mjs`:**
- Updated call: `getInstagramUrls(draft.selectedImages, draft.projectId, draft.imageMode || 'fill')`

---

## Root Cause Summary

The backend `getInstagramUrls()` was **never designed to handle imageMode**. When the shared library was created, the broken implementation was simply moved into it. The UI publish button bypassed this by calling the frontend function directly.

**The scheduled publish path has NEVER respected `imageMode`** - this is the first time it was tested with `imageMode: 'fit'`.
