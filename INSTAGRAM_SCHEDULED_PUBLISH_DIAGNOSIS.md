# Instagram Studio Scheduled Publishing - Diagnosis & Solution

**Date:** December 8, 2025  
**Status:** Posts not publishing automatically - Diagnostic tools created to identify root cause

---

## 🔴 Problem Statement

Scheduled Instagram posts in the Instagram Studio app are **not automatically publishing** at their scheduled times. Posts remain in "pending" status indefinitely, even when their scheduled time has passed.

### Symptoms:
- ❌ Posts scheduled for specific dates/times never change status to "published"
- ❌ No visible logs or error messages in the app
- ❌ Manual sync works fine, but scheduled publishing is non-functional
- ❌ No way to see what the scheduled function is doing (no UI logs)

---

## 🔍 Root Cause Analysis

After investigating the codebase, I found:

### What's Configured Correctly:
✅ **Scheduled Function Exists** - `netlify/functions/instagram-scheduled-publish.mjs`
- Has proper Netlify scheduled function config: `export const config = { schedule: '0 * * * *' }`
- Runs every hour at minute 0
- Has correct logic to find and publish due posts
- Includes smart merge to save status updates

✅ **Data Structure** - Instagram Studio app correctly saves schedule data
- Posts created with `status: 'pending'`
- Schedule slots stored with `scheduledDate` and `scheduledTime`
- Instagram credentials synced to Cloudinary with `instagram: { connected, accessToken, accountId }`

✅ **Publishing Logic** - Function has correct Instagram Graph API integration
- Creates media containers
- Handles single images and carousels
- Waits for media processing
- Publishes and gets confirmation

### What Could Be Breaking:

#### Issue 1: **Instagram Connection Not Persisted** (Most Likely)
- When you connect Instagram in the app, is the `instagram.connected` flag being saved to Cloudinary?
- The scheduled function checks: `if (!scheduleData.instagram?.connected || !scheduleData.instagram?.accessToken) return`
- If either is missing/false, the function exits silently

#### Issue 2: **Data Not Syncing to Cloudinary** (Possible)
- Posts scheduled locally but not uploaded to Cloudinary (the scheduled function fetches from Cloudinary, not local storage)
- Cloudinary data is stale with no pending posts

#### Issue 3: **Environment Variables Missing** (Possible)
- `CLOUDINARY_API_SECRET` required to save status updates back to Cloudinary
- Without it, posts publish but status update fails

#### Issue 4: **Timezone Mismatch** (Possible)
- Scheduled time stored in one timezone
- Scheduled function checks in different timezone
- Post never appears "due"

#### Issue 5: **Scheduled Function Not Being Triggered** (Unlikely but possible)
- Netlify not recognizing the scheduled function
- Requires redeploy to activate

---

## 🛠️ Solution: Three-Step Diagnostic Process

I've created three tools to identify the exact problem:

### 1. **Diagnostic Function** - `instagram-diagnostic.mjs`
**URL:** `/.netlify/functions/instagram-diagnostic`

**What it checks:**
- ✅ Cloudinary connection - can fetch schedule data?
- ✅ Instagram connection - is `connected: true` and access token exists?
- ✅ Data structure - correct number of drafts and schedule slots?
- ✅ Pending posts - which slots have `status: 'pending'`?
- ✅ Due posts - which are in the 1-hour publishing window?
- ✅ Environment variables - all required env vars set?

**Example Output:**
```json
{
  "summary": {
    "scheduleDataFound": true,
    "instagramConnected": false,           // ← PROBLEM!
    "pendingPostsCount": 3,
    "duePostsCount": 1,
    "readyToPublish": false
  },
  "checks": {
    "instagramConnection": {
      "status": "ERROR",
      "connected": false,
      "hasAccessToken": false
    }
  }
}
```

### 2. **Manual Publish Trigger** - `instagram-publish-now.mjs`
**URL:** `/.netlify/functions/instagram-publish-now` (POST)

**Why it helps:**
- Tests the publishing logic immediately
- Doesn't wait for hourly cron
- Shows detailed error messages if something fails
- Useful for manual publishing

**Example Response:**
```json
{
  "success": false,
  "message": "Instagram not connected",
  "details": {
    "connected": false,
    "hasAccessToken": false
  }
}
```

### 3. **Local Test Script** - `test-instagram-scheduled.sh`
```bash
./scripts/test-instagram-scheduled.sh
```
Runs the diagnostic and formats output nicely

---

## 📋 Deployment & Testing Steps

### Step 1: Deploy the New Functions
```bash
git add netlify/functions/instagram-diagnostic.mjs
git add netlify/functions/instagram-publish-now.mjs
git commit -m "feat: add Instagram scheduling diagnostics [deploy]"
git push origin main
```

Then in Netlify Dashboard or via GitHub Actions trigger a deployment.

### Step 2: Wait 2-3 Minutes for Deployment
Functions need time to build and deploy to Netlify's edge.

### Step 3: Run Diagnostic (after deployment)

**Option A - Online Diagnostic:**
```bash
curl https://lemonpost.studio/.netlify/functions/instagram-diagnostic | jq
```

**Option B - Local Script:**
```bash
./scripts/test-instagram-scheduled.sh
```

### Step 4: Analyze Results

**If you see:**

| Finding | Meaning | Fix |
|---------|---------|-----|
| `"instagramConnected": false` | Instagram auth missing | Go to app, reconnect Instagram |
| `"pendingPostsCount": 0` | No posts scheduled | Schedule posts in the app |
| `"duePostsCount": 0` | No posts in time window | Check post scheduling times (should be past) |
| `"hasCloudinaryApiSecret": false` | Missing environment variable | Add `CLOUDINARY_API_SECRET` to Netlify env vars |
| `"readyToPublish": true` | Everything OK | Try manual trigger below |

### Step 5: Manual Test (if ready to publish)

```bash
curl -X POST https://lemonpost.studio/.netlify/functions/instagram-publish-now | jq
```

This will:
- Check for pending posts due now
- Attempt to publish them
- Show detailed success/failure for each post
- Save status updates to Cloudinary

---

## 🔧 Common Fixes

### Fix 1: Instagram Not Connected
1. Open https://studio.lemonpost.studio
2. Click "Connect Instagram"
3. Authorize the app
4. Allow it to write to your Cloudinary data
5. Run diagnostic again - should show `"instagramConnected": true`

### Fix 2: No Pending Posts
1. Open https://studio.lemonpost.studio
2. Create a draft post from a project
3. Click calendar or schedule panel
4. Schedule it for **now or a past time** (not future!)
5. Click "Sync Now" to upload to Cloudinary
6. Run diagnostic - should show `"pendingPostsCount": 1`

### Fix 3: Missing Environment Variables
1. Netlify Dashboard → Your Site → Settings
2. Go to Environment Variables
3. Add or verify:
   - `CLOUDINARY_API_SECRET` - from Cloudinary dashboard
   - `CLOUDINARY_CLOUD_NAME` - should be `date24ay6`
   - `CLOUDINARY_API_KEY` - from Cloudinary dashboard
4. Redeploy the site
5. Run diagnostic again

### Fix 4: Posts Scheduled for Future
The scheduled function only publishes posts within the **last 1 hour window**.
- If post is scheduled for tomorrow, it won't publish until tomorrow
- To test immediately, reschedule post to **5 minutes ago**
- Then run diagnostic to confirm it's "due"

---

## 📊 Expected Behavior After Fix

Once everything is set up correctly:

1. **Hourly Check** - At minute 0 of each hour, the scheduled function:
   - Fetches schedule data from Cloudinary
   - Checks for pending posts due in last 1 hour
   - Publishes each one to Instagram
   - Updates status to "published" in Cloudinary
   - Sends notification email (if configured)

2. **Real-Time Updates** - In the app:
   - Post status changes from "pending" to "published"
   - Instagram post URL appears in the data
   - Published posts move out of "scheduled" view

3. **Audit Trail**:
   - Netlify function logs show each publish attempt
   - Email notifications for success/failures
   - Status updates saved in Cloudinary schedule data

---

## 🐛 Debugging Checklist

After running diagnostic, check these in order:

- [ ] Can fetch schedule data from Cloudinary? ✅ → Continue
- [ ] Instagram connected with access token? ❌ → Fix #1 above
- [ ] Any pending posts scheduled? ❌ → Fix #2 above
- [ ] CLOUDINARY_API_SECRET set? ❌ → Fix #3 above
- [ ] Any posts due for publishing? ❌ → Fix #4 above
- [ ] All checks pass? ✅ → Run manual publish test
- [ ] Manual publish succeeds? ✅ → Problem solved! Wait for next hourly check
- [ ] Manual publish fails? ❌ → Check error message in response

---

## 🚀 Next Steps

1. **Deploy** the diagnostic functions (commit already made)
2. **Run diagnostic** after 2-3 minute deployment window
3. **Share the output** from the diagnostic
4. **Apply appropriate fix** based on findings
5. **Re-run diagnostic** to verify fix worked
6. **Test manual publish** if ready
7. **Monitor logs** in Netlify for next scheduled run (top of hour)

---

## 📝 Files Modified/Created

### New Files:
- ✨ `netlify/functions/instagram-diagnostic.mjs` - Diagnostic endpoint
- ✨ `netlify/functions/instagram-publish-now.mjs` - Manual publish trigger
- ✨ `scripts/test-instagram-scheduled.sh` - Local test script

### Modified Files:
- 📝 `netlify/functions/instagram-scheduled-publish.mjs` - Enhanced with logging

All changes committed and ready to deploy.

---

## 📞 Support

After deployment and running diagnostics, you'll have clear visibility into:
- Whether schedule data exists in Cloudinary
- Whether Instagram is properly connected
- Which posts are pending and due
- Why publishing might be failing
- Exact error messages if it fails

This should pinpoint the exact issue preventing scheduled publishing.
