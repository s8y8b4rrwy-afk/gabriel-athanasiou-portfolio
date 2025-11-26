# Scroll Restoration Guide

## Overview

The portfolio implements intelligent scroll position restoration to enhance user experience when navigating between pages using browser back/forward buttons.

## Behavior

### List Pages (Scroll Position Remembered)
The following pages remember their scroll position when you navigate away and return:
- `/` - Home page
- `/work` - Filmography index
- `/journal` - Journal index
- `/about` - About page
- `/thumbnails` - Thumbnail preview

**Example:**
1. User scrolls down `/work` to see project #15
2. User clicks on project #15
3. User reads the project detail page
4. User clicks back button
5. ✅ Page returns to `/work` scrolled to project #15 position

### Detail Pages (Always Scroll to Top)
Project and journal detail pages always open scrolled to the top:
- `/work/:slug` - Project detail pages
- `/journal/:slug` - Journal post pages

**Example:**
1. User is viewing `/work/project-a` and scrolls down
2. User clicks back to `/work`
3. User clicks on another project `/work/project-b`
4. ✅ New project opens scrolled to top (not remembering previous project scroll)

### Other Pages
All other pages follow default behavior (scroll to top).

## Interaction with “Close” (Return-to-Opener)

Detail pages (projects and journal posts) prefer returning to the page that opened them. We pass `state.from` when navigating into a detail page from a list or featured card. The Close button then uses browser back (`navigate(-1)`) when that state exists, falling back to a sensible default otherwise.

- From Home (`/`) → Project or Journal: Close returns to Home and restores its scroll.
- From Work (`/work` with filters) → Project: Close returns to the same filtered list and restores its scroll.
- From Project → Related Journal: Close returns back to that Project.
- From Journal → Associated Project: Close returns back to that Journal post.
- Direct opens (no prior page): Close falls back to `/` or `/journal`.

Because scroll positions are keyed by pathname and saved when leaving list pages, using back navigation lands on the exact prior history entry and restores its saved scroll automatically.

## Implementation

### Files
- `utils/scrollRestoration.ts` - Core scroll restoration utility
- `App.tsx` - Integration with React Router

### How It Works

1. **Saving Scroll Position**
   - When navigating away from a list page, current scroll position is saved to `sessionStorage`
   - Only list pages save their position
   - Position is stored as: `{ pathname: scrollY }`

2. **Restoring Scroll Position**
   - On navigation, the utility checks if the current page is a list page
   - If saved position exists, it restores it using `requestAnimationFrame`
   - If no saved position, scrolls to top (new visit)
   - Detail pages always scroll to top regardless of saved positions

3. **Session Persistence**
   - Scroll positions are stored in `sessionStorage`
   - Positions persist during the browser session
   - Positions are cleared when browser tab is closed
   - Compatible with page refresh

## Benefits

✅ **Better UX**: Users don't lose their place when browsing projects  
✅ **Expected Behavior**: Matches modern web app expectations (YouTube, Netflix, etc.)  
✅ **Smart Logic**: Detail pages always start fresh at top  
✅ **No Conflicts**: Works seamlessly with page transitions and animations  
✅ **Session-Based**: Clean slate on new tab/window  

## Testing

### Test List Page Restoration
1. Navigate to `/work`
2. Scroll down to middle of page
3. Click on any project
4. Press browser back button
5. Verify you're back at the scrolled position

### Test Detail Page Top Scroll
1. Open a project `/work/project-name`
2. Scroll down the detail page
3. Press back to `/work`
4. Click a different project
5. Verify new project opens at top (not at previous scroll)

### Test Multiple List Pages
1. Scroll down `/work` to position A
2. Navigate to `/journal`
3. Scroll down `/journal` to position B
4. Navigate to home `/`
5. Press back twice
6. Verify `/journal` is at position B
7. Press back again
8. Verify `/work` is at position A

### Test Close + Restoration
1. From Home, open the Featured Journal → press Close → verify you return to Home with the same scroll.
2. From Work with a filter applied, open a Project → press Close → verify you return to the filtered list and the same scroll.
3. From a Project, open its related Journal → press Close → verify you return to the Project.

## API Reference

### `saveScrollPosition(pathname: string)`
Saves current scroll position for the given pathname if it's a list page.

### `restoreScrollPosition(pathname: string)`
Restores scroll position for list pages, or scrolls to top for detail pages.

### `isListPage(pathname: string): boolean`
Checks if pathname is a list page that should remember scroll position.

### `isDetailPage(pathname: string): boolean`
Checks if pathname is a detail page that should always scroll to top.

### `clearScrollPosition(pathname: string)`
Removes saved scroll position for a specific pathname.

### `clearAllScrollPositions()`
Clears all saved scroll positions from sessionStorage.

## Configuration

To add or remove pages from scroll restoration, edit `LIST_PAGES` array in `utils/scrollRestoration.ts`:

```typescript
const LIST_PAGES = ['/', '/work', '/journal', '/about', '/thumbnails'];
```

## Troubleshooting

**Scroll position not restoring?**
- Check browser console for warnings
- Verify sessionStorage is enabled
- Ensure you're navigating with back/forward buttons (not clicking links)

**Scroll jumping on navigation?**
- This is expected for detail pages (always scroll to top)
- For list pages, check if scroll position was previously saved

**Conflicts with page transitions?**
- Scroll restoration uses `requestAnimationFrame` to wait for DOM
- Works seamlessly with PageTransition component animations
 - Ensure navigations into details pass `state.from` when you want Close to return to opener.
