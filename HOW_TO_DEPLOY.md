# ✅ HOW TO DEPLOY AFTER UPDATING AIRTABLE

## Quick Steps (Takes 30 seconds)

1. **Update your content in Airtable** ✏️
   - Add/edit projects, blog posts, etc.
   - Save changes

2. **Go to GitHub** 🌐
   - Open: https://github.com/s8y8b4rrwy-afk/gabriel-athanasiou-portfolio
   - Click the **Actions** tab at the top

3. **Click the deploy workflow** 🎯
   - In the left sidebar, click: **Manual Deploy to Netlify**

4. **Run it** ▶️
   - Click the **Run workflow** button (on the right, green button)
   - Click **Run workflow** again in the dropdown
   - ✅ Done!

5. **Wait 2-3 minutes** ⏱️
   - Netlify will rebuild your site
   - Check your site: https://directedbygabriel.com

---

## ⚠️ FIRST TIME SETUP (One-time only)

If this is your first time, you need to connect GitHub to Netlify:

### Get Your Netlify Build Hook
1. Go to: https://app.netlify.com
2. Click your site
3. Go to: **Site settings → Build & deploy → Build hooks**
4. Click: **Add build hook**
5. Name it: `GitHub Deploy`
6. Click: **Save**
7. **Copy the full URL** that appears (looks like: `https://api.netlify.com/build_hooks/abc123...`)

### Add It to GitHub
1. Go to: https://github.com/s8y8b4rrwy-afk/gabriel-athanasiou-portfolio
2. Click: **Settings** (top menu)
3. Click: **Secrets and variables → Actions** (left sidebar)
4. Click: **New repository secret**
5. Name: `NETLIFY_BUILD_HOOK`
6. Value: Paste **ONLY the ID part** after `build_hooks/`
   - Example: If your URL is `https://api.netlify.com/build_hooks/abc123xyz`
   - Just enter: `abc123xyz`
7. Click: **Add secret**

✅ **Setup complete!** Now use the quick steps above anytime you update Airtable.

---

## 🔍 Troubleshooting

### "I clicked Run workflow but nothing happened"
- Check that you added the `NETLIFY_BUILD_HOOK` secret (see setup above)
- Go to the workflow run and check the logs for errors

### "The workflow ran but my site didn't update"
- Wait 3-5 minutes (builds can take time)
- Check your Netlify dashboard: https://app.netlify.com
- Look for a new build in progress

### "I see an error in the workflow"
- Most likely the build hook secret is missing or incorrect
- Double-check you copied just the ID part (not the full URL)

---

## 📋 Quick Reference

**Your GitHub Actions page:**  
https://github.com/s8y8b4rrwy-afk/gabriel-athanasiou-portfolio/actions

**Your Netlify dashboard:**  
https://app.netlify.com

**Your live site:**  
https://directedbygabriel.com

---

**That's it!** Bookmark this page for easy reference. 🚀
