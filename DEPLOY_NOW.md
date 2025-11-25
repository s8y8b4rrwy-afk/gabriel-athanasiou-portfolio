# 🚀 Quick Deploy - Exact Steps for Beginners

Your React portfolio is ready. Here's exactly what to do, step-by-step.

---

## ✅ What's Ready

- ✅ React portfolio built
- ✅ Analytics configured with `G-EJ62G0X6Q5`
- ✅ All code in your computer
- ✅ Netlify routing configured (`public/_redirects` created)

**What's needed:**
- [ ] GitHub account (free)
- [ ] Push code to GitHub
- [ ] Connect to Netlify (free)
- [ ] Point your domain there

---

## 📝 PART 1: GitHub (5 minutes)

### 1.1 Create GitHub Account
If you don't have one:
1. Go to: **https://github.com/signup**
2. Enter email, password, username
3. Verify email
4. Done!

### 1.2 Push Your Code to GitHub

Open Terminal and run these commands:

```bash
# Navigate to your project folder
cd "/Users/gabrielathanasiou/Library/Mobile Documents/com~apple~CloudDocs/Documents/Work/Website React/gabriel-athanasiou-portfolio--TEST"

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - React portfolio"

# Create main branch
git branch -M main

# Add GitHub remote (REPLACE your-username with YOUR actual username)
git remote add origin https://github.com/your-username/gabriel-athanasiou-portfolio.git

# Push to GitHub
git push -u origin main
```

**Copy-paste is fine!** Just replace `your-username` with your actual GitHub username.

**When done**, your code is on GitHub. ✅

---

## 🌐 PART 2: Netlify (5 minutes)

### 2.1 Create Netlify Account
1. Go to: **https://netlify.com**
2. Click **"Sign up"**
3. Click **"GitHub"**
4. Authorize Netlify to access GitHub
5. Done!

### 2.2 Deploy from GitHub
1. Click **"New site from Git"** (big button)
2. Click **"GitHub"**
3. Search for your repo: **`gabriel-athanasiou-portfolio`**
4. Click it
5. Build settings appear:
   - **Base directory**: Leave blank
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **"Deploy site"**

**Wait 2-5 minutes** while it builds...

When done, you'll get a URL like:
```
https://gallant-archimedes-a1b2c3.netlify.app
```

**Visit this URL** - your site should be there! ✅

### 2.3 Add Your Domain
1. Click your site in Netlify
2. Go to **Site settings** → **Domain management**
3. Click **"Add domain"**
4. Type: **`directedbygabriel.com`**
5. Press Enter
6. Click **"Verify"**
7. Click **"Yes, add domain"**

Netlify shows you 4 nameservers. **Copy them.**

---

## 🌍 PART 3: Update Your Domain (5 minutes)

### 3.1 Find Your Domain Registrar

Where did you buy `directedbygabriel.com`? Check your email for receipts. Common places:
- GoDaddy
- Namecheap
- Google Domains
- Bluehost
- Other

### 3.2 Change Nameservers

1. Log into your registrar's website
2. Find **"Domains"** or **"My Domains"**
3. Click `directedbygabriel.com`
4. Find **"Nameservers"** or **"DNS"** option
5. Change to these 4 (from Netlify):
   - `dns1.p01.nsone.net`
   - `dns2.p01.nsone.net`
   - `dns3.p01.nsone.net`
   - `dns4.p01.nsone.net`
6. **Save/Update**

**Wait 5-30 minutes** (sometimes instant)

---

## ✅ PART 4: Verify It Works

### 4.1 Test Your Domain
1. Open browser
2. Go to: **https://directedbygabriel.com**
3. **You should see your React portfolio!** 🎉

### 4.2 Test All Pages
- Click "Work" → see projects ✅
- Click a project → see details ✅
- Click "Journal" → see blog posts ✅
- Click "About" → see about page ✅
- Test share buttons ✅

### 4.3 Check Analytics
1. Open DevTools (F12)
2. Go to **Console**
3. Look for: `✅ Analytics initialized with ID: G-EJ62G0X6Q5`
4. Analytics is working ✅

---

## 🛑 PART 5: Cleanup (Important!)

### 5.1 Disconnect Squarespace

1. Log into Squarespace
2. Go to **Settings** → **Domains**
3. Find `directedbygabriel.com`
4. Click it
5. Click **"Disconnect"** or **"Remove"**
6. Confirm

This prevents conflicts. **Do this AFTER DNS changes take effect** (after Part 4 works).

---

## 🎉 You're Done!

Your React portfolio is now live at **directedbygabriel.com**! 

**What happens next:**
- Visitors see your new site (not Squarespace)
- Analytics tracks visitors automatically
- New projects/posts update from Airtable automatically
- GitHub pushes trigger automatic redeploys

---

## 🔄 Update Your Site (Going Forward)

Want to add a new project or make changes?

1. Update in Airtable (projects/blog auto-update)
2. Or edit code locally
3. Push to GitHub:
   ```bash
   git add .
   git commit -m "Update: your message"
   git push
   ```
4. Netlify redeploys automatically (1-2 minutes)

No more Squarespace editing needed!

---

## 🆘 If Something Goes Wrong

### "directedbygabriel.com doesn't show my site"
- **Wait longer** – DNS takes up to 30 minutes
- **Clear browser cache** – Cmd+Shift+R or Ctrl+Shift+R
- **Check nameservers** – Go to https://mxtoolbox.com, enter your domain, verify nameservers changed

### "404 on some pages"
- This is already fixed (see: `public/_redirects`)
- Just make sure it's deployed to Netlify

### "Still see Squarespace"
- Make sure you disconnected Squarespace (Part 5)
- Clear all browser caches
- Try incognito/private window

---

## 📋 Checklist

Copy this and check off as you go:

- [ ] Created GitHub account
- [ ] Pushed code to GitHub (PART 1)
- [ ] Created Netlify account
- [ ] Deployed to Netlify (PART 2)
- [ ] Added domain in Netlify
- [ ] Changed nameservers at registrar (PART 3)
- [ ] Waited 5-30 minutes
- [ ] Tested domain `directedbygabriel.com` (PART 4)
- [ ] All pages work
- [ ] Analytics shows in console
- [ ] Disconnected Squarespace (PART 5)

---

## 📞 Need Help?

**With GitHub:**
- Make sure you use YOUR actual username
- Use `git push` to upload

**With Netlify:**
- Build should complete in 2-5 minutes
- Shows logs if there's an error

**With DNS:**
- Changes take 5-30 minutes (sometimes instant)
- Use mxtoolbox.com to check status

---

## ✨ Timeline

- **Right now**: Follow steps above (15-20 minutes total)
- **In 5-30 minutes**: DNS takes effect, site goes live
- **After 24-48 hours**: Analytics data starts appearing
- **Going forward**: Push to GitHub → auto-redeploy

You're nearly there! Follow the steps above and you'll be live. 🚀
