# Analytics Testing Guide

Before deploying to production, test that analytics events are firing correctly.

## Step 1: Check Console Logs

When you trigger events, they'll log to the browser console.

1. Open your browser **DevTools** (F12 or Cmd+Option+I on Mac)
2. Go to the **Console** tab
3. Start your dev server: `npm run dev`
4. Open http://localhost:3000

**You should see:**
```
✅ Analytics initialized with ID: G-XXXXXXXXXX
```

If you see an error instead, check that your Measurement ID is correct in `App.tsx`.

## Step 2: Test Page Views

**What to do:**
1. Navigate between pages in your portfolio
2. Check the Console for messages like:
```
📊 Event tracked: page_view
```

**Expected pages to test:**
- / (Home)
- /work (Filmography)
- /work/[any-project] (Project detail)
- /journal (Blog)
- /journal/[any-post] (Blog post)
- /about (About)

## Step 3: Test Custom Events

### Test Video Play
1. Go to any project detail page with a video
2. Click the "Watch Film" button
3. **You should see in Console:**
```
📊 Event tracked: video_play
{project_id: "rec123...", project_title: "My Project", ...}
```

### Test Social Share
1. On a project or blog post, click any share button (Twitter, LinkedIn, Facebook, Copy Link)
2. **You should see in Console:**
```
📊 Event tracked: social_share
{platform: "twitter", title: "My Project", url: "https://...", ...}
```

### Test External Links
1. On a project, scroll down to any external links (IMDb, LinkedIn, etc.)
2. Click one
3. **You should see in Console:**
```
📊 Event tracked: external_link_click
{label: "IMDb", url: "https://imdb.com/...", ...}
```

## Step 4: Verify in Google Analytics (Real-time)

Once deployed to production (not localhost), you can see real events:

1. Go to **https://analytics.google.com**
2. Click your property
3. Go to **Real-time** > **Overview**
4. Visit your live website
5. **You should see:**
   - 1 Active user (you)
   - Page views appearing
   - Events listed under "Real-time events"

**Note:** Real-time events show up in 1-30 seconds after they fire.

## Step 5: Full Reports (Wait 24-48 Hours)

GA takes time to process data. After a day or two, you'll see reports like:

- **Engagement** tab: Page views, session duration, bounce rate
- **Acquisition** tab: Where visitors come from
- **Events** tab: All your custom events (video plays, shares, etc.)

## Common Issues & Fixes

### Problem: "Analytics not initialized" warning in console

**Cause:** Measurement ID is `G-XXXXXXXXXX` (placeholder) instead of real ID

**Fix:** 
1. Get your real ID from https://analytics.google.com
2. Update in `App.tsx`:
```typescript
analyticsService.init('G-YOUR-REAL-ID-HERE');
```

### Problem: Events not showing in Real-time

**Cause:** Might be a few seconds delay, or targeting filter is enabled

**Fix:**
1. Wait 30 seconds and refresh GA dashboard
2. Check that you're looking at the right property (top-left dropdown)
3. Check that you're visiting the correct domain

### Problem: Localhost events not appearing

**This is expected!** Google Analytics filters out localhost traffic by default for data quality.

Events will appear once deployed to production (yourdomain.com).

## Debugging Tips

**Enable verbose logging (optional):**

If you want more detailed logs, temporarily update `analyticsService.ts`:

```typescript
// In trackEvent method, uncomment:
console.log(`📊 Event tracked: ${eventName}`, eventData); // Already enabled
```

**Check network requests:**

1. In DevTools, go to **Network** tab
2. Look for requests to `analytics.google.com`
3. You should see POST requests when events fire
4. If missing, check that Measurement ID is correct

**Test without events logging:**

If console spam bothers you, comment out the `console.log` in `analyticsService.ts`:

```typescript
// console.log(`📊 Event tracked: ${eventName}`, eventData);
```

## Next Steps

Once you confirm events are firing:
1. Deploy to production
2. Wait 24-48 hours for GA to process data
3. Check reports in GA dashboard
4. Set up Google Search Console for SEO insights
