# 🚀 Deploy Your React Portfolio to directedbygabriel.com

You currently have Squarespace connected to `directedbygabriel.com`. Here's how to replace it with your new React site.

---

## 🎯 Overview

**Current situation:**
- Domain: `directedbygabriel.com` (connected to Squarespace)
- New site: React portfolio (ready to deploy)

**Goal:**
- Deploy React site to `directedbygabriel.com`
- Remove Squarespace

**Timeline:**
- Setup: 5-10 minutes
- DNS changes: 5-30 minutes to take effect (sometimes instant)

---

## Step 1: Choose Where to Host (Pick One)

You have 2 main options:

### **Option A: Netlify** (Recommended - Easiest)
- ✅ Free tier (perfect for portfolio)
- ✅ Automatic deploys from GitHub
- ✅ Custom domain setup in 2 minutes
- ✅ HTTPS built-in
- ✅ No server management
- **Best for beginners**

### **Option B: Vercel** (Also Easy)
- ✅ Free tier
- ✅ Similar to Netlify
- ✅ Slightly faster performance
- Good if you know GitHub already

### **Option C: Traditional Hosting** (More Complex)
- Requires manual setup
- Not recommended for beginners
- Skip this option

**Recommendation: Use Netlify (Option A)** - It's the easiest.

---

## 🚀 Deploy to Netlify (Step-by-Step)

### Step 1.1: Create Netlify Account
1. Go to: **https://netlify.com**
2. Click **"Sign up"**
3. Choose **"GitHub"** (or email if you prefer)
4. Connect your GitHub account
5. Authorize Netlify

### Step 1.2: Push Your Code to GitHub

First, make sure your code is on GitHub:

```bash
# In your project folder:
git init
git add .
git commit -m "Initial commit - React portfolio"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/gabriel-athanasiou-portfolio.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

**Don't have GitHub?** Go to **https://github.com/signup** first (free), then come back.

### Step 1.3: Deploy from GitHub to Netlify

1. In Netlify dashboard, click **"New site from Git"**
2. Click **"GitHub"**
3. Search for your repository: `gabriel-athanasiou-portfolio`
4. Click it to select
5. **Build settings** (usually auto-filled):
   - **Base directory**: Leave blank
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **"Deploy site"**

**Wait 2-5 minutes** while Netlify builds and deploys.

When done, you'll get a URL like: `https://random-name-12345.netlify.app`

✅ Your site is now live at that URL!

### Step 1.4: Connect Your Domain

Now connect `directedbygabriel.com` to your Netlify site:

**In Netlify Dashboard:**
1. Click your site
2. Go to **Site settings** → **Domain management**
3. Click **"Add domain"**
4. Type: `directedbygabriel.com`
5. Click **"Verify"**
6. Netlify will ask: **"Do you want to update DNS records?"**
7. Click **"Yes, add domain"**

Netlify will show you DNS instructions. **There are 2 approaches:**

#### Option A: Let Netlify Manage DNS (Easiest)
1. Netlify will show: **"Change your nameservers to:"**
   - `dns1.p01.nsone.net`
   - `dns2.p01.nsone.net`
   - `dns3.p01.nsone.net`
   - `dns4.p01.nsone.net`

2. Go to your domain registrar (wherever you bought `directedbygabriel.com`)
3. Find **"Nameservers"** or **"DNS"** settings
4. Replace existing nameservers with Netlify's 4 nameservers
5. Save changes

**Wait 5-30 minutes** (sometimes instant) for DNS to propagate.

**Then check**: Visit `https://directedbygabriel.com` - your new site should appear! ✅

#### Option B: Keep Existing Registrar (More Complex)
If you want to keep your current registrar managing DNS:

1. Netlify shows you CNAME/A records to add
2. Go to your registrar's DNS settings
3. Add those records
4. Save

(More advanced - ask if you need help)

---

## ⚠️ Step 2: Disconnect Squarespace (Important!)

**Before DNS takes full effect**, you should disconnect Squarespace:

1. Go to your Squarespace account
2. Go to **Settings** → **Domains**
3. Find `directedbygabriel.com`
4. Click it
5. Click **"Disconnect"** or **"Remove"**
6. Confirm

This prevents conflicts and ensures your React site takes over completely.

---

## ✅ What to Expect

### Immediately After Setup
1. Netlify site live at `random-name.netlify.app` ✅
2. DNS changes start propagating

### After DNS Propagates (5-30 minutes)
1. `directedbygabriel.com` points to your Netlify site ✅
2. Squarespace site becomes unreachable
3. Your React portfolio is live! 🎉

### Verify It Worked
- Visit: **https://directedbygabriel.com**
- Should see your React portfolio
- Check all pages work (Home, Work, Journal, About)
- Test on mobile
- Check DevTools Console for `✅ Analytics initialized`

---

## 🔄 Update Your Site (After Deploy)

After deploying, when you make changes:

```bash
# Make your changes
git add .
git commit -m "Update: new project added"
git push
```

**Netlify automatically redeploys!** (Usually takes 1-2 minutes)

No more manual uploading - just push to GitHub and it's live.

---

## 🆘 Troubleshooting

### "directedbygabriel.com is blank or still shows Squarespace"
- **Wait longer** – DNS can take up to 30 minutes
- **Clear cache** – Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- **Check DNS** – Go to https://mxtoolbox.com, type your domain, check nameservers changed

### "Error 404 on some pages"
- Usually means Netlify redirect is missing
- See "Fix Routing" section below

### "analytics not working on live site"
- Analytics only tracks real-time (not localhost)
- Open DevTools Console, should see `✅ Analytics initialized`
- Check at https://analytics.google.com in Real-time section

---

## 🔧 Fix Routing (if pages show 404)

React Router needs a redirect rule in Netlify:

1. In your project, create file: `public/_redirects`
2. Add this content:
```
/* /index.html 200
```
3. Save and push to GitHub
4. Netlify redeploys automatically

This tells Netlify: "When user visits any page, load index.html and let React Router handle it"

---

## 📋 Complete Checklist

- [ ] Chose Netlify
- [ ] Created Netlify account
- [ ] Pushed code to GitHub
- [ ] Connected GitHub repo to Netlify
- [ ] Site deployed to `random-name.netlify.app` ✅
- [ ] Added domain `directedbygabriel.com` in Netlify
- [ ] Updated nameservers at registrar
- [ ] Waited 5-30 minutes for DNS
- [ ] Verified: `directedbygabriel.com` shows React site ✅
- [ ] Disconnected Squarespace
- [ ] Tested all pages work
- [ ] Checked analytics in console ✅

---

## 🎯 Next Steps (After Live)

1. **Monitor analytics** – Check https://analytics.google.com in 24-48h
2. **Submit to Google Search Console** – Let Google index your site
3. **Update social profiles** – Point to `directedbygabriel.com`
4. **Add content** – Your Airtable CMS auto-updates on new projects

---

## 📞 Questions?

**"Will I lose my domain?"**
- No, domain is yours forever (you paid for it)
- Just changing where it points

**"Will my content be saved?"**
- Yes, all in Airtable (not lost when leaving Squarespace)

**"Can I go back to Squarespace?"**
- Yes, just change nameservers back
- React site won't be affected

**"How much does this cost?"**
- Netlify free tier: $0/month
- Domain: Whatever you're already paying
- Analytics: $0/month
- **Total: $0 new costs**

**"What if I want a custom email?"**
- Netlify doesn't provide email
- Keep your current email setup at registrar
- Works fine alongside new site

---

## ✨ You're Ready!

Your React portfolio is built and ready. Just need to:
1. Push to GitHub
2. Connect to Netlify
3. Point domain there

**Start with Step 1.1 above.** It's actually quite simple!

If you get stuck, let me know which step and I can help. The hardest part is done (building the site). Deployment is straightforward.

🚀 You've got this!
