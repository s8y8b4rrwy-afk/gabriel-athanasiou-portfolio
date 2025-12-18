# 📋 Instagram Scheduled Publish - Verification Guide

> Complete checklist for verifying scheduled publishing is working correctly with logs and email notifications.

---

## ✅ Environment Variables Verification

### Required Variables on Netlify (Studio Site)

These variables must be set on **studio.lemonpost.studio** site:

| Variable | Type | Example | Status |
|----------|------|---------|--------|
| `CLOUDINARY_CLOUD_NAME` | Required | `date24ay6` | Check ✓ |
| `CLOUDINARY_API_KEY` | Required | `abc123...` | Check ✓ |
| `CLOUDINARY_API_SECRET` | Required | `xyz789...` | Check ✓ |
| `INSTAGRAM_APP_ID` | Required | `1386961439465356` | Check ✓ |
| `INSTAGRAM_APP_SECRET` | Required | `abc123...` | Check ✓ |
| `INSTAGRAM_ACCOUNT_ID` | Required | `24965197513162722` | Check ✓ |
| `INSTAGRAM_ACCESS_TOKEN` | Required | `IGQVJi...` | Check ✓ |
| `NOTIFICATION_EMAIL` | Optional | `gabriel@lemonpost.studio` | Check ✓ |
| `RESEND_API_KEY` | Optional | `re_...` | Check ✓ |
| `INSTAGRAM_DRY_RUN` | Optional | `false` | Check ✓ |

### How to Verify on Netlify

1. Go to **Netlify Dashboard** → **studio.lemonpost.studio** site
2. Navigate to **Site settings** → **Environment variables**
3. Verify all required variables are present and filled
4. Check **Deploy & Build** → **Build command** to ensure it includes Instagram functions

**Required for scheduled function:**
```bash
# Should see: "Loaded function instagram-scheduled-publish-background"
```

---

## 🧪 Local Testing (Development)

### Step 1: Check .env Files

Make sure you have the right environment variables locally:

```bash
cd scripts/instagram-studio
cat .env.local
# Should show Instagram-related variables
```

### Step 2: Start Dev Server

```bash
npm run dev
```

**Expected output:**
```
✔ Loaded function instagram-scheduled-publish-background in Lambda compatibility mode
✔ Loaded function instagram-publish-now-background in Lambda compatibility mode
...
Local dev server ready: http://localhost:8888
```

### Step 3: Check Function Logs

Open the browser console and go to `http://localhost:8888/.netlify/functions/instagram-scheduled-publish-background`

You should see the function is loaded and ready.

---

## 🚀 Manual Testing in Development

### Test 1: Manual Trigger with Dry Run

Trigger the function manually with DRY_RUN enabled:

```bash
curl -X POST http://localhost:8888/.netlify/functions/instagram-scheduled-publish-background \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected output (if schedule data exists):**
```json
{
  "ok": true,
  "dryRun": true,
  "results": [
    {
      "postId": "slot123",
      "projectId": "The Project Name",
      "success": true,
      "dryRun": true
    }
  ]
}
```

**Expected logs:**
```
📋 Fetched schedule data from Cloudinary
📅 Using TODAY window: 2025-12-18T00:00:00Z to 2025-12-18T15:30:00Z
📋 Total schedule slots: 5
   Status distribution: { pending: 2, published: 3 }
   ✅ Due: 2025-12-18 09:00 (draft123)
📬 Found 1 post(s) to publish
📤 Publishing post: The Project Name
🧪 DRY_RUN: skipping publish for The Project Name
✅ Published: The Project Name
📧 Notification email sent successfully
```

### Test 2: Real Publish (One Post Only)

If you want to test a real publish, schedule exactly **one post** for the next few minutes, then trigger:

```bash
curl -X POST http://localhost:8888/.netlify/functions/instagram-scheduled-publish-background
```

**Expected logs (real publish):**
```
📤 Publishing post: The Project Name
   📸 Single image: Using createMediaContainer + publishMediaContainer
   ✅ Created media container: 17924596859123456
   ⏳ Waiting for media processing...
   ✓ Media ready (status: FINISHED)
   ✅ Published successfully! Post ID: 17924596859123456
✅ Published: The Project Name
💾 Saving status updates (attempt 1/3)...
💾 Status updates saved successfully
📧 Notification email sent successfully
```

---

## 📊 Logs Explanation

### Function Execution Flow

Each scheduled publish run logs the complete flow:

```
1. 📋 Fetching schedule data
   - Shows: Source (Cloudinary), size of data
   - Issues: Permissions, network errors

2. 📅 Time window calculation
   - TODAY window: Full calendar day (midnight to now)
   - 1-HOUR window: Last hour only
   - Shows: Window start and end times

3. 📋 Schedule analysis
   - Total slots: How many posts exist
   - Status distribution: pending/published/failed breakdown
   - Due posts: Which posts meet the window criteria

4. 📬 Publishing loop (for each due post)
   - 📤 Start publishing
   - 📸 Single image or carousel
   - ⏳ Wait for processing
   - 📤 Create media container
   - ⏳ Poll for status_code: FINISHED
   - ✅ Publish (calls publishMediaContainer)
   - Result: Success or error details

5. 💾 Save status updates
   - 🔄 Smart merge with fresh cloud data
   - ✓ Update slot status: pending → published
   - 📊 Applied N updates
   - ✅ Cloudinary upload successful

6. 📧 Email notification
   - From: Instagram Studio <noreply@lemonpost.studio>
   - To: Your NOTIFICATION_EMAIL
   - Subject: ✅ Instagram: 1 post(s) published
   - Includes: Detailed results, error messages

7. ✅ Complete
   - Returns: JSON response with all results
```

---

## 📧 Email Notifications

### When Emails Are Sent

Emails are sent **only if** both variables are configured:
- `NOTIFICATION_EMAIL` - Recipient email address
- `RESEND_API_KEY` - Resend email service API key

### Email Content

**Subject:** 
- Success: `✅ Instagram: 1 post(s) published`
- With failures: `⚠️ Instagram: 1 published, 1 failed`

**Email body includes:**
```
📧 Instagram Scheduled Publish Report

Time: 18 December 2025, 3:30 PM (UK time)

✅ Successfully Published (1)
  • The Project Name - Media ID: 17924596859123456

[If applicable]
❌ Failed (1)
  • Another Project - Error: Rate limit exceeded

[If save failed]
⚠️ Data Save Failed: Status updates could not be saved to Cloudinary
   The posts were published to Instagram, but their status...

→ Open Instagram Studio
```

### Setting Up Email Notifications

#### 1. Get Resend API Key

Go to https://resend.com:
1. Sign up / Log in
2. Dashboard → **API Keys** → **Create API Key**
3. Copy the API key (starts with `re_`)

#### 2. Add to Netlify Environment Variables

Studio site (studio.lemonpost.studio):
1. Site settings → Environment variables
2. Add `RESEND_API_KEY` = `re_...`
3. Add `NOTIFICATION_EMAIL` = `your-email@example.com`
4. Redeploy

#### 3. Verify Domain

Resend requires you to verify the sending domain:
1. Go to Resend Dashboard → **Domains**
2. Add domain: `lemonpost.studio`
3. Follow DNS verification steps
4. Once verified, emails will send from: `Instagram Studio <noreply@lemonpost.studio>`

**If domain not verified:**
- Emails will still send from: `Instagram Studio <onboarding@resend.dev>`
- Verify domain when possible for professional appearance

---

## 🔍 Monitoring in Production

### Netlify Function Logs

View logs for the scheduled function:

1. Netlify Dashboard → **studio.lemonpost.studio**
2. **Logs** tab → **Functions** → Filter: `instagram-scheduled-publish-background`
3. View real-time execution logs

**What to look for:**
- ✅ No errors in log output
- ✅ "Status updates saved successfully"
- ✅ "Notification email sent successfully"
- ❌ "Failed to save" → Smart merge or Cloudinary issue
- ❌ "Failed to send notification" → Resend API issue

### Scheduled Runs

The function runs automatically:
- **Schedule:** `0 * * * *` (every hour, at minute 0)
- **Times:** 00:00, 01:00, 02:00, ..., 23:00 UTC
- **Window:** Any pending post from today that's past its scheduled time

**Example schedule:**
```
Post scheduled for 11:00 AM
↓
12:00 PM run: Publishes it ✅
↓
1:00 PM run: Sees it's already published, skips it ✅
```

---

## 🧪 Test Checklist

Use this checklist to verify everything is working:

### Environment
- [ ] All required environment variables set on Netlify
- [ ] `NOTIFICATION_EMAIL` configured
- [ ] `RESEND_API_KEY` configured
- [ ] Domain verified on Resend (or using onboarding domain)
- [ ] Instagram access token is valid and not expired

### Local Development
- [ ] Dev server starts without errors
- [ ] `instagram-scheduled-publish-background` loaded successfully
- [ ] Can trigger function manually via curl/localhost

### Logging
- [ ] Schedule data fetches from Cloudinary
- [ ] Time window calculation shows correct times
- [ ] Schedule analysis counts posts correctly
- [ ] Due posts are identified correctly

### Publishing
- [ ] Single image posts publish successfully
- [ ] Carousel posts publish successfully
- [ ] Status updates save to Cloudinary
- [ ] Posts show as "published" in schedule after publish

### Email Notifications
- [ ] Email received after successful publish
- [ ] Email subject line is correct
- [ ] Email body shows correct post count
- [ ] Email includes post titles and media IDs
- [ ] Email footer has link to Instagram Studio

### Dry Run Mode
- [ ] Set `INSTAGRAM_DRY_RUN=true` on Netlify
- [ ] Posts show "dryRun: true" in function response
- [ ] Posts are NOT actually published to Instagram
- [ ] Logs show "🧪 DRY_RUN: skipping publish"

### Error Handling
- [ ] If save fails, email shows warning
- [ ] Function returns 200 even if save fails (published but data not saved)
- [ ] If rate limited, function retries and logs attempts
- [ ] Errors are descriptive and actionable

---

## 🔧 Troubleshooting

### Problem: "No posts due for publishing"

**Cause:** No posts are scheduled in the current window

**Check:**
1. Instagram Studio → Calendar view
2. Verify posts exist and have "pending" status
3. Check scheduled time is in the past

### Problem: Emails not being sent

**Causes:**
- `NOTIFICATION_EMAIL` not set
- `RESEND_API_KEY` not set
- Resend domain not verified (emails go to spam)
- Resend API key invalid/revoked

**Check:**
```bash
# Verify variables are set
Netlify Dashboard → Site settings → Environment variables
# Look for RESEND_API_KEY and NOTIFICATION_EMAIL
```

### Problem: "Failed to save to Cloudinary"

**Causes:**
- `CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` incorrect
- Cloudinary signature mismatch
- Network issue

**Check logs for:**
```
❌ Cloudinary upload details: { status: 401, statusText: "Unauthorized" }
```

**Solution:**
1. Verify Cloudinary API credentials on Netlify
2. Check they match your Cloudinary account
3. Regenerate API key if needed

### Problem: "Permission denied" on Instagram API

**Causes:**
- Access token expired
- Access token doesn't have required permissions
- Account ID incorrect

**Check:**
1. Instagram Studio Settings → Check connection status
2. If expired, click "Connect Instagram" to get new token
3. Verify Account ID in Netlify matches actual Instagram business account

### Problem: Function doesn't run on schedule

**Check:**
1. Netlify Dashboard → Functions logs
2. Should see executions at :00 of each hour
3. If not running, check Netlify account status (not expired, still active)

**Manual test:**
```bash
curl -X POST https://studio.lemonpost.studio/.netlify/functions/instagram-scheduled-publish-background
```

If this works but schedule doesn't, it's a Netlify scheduler issue. Contact Netlify support.

---

## 📈 Success Metrics

A successful scheduled publish run should show:

✅ **In Netlify Function Logs:**
- Clean execution from start to finish
- No 4xx or 5xx errors
- "Status updates saved successfully"
- "Notification email sent successfully"

✅ **In Instagram Studio:**
- Post status changes from "pending" to "published"
- Published date/time is set
- Instagram media ID is recorded

✅ **In Your Email:**
- Email received within 1 minute of publish
- Shows post title and media ID
- Has link back to Instagram Studio

✅ **On Instagram:**
- Post appears on account timeline
- Caption and images are correct
- Hashtags appear in caption

---

## 🎯 Next Steps

1. **Schedule a test post:**
   - Go to Instagram Studio → Calendar
   - Drag a project to tomorrow at 2:00 PM
   - Check "published" status tomorrow at 2:00 PM UTC

2. **Monitor the logs:**
   - Netlify Dashboard → Functions → Logs
   - Watch for execution at next hourly mark

3. **Set up email notifications:**
   - Add `RESEND_API_KEY` to Netlify env vars
   - Add `NOTIFICATION_EMAIL` to Netlify env vars
   - Verify Resend domain for branded emails

4. **Document your setup:**
   - Keep track of all API keys and IDs
   - Document any custom settings (DRY_RUN mode, etc.)
   - Share access details with team members who need to manage posts

---

**Last Updated:** December 18, 2025  
**Tested On:** instagram-scheduled-publish-background.mjs (refactored version)  
**Related Docs:**
- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Code consolidation details
- [INSTAGRAM_STUDIO.md](../../../docs/features/INSTAGRAM_STUDIO.md) - Full feature documentation
