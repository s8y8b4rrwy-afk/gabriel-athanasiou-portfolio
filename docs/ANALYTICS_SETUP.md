# Google Analytics 4 Setup Guide

## What is Google Analytics?
Google Analytics (GA4) tracks:
- **Page views**: How many visitors, where they go
- **User engagement**: Time on page, scroll depth, interactions
- **Conversions**: Goals you define (contact form, video watches, etc.)
- **Traffic sources**: Where visitors come from (Google, direct, social, etc.)
- **Device info**: Mobile vs desktop, browser, OS
- **Real-time data**: See visitors right now

## Step-by-Step Setup

### 1️⃣ Create a Google Analytics Account

1. Go to: **https://analytics.google.com**
2. Click **"Start measuring"** (or sign in if you have a Google account)
3. Create new account:
   - **Account name**: "Gabriel Athanasiou" or "Portfolio"
   - **Property name**: "gabrielathanasiou.com"
   - **Reporting timezone**: Select your timezone (London or Athens)
   - **Currency**: EUR or GBP
4. Accept data sharing settings
5. Create a **Web** data stream
   - **Website URL**: `https://gabrielathanasiou.com` (or your staging URL)
   - **Stream name**: "Website"
6. ✅ **Copy the Measurement ID** - looks like: `G-XXXXXXXXXX`

This is your unique tracker ID. You'll need it in Step 2.

### 2️⃣ Add to Your Website

We'll add Google Analytics to your React app in two ways:
1. **Global script tag** (in HTML) - tracks basic page views automatically
2. **Event tracking** (in React) - tracks user interactions

### 3️⃣ Verify It's Working

Once deployed:
1. Go to https://analytics.google.com
2. Click your property
3. Go to **Real-time** > **Overview**
4. Visit your website
5. You should see yourself as an active user (might take 30 seconds)

### 4️⃣ Key Reports to Watch

**Audience**:
- How many visitors, devices, locations, browsers

**Acquisition**:
- Where visitors come from (organic search, direct, referral, social)

**Engagement**:
- Page views, session duration, bounce rate
- Custom events (video plays, social shares, etc.)

**Conversions**:
- Track goals (if you set them up)

---

## Important Notes

- **Privacy**: GA is compliant with GDPR in EU if configured properly
  - Add a privacy policy mentioning GA usage
  - Users in EU may see a cookie consent notice
- **Real-time takes 24-48 hours**: GA learns over time, don't panic if data is sparse initially
- **Anonymize IP**: We'll enable this for privacy
- **Session timeout**: Default 30 minutes of inactivity

---

## What You'll Track (Predefined Events)

GA4 automatically tracks:
- Page views
- User engagement
- Scroll events
- Click interactions

We'll add **custom events** for:
- 🎬 "video_play" - when user clicks play on a film
- 🔗 "external_link_click" - when user visits IMDb, LinkedIn, etc.
- 📱 "social_share" - when user shares on Twitter, LinkedIn, Facebook
- 📧 "contact_form" - when user submits contact
- 🖼️ "gallery_view" - when user opens project gallery

---

## Dashboard Preview

Once set up, your dashboard will show:
```
📊 Real-time users: 2 active now
👥 Total users (last 30 days): 427
📄 Total page views: 1,234
⏱️ Avg. session duration: 2m 34s
💬 Bounce rate: 38%
```

---

## After Setup (Search Console)

Once GA is deployed, connect it to Google Search Console to see:
- Search keywords people use to find you
- How you rank for different keywords
- Backlinks to your site
- Mobile usability issues

---

## Privacy Compliance

For GDPR compliance (if EU users visit):
1. Add analytics disclosure in privacy policy: "We use Google Analytics to understand traffic and improve the site"
2. Enable "Anonymize IP" in GA settings
3. Consider adding a simple cookie banner (optional, GA is not a "cookie" in the legal sense)

This is already handled by GA defaults in most cases.

---

## Next Steps in This Setup

1. Create GA account and get Measurement ID
2. Add analytics service to React
3. Initialize in App.tsx
4. Track events (video plays, social shares, etc.)
5. Test locally
6. Deploy to production
7. Verify data appears in GA dashboard
8. Submit to Google Search Console
