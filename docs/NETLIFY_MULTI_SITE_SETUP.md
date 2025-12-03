# Netlify Multi-Portfolio Setup Guide

> **Date**: December 2025  
> **Purpose**: Deploy two portfolio sites from one codebase with custom domains from Namecheap

## Overview

This guide walks you through setting up **two separate Netlify sites** from the same GitHub repository, each with its own custom domain:

| Portfolio | Domain | Netlify Site Name |
|-----------|--------|-------------------|
| Directing | `directedbygabriel.com` | `directing-portfolio` (or your choice) |
| Post-Production | `lemonpost.studio` | `postprod-portfolio` (or your choice) |

---

## Step 1: Create Two Netlify Sites

### 1.1 Create the Directing Portfolio Site

1. Go to [Netlify](https://app.netlify.com) and log in
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **GitHub** and authorize if needed
4. Find and select your repository: `gabriel-athanasiou-portfolio`
5. Configure the build settings:
   - **Branch to deploy**: `main` (or your production branch)
   - **Build command**: Leave as default (uses `netlify.toml`)
   - **Publish directory**: `dist`
6. Click **"Show advanced"** and add environment variables:
   
   | Key | Value |
   |-----|-------|
   | `PORTFOLIO_MODE` | `directing` |
   | `AIRTABLE_API_KEY` | `your_airtable_api_key` |
   | `AIRTABLE_BASE_ID` | `your_airtable_base_id` |
   | `CLOUDINARY_CLOUD_NAME` | `your_cloudinary_cloud_name` |
   | `CLOUDINARY_API_KEY` | `your_cloudinary_api_key` |
   | `CLOUDINARY_API_SECRET` | `your_cloudinary_api_secret` |

7. Click **"Deploy site"**
8. After deploy, go to **Site settings** → **General** → **Site details** → **Change site name**
9. Change to something memorable like `directing-portfolio` or `directedbygabriel`

### 1.2 Create the Post-Production Portfolio Site

1. Go back to Netlify dashboard
2. Click **"Add new site"** → **"Import an existing project"**
3. Select the **same repository**: `gabriel-athanasiou-portfolio`
4. Configure the build settings:
   - **Branch to deploy**: `main` (same branch)
   - **Build command**: Leave as default (uses `netlify.toml`)
   - **Publish directory**: `dist`
5. Click **"Show advanced"** and add environment variables:
   
   | Key | Value |
   |-----|-------|
   | `PORTFOLIO_MODE` | `postproduction` |
   | `AIRTABLE_API_KEY` | `your_airtable_api_key` |
   | `AIRTABLE_BASE_ID` | `your_airtable_base_id` |
   | `CLOUDINARY_CLOUD_NAME` | `your_cloudinary_cloud_name` |
   | `CLOUDINARY_API_KEY` | `your_cloudinary_api_key` |
   | `CLOUDINARY_API_SECRET` | `your_cloudinary_api_secret` |

6. Click **"Deploy site"**
7. Change site name to `postprod-portfolio` or `lemonpost`

---

## Step 2: Configure Custom Domains on Netlify

### 2.1 Add Domain to Directing Site

1. Go to your **directing site** on Netlify
2. Navigate to **Domain management** (or Site settings → Domain management)
3. Click **"Add custom domain"**
4. Enter: `directedbygabriel.com`
5. Click **"Verify"** → **"Add domain"**
6. Netlify will show you the DNS configuration needed
7. **Note the Netlify DNS settings** (you'll need them for Namecheap):
   - Usually a CNAME pointing to `your-site-name.netlify.app`
   - Or Netlify's nameservers if using Netlify DNS

8. Also add `www.directedbygabriel.com` as an alias

### 2.2 Add Domain to Post-Production Site

1. Go to your **post-production site** on Netlify
2. Navigate to **Domain management**
3. Click **"Add custom domain"**
4. Enter: `lemonpost.studio` (or `lemonpost.com`)
5. Click **"Verify"** → **"Add domain"**
6. Note the DNS configuration needed
7. Also add `www.lemonpost.studio` as an alias

---

## Step 3: Configure DNS at Namecheap

You have two options for DNS configuration:

### Option A: Use Netlify DNS (Recommended)

This is the easiest option and provides automatic SSL and faster propagation.

#### For directedbygabriel.com:

1. Go to [Namecheap](https://www.namecheap.com) and log in
2. Go to **Domain List** → click **"Manage"** next to `directedbygabriel.com`
3. Under the **Nameservers** section:
   - Select **"Custom DNS"**
   - Add Netlify's nameservers (get these from Netlify → Domain settings):
     ```
     dns1.p01.nsone.net
     dns2.p01.nsone.net
     dns3.p01.nsone.net
     dns4.p01.nsone.net
     ```
4. Click the green checkmark to save

#### For lemonpost.studio:

1. In Namecheap, go to **Domain List** → **"Manage"** next to `lemonpost.studio`
2. Under **Nameservers**:
   - Select **"Custom DNS"**
   - Add the same Netlify nameservers:
     ```
     dns1.p01.nsone.net
     dns2.p01.nsone.net
     dns3.p01.nsone.net
     dns4.p01.nsone.net
     ```
3. Save

### Option B: Use Namecheap DNS with CNAME Records

If you prefer to keep DNS at Namecheap:

#### For directedbygabriel.com:

1. In Namecheap → Domain List → Manage → **Advanced DNS**
2. Delete any existing A/AAAA records for `@` (root domain)
3. Add these records:

   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | A | @ | 75.2.60.5 | Automatic |
   | CNAME | www | `your-directing-site.netlify.app` | Automatic |

   **Note**: The A record IP is Netlify's load balancer. Get the exact netlify.app URL from your site's Domain settings.

4. If you need to use ALIAS (not available on Namecheap basic), you can use:
   - A record: 75.2.60.5 (Netlify's load balancer)
   - Or consider switching to Netlify DNS

#### For lemonpost.studio:

1. Same process in Namecheap for the second domain
2. Add records:

   | Type | Host | Value | TTL |
   |------|------|-------|-----|
   | A | @ | 75.2.60.5 | Automatic |
   | CNAME | www | `your-postprod-site.netlify.app` | Automatic |

---

## Step 4: Enable HTTPS

Once DNS propagates (can take up to 48 hours, usually faster):

1. Go to each Netlify site → **Domain management** → **HTTPS**
2. Click **"Verify DNS configuration"**
3. Once verified, click **"Provision certificate"**
4. Netlify will automatically provision and renew Let's Encrypt SSL certificates

---

## Step 5: Configure Build Hooks (Optional but Recommended)

Set up webhooks so both sites rebuild when you push changes:

### Automatic Deploys
By default, both sites will rebuild automatically when you push to the configured branch. This is already set up!

### Manual Rebuild via Webhook
If you need to trigger rebuilds programmatically (e.g., after Airtable changes):

1. For each site, go to **Site settings** → **Build & deploy** → **Build hooks**
2. Click **"Add build hook"**
3. Name it something like `airtable-update`
4. Copy the webhook URL
5. You can use these in Airtable automations or a custom script

---

## Step 6: Verify Everything Works

### Checklist:

- [ ] **Directing site** deploys successfully
- [ ] **Post-production site** deploys successfully
- [ ] `directedbygabriel.com` loads the directing portfolio
- [ ] `lemonpost.studio` loads the post-production portfolio
- [ ] Both sites have HTTPS (green padlock)
- [ ] `www` subdomain redirects to apex domain (or vice versa)
- [ ] Journal only appears on directing site
- [ ] Role filter only appears on post-production site

### Test URLs:
```
https://directedbygabriel.com
https://directedbygabriel.com/work
https://directedbygabriel.com/about
https://directedbygabriel.com/journal

https://lemonpost.studio
https://lemonpost.studio/work
https://lemonpost.studio/about
```

---

## Troubleshooting

### "Site not found" or DNS errors
- DNS propagation can take up to 48 hours
- Check DNS with: `dig directedbygabriel.com` or use [dnschecker.org](https://dnschecker.org)
- Verify nameservers are correctly set in Namecheap

### Build failures
- Check build logs in Netlify
- Ensure all environment variables are set
- Verify `PORTFOLIO_MODE` matches expected values

### Wrong content showing
- Clear browser cache
- Verify the build command is correct (`build:directing` vs `build:postprod`)
- Check that `PORTFOLIO_MODE` environment variable is set correctly

### SSL certificate not provisioning
- DNS must be fully propagated first
- Try clicking "Verify" again in Netlify
- Check that CAA records aren't blocking Let's Encrypt

---

## Environment Variables Reference

Both sites need these environment variables (set in Netlify dashboard):

| Variable | Description | Example |
|----------|-------------|---------|
| `PORTFOLIO_MODE` | Which portfolio to build | `directing` or `postproduction` |
| `AIRTABLE_API_KEY` | Airtable Personal Access Token | `patXXXXXXXXXXXXXX` |
| `AIRTABLE_BASE_ID` | Airtable Base ID | `appXXXXXXXXXXXXXX` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `your-cloud` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abcdefghijklmnop` |

> **Note**: The build script automatically sets `VITE_PORTFOLIO_MODE` based on `PORTFOLIO_MODE`

---

## Quick Reference: Netlify Site Configuration

### Directing Portfolio
```
Site Name: directing-portfolio (or your choice)
Branch: main
Build Command: (uses netlify.toml → scripts/netlify-build.sh)
Publish Directory: dist
Environment:
  PORTFOLIO_MODE=directing
  (+ Airtable & Cloudinary keys)
Domain: directedbygabriel.com
```

### Post-Production Portfolio
```
Site Name: postprod-portfolio (or your choice)
Branch: main
Build Command: (uses netlify.toml → scripts/netlify-build.sh)
Publish Directory: dist
Environment:
  PORTFOLIO_MODE=postproduction
  (+ Airtable & Cloudinary keys)
Domain: lemonpost.studio
```

---

## Next Steps After Setup

1. ✅ Both sites are live with custom domains
2. ✅ SSL certificates are active
3. 📝 Update Airtable Settings with the final domain URLs
4. 📝 Re-run sync to update sitemaps and robots.txt:
   ```bash
   npm run sync:both
   npm run build:static:all
   ```
5. 📝 Test social sharing (Open Graph meta tags)
6. 📝 Submit sitemaps to Google Search Console

---

## Need Help?

- [Netlify Docs: Custom Domains](https://docs.netlify.com/domains-https/custom-domains/)
- [Namecheap: How to Connect Domain to Netlify](https://www.namecheap.com/support/knowledgebase/article.aspx/9782/2255/how-to-connect-a-domain-to-netlify/)
- [Netlify Docs: Multi-site from One Repo](https://docs.netlify.com/configure-builds/manage-dependencies/#monorepos)
