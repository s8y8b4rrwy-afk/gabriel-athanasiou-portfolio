#!/usr/bin/env node
/**
 * Pre-build script to copy portfolio-specific static files to standard names
 * Run before vite build: copies sitemap-{mode}.xml → sitemap.xml, etc.
 * 
 * Usage: PORTFOLIO_MODE=postproduction node scripts/prepare-build.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORTFOLIO_MODE = process.env.PORTFOLIO_MODE || 'directing';
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const FILES_TO_COPY = [
  { from: `portfolio-data-${PORTFOLIO_MODE}.json`, to: 'portfolio-data.json' },
  { from: `sitemap-${PORTFOLIO_MODE}.xml`, to: 'sitemap.xml' },
  { from: `share-meta-${PORTFOLIO_MODE}.json`, to: 'share-meta.json' },
  { from: `share-meta-${PORTFOLIO_MODE}.hash`, to: 'share-meta.hash' },
  { from: `robots-${PORTFOLIO_MODE}.txt`, to: 'robots.txt' },
];

function copyFile(from, to) {
  const srcPath = path.join(PUBLIC_DIR, from);
  const destPath = path.join(PUBLIC_DIR, to);
  
  if (!fs.existsSync(srcPath)) {
    console.warn(`[prepare-build] ⚠️  Source not found: ${from}`);
    return false;
  }
  
  fs.copyFileSync(srcPath, destPath);
  console.log(`[prepare-build] ✅ Copied: ${from} → ${to}`);
  return true;
}

function main() {
  console.log(`[prepare-build] 🔄 Preparing build for portfolio mode: ${PORTFOLIO_MODE}...`);
  console.log(`[prepare-build]    Public directory: ${PUBLIC_DIR}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const { from, to } of FILES_TO_COPY) {
    if (copyFile(from, to)) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`[prepare-build] ✅ Complete: ${successCount} files copied, ${failCount} skipped`);
  
  // Read the copied portfolio data to show info
  try {
    const dataPath = path.join(PUBLIC_DIR, 'portfolio-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      console.log(`[prepare-build]    - Portfolio: ${data.config.portfolioId}`);
      console.log(`[prepare-build]    - Domain: ${data.config.domain}`);
      console.log(`[prepare-build]    - Projects: ${data.projects.length}`);
      console.log(`[prepare-build]    - Journal: ${data.config.hasJournal ? 'enabled' : 'disabled'}`);
    }
  } catch (e) {
    // Ignore
  }
}

main();
