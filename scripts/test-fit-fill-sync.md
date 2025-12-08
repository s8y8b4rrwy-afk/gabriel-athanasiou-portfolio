# Instagram Studio FIT/FILL Mode Synchronization Fix

## Problem
The FIT mode preview and publishing logic are not synchronized:

### Preview Logic (getCarouselTransformMode)
- Calculates average landscape ratio from all images
- Clamps to 1.91 max
- Uses this calculated ratio for aspectRatio display

### Publishing Logic (getInstagramPublishUrls)  
- FILL mode: Uses fixed 1.91 or 4:5 (correct ✓)
- FIT mode: Uses fixed 1.91 or 4:5 (WRONG ✗ - should use calculated average like preview)

## Solution
Update `getInstagramPublishUrls` to match `getCarouselTransformMode` exactly:

### For FIT Mode Landscape Majority:
**Currently (WRONG):**
```javascript
targetAspectRatio = INSTAGRAM_ASPECT_RATIOS.LANDSCAPE_191_100; // Fixed "1.91"
cropMode = 'pad'; // Letterbox
```

**Should Be (CORRECT):**
```javascript
const avgRatio = landscapeCount > 0 ? totalLandscapeRatio / landscapeCount : 1.78;
const clampedRatio = Math.min(avgRatio, 1.91);
targetAspectRatio = clampedRatio.toFixed(2); // e.g., "1.78", "1.91"
cropMode = 'pad'; // Letterbox with calculated ratio
```

This ensures published images use the SAME aspect ratio shown in preview.

## Implementation Changes

### File: scripts/instagram-studio/src/utils/imageUtils.ts

#### Change 1: getCarouselTransformMode() 
- Add comment explaining it must match getInstagramPublishUrls()
- Already correct ✓

#### Change 2: getInstagramPublishUrls()
- Track totalLandscapeRatio during dimension analysis
- For FIT mode landscape majority, calculate average ratio (like preview does)
- Pass this ratio to buildCloudinaryUrlForCarousel()
- Add detailed console logs showing the calculation

#### Change 3: buildCloudinaryUrlForCarousel()
- Already supports custom aspectRatio via parameter ✓
- No changes needed

## Test Case
1. Create carousel with mixed landscape images (e.g., 2.0:1 and 1.5:1)
2. Preview shows average ratio: (2.0 + 1.5) / 2 = 1.75:1
3. Publish should use 1.75:1 (not fixed 1.91:1)
4. Published image has same aspect ratio as preview ✓

## Files to Update
- scripts/instagram-studio/src/utils/imageUtils.ts (2 functions, ~100 lines of changes)
