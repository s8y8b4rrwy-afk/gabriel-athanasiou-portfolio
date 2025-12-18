# ⚡ Instagram Studio Scheduled Publishing - Quick Start

> Get your scheduled posts publishing in 5 minutes!

---

## 🎯 The Essentials

### What It Does
- Runs **every hour at :00 UTC**
- Publishes any posts scheduled for that time
- Sends **email notification** when done
- Saves **status updates** to track published posts

### What's Required
All variables are already set on Netlify ✅
```
CLOUDINARY_API_KEY ✅
CLOUDINARY_API_SECRET ✅
INSTAGRAM_ACCESS_TOKEN ✅
NOTIFICATION_EMAIL ✅
RESEND_API_KEY ✅
```

---

## 📝 How to Schedule a Post

### Step 1: Open Instagram Studio
```
https://studio.lemonpost.studio
```

### Step 2: Go to Calendar
Click the **Calendar** tab at the top

### Step 3: Drag a Project
1. Find an existing project in the sidebar
2. Click and drag it to the calendar
3. Drop it on a date/time (e.g., tomorrow at 2:00 PM)

### Step 4: Check Status
- Status should show: **"pending"**
- Time shows when it will be published
- It will publish at that time automatically ✅

---

## ⏰ When Posts Publish

**The function runs at these times (UTC):**
```
00:00, 01:00, 02:00, 03:00, ..., 23:00
(every hour on the hour)
```

**Your post publishes when:**
- Scheduled time is in the PAST
- Current time is TODAY (midnight to now)

**Example:**
```
Today: December 18, 2025, 2:30 PM UTC

Your post scheduled for:  2:00 PM → ✅ Publishes THIS hour
Your post scheduled for:  3:00 PM → ✅ Publishes NEXT hour
Your post scheduled for:  3:30 PM → ✅ Publishes NEXT hour
Your post scheduled for:  12:00 AM → ❌ Tomorrow (not today)
```

---

## 📧 Email Notifications

You'll receive an email after **each hourly run**.

### Email Content:
- **✅ When:** Posts published successfully
- **❌ When:** Posts failed to publish
- **⚠️ When:** Some published, some failed
- **ℹ️ When:** No posts were due

### Example Email:
```
From: Instagram Studio <noreply@lemonpost.studio>
Subject: ✅ Instagram: 2 post(s) published

📊 Report
✅ Successfully Published (2)
  • The Project Name - ID: 17924596859123456
  • Another Project - ID: 17924596859123457

🔗 Instagram Studio: https://studio.lemonpost.studio
```

---

## 🧪 Test It Out

### Option 1: Test Immediately (Easiest)
1. Schedule a post for **right now** (e.g., 2:25 PM if it's 2:24 PM)
2. Scroll to the top of the calendar
3. Look at the bottom: "Next run: [timestamp]"
4. Wait until that time passes
5. Check your email! ✅

### Option 2: Test with Dry Run (Safest)
1. Netlify Dashboard → studio.lemonpost.studio
2. Environment variables
3. Set `INSTAGRAM_DRY_RUN = true`
4. Posts won't actually publish, but you'll see it works
5. Change back to `false` for production

---

## 📱 Monitor the Function

### See What Happened
1. Go to **Netlify Dashboard**
2. Select **studio.lemonpost.studio**
3. Click **Logs** tab
4. Filter: **instagram-scheduled-publish-background**
5. You'll see all execution logs with timestamps ✅

### Example Logs:
```
✅ Published: The Project Name
💾 Status updates saved successfully
📧 Notification email sent successfully
```

---

## ❓ Troubleshooting

### "Post didn't publish"
- Check logs in Netlify (see step above)
- Make sure post is scheduled for a **PAST time TODAY**
- Verify Instagram token isn't expired (auto-renews in Studio)

### "Email didn't arrive"
- Check spam folder
- Verify email address in environment variables
- Check: **NOTIFICATION_EMAIL** and **RESEND_API_KEY** are set

### "Function doesn't run"
- Check Netlify logs for errors
- Function should run automatically every hour
- Can manually trigger: `POST /.netlify/functions/instagram-scheduled-publish-background`

---

## 🚀 Advanced Options

### Dry Run Mode (Safe Testing)
```
Set: INSTAGRAM_DRY_RUN = true
Posts won't publish, but system tests fine
Perfect for testing setup before going live
```

### Always Notify
```
Set: ALWAYS_NOTIFY = true
Sends email even if no posts (good for monitoring)
```

### Different Time Windows
```
Default: TODAY (midnight UTC to now)
Alternative: HOUR (last 60 minutes)
```

---

## 📚 Full Documentation

For complete details, see:
- **[SCHEDULED_PUBLISH_VERIFICATION.md](./docs/SCHEDULED_PUBLISH_VERIFICATION.md)** - Detailed guide & troubleshooting
- **[SCHEDULED_PUBLISH_STATUS.md](./SCHEDULED_PUBLISH_STATUS.md)** - Technical details & monitoring
- **[test-scheduled-publish.mjs](./test-scheduled-publish.mjs)** - Environment check script

---

## ✅ Checklist

Before going live:
- [ ] All environment variables set on Netlify
- [ ] NOTIFICATION_EMAIL is your email address
- [ ] Tested with one post
- [ ] Received email notification
- [ ] Post appeared on Instagram
- [ ] Status changed to "published" in Studio

---

## 🎯 Quick Commands

```bash
# Check environment variables
node scripts/instagram-studio/test-scheduled-publish.mjs

# Start dev server (test locally)
npm run dev

# Trigger function manually
curl -X POST http://localhost:8888/.netlify/functions/instagram-scheduled-publish-background
```

---

## 💡 Pro Tips

1. **Schedule in batches:** Drag multiple posts at once
2. **Use calendar view:** See all scheduled posts at a glance
3. **Monitor on off-peak hours:** Fewer competing requests
4. **Set INSTAGRAM_DRY_RUN=true initially:** Test before going live
5. **Check logs after each publish:** Verify success

---

**Status:** ✅ Ready to use!  
**Last Updated:** December 18, 2025  
**Questions?** See the full docs in the link above
