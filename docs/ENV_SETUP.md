# Environment Variables Setup

Your portfolio now uses environment variables for sensitive configuration. This keeps API keys and credentials out of your code.

## Step 1: Create `.env.local` File

In the root of your project (same directory as `package.json`), create a file named `.env.local`:

```bash
# .env.local (never commit this file)

# Google Analytics 4 Measurement ID
# Get this from: https://analytics.google.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Airtable API Key and Base ID
# Get these from: https://airtable.com/api
VITE_AIRTABLE_API_KEY=key1234567890abcdef
VITE_AIRTABLE_BASE_ID=appLKDqYcLzFsfafU
```

## Step 2: Update App.tsx

Find this line in `App.tsx`:
```typescript
analyticsService.init('G-XXXXXXXXXX');
```

Replace it with:
```typescript
analyticsService.init(import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX');
```

This reads from your `.env.local` file automatically.

## Step 3: `.gitignore` Already Protects Secrets

Your `.gitignore` should already include:
```
.env.local
.env.*.local
```

This prevents `.env.local` from being accidentally committed to GitHub.

## Step 4: Add to Netlify Environment Variables

When deploying to Netlify, you need to add these same variables to your site's environment:

1. Go to **Netlify Dashboard**
2. Select your site
3. Go to **Settings** > **Environment variables**
4. Click **Add an environment variable**
5. Add:
   - **Key**: `VITE_GA_MEASUREMENT_ID`
   - **Value**: `G-XXXXXXXXXX` (your actual ID)
6. Click **Add variable**
7. Repeat for `VITE_AIRTABLE_API_KEY` and `VITE_AIRTABLE_BASE_ID`

Netlify will use these values during the build process.

## Getting Your Measurement ID

1. Go to **https://analytics.google.com**
2. Click your property name
3. Go to **Admin** (bottom left)
4. Click **Data Streams**
5. Click your web stream
6. Copy the **Measurement ID** (looks like `G-XXXXXXXXXX`)

## Security Best Practices

- ✅ Never commit `.env.local` to git
- ✅ Use different IDs for development and production if needed
- ✅ Treat API keys like passwords
- ✅ Rotate keys if you suspect they've been exposed
- ✅ Don't share your `.env.local` file with anyone

## Testing Locally

After setting up `.env.local`:

```bash
npm run dev
```

The app will read from your `.env.local` file automatically.
