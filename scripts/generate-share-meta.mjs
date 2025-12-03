#!/usr/bin/env node
/**
 * Build-time manifest generator for share metadata.
 * Portfolio-aware: reads from portfolio-data-{mode}.json
 * Generates share-meta-{mode}.json with minimal fields for social sharing.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORTFOLIO_MODE = process.env.PORTFOLIO_MODE || 'directing';
const OUTPUT_DIR = path.resolve(__dirname, '../public');

/**
 * Load portfolio data from the pre-generated JSON file
 */
function loadPortfolioData() {
  const dataPath = path.join(OUTPUT_DIR, `portfolio-data-${PORTFOLIO_MODE}.json`);
  
  if (!fs.existsSync(dataPath)) {
    console.error(`[share-meta] ❌ Portfolio data not found: ${dataPath}`);
    console.error(`[share-meta] ℹ️  Run 'PORTFOLIO_MODE=${PORTFOLIO_MODE} npm run build:data' first`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`[share-meta] ❌ Failed to parse portfolio data: ${e.message}`);
    return null;
  }
}

/**
 * Build share metadata for projects
 */
function buildProjects(projects, defaultOgImage) {
  return projects.map(project => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    description: (project.description || '').slice(0, 220),
    image: project.heroImage || project.gallery?.[0] || defaultOgImage || '',
    type: project.type,
    year: project.year
  }));
}

/**
 * Build share metadata for journal articles
 */
function buildPosts(articles) {
  if (!articles || articles.length === 0) return [];
  
  return articles.map(article => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    description: (article.excerpt || article.content || '').slice(0, 220),
    image: article.coverImage || '',
    type: 'article',
    date: article.date
  }));
}

async function main() {
  try {
    console.log(`[share-meta] 🔄 Generating share metadata for portfolio mode: ${PORTFOLIO_MODE}...`);
    
    const portfolioData = loadPortfolioData();
    
    if (!portfolioData) {
      console.error('[share-meta] ❌ Cannot generate share metadata without portfolio data');
      process.exit(1);
    }
    
    const { config, projects, articles } = portfolioData;
    const defaultOgImage = config.defaultOgImage || '';
    
    const projectMeta = buildProjects(projects, defaultOgImage);
    const postMeta = config.hasJournal ? buildPosts(articles) : [];
    
    const manifest = {
      generatedAt: new Date().toISOString(),
      portfolioId: config.portfolioId,
      domain: config.domain,
      projects: projectMeta,
      posts: postMeta,
      config: {
        defaultOgImage,
        siteTitle: config.siteTitle,
        seoTitle: config.seoTitle,
        seoDescription: config.seoDescription
      }
    };
    
    const json = JSON.stringify(manifest, null, 2);
    const outputJson = path.join(OUTPUT_DIR, `share-meta-${PORTFOLIO_MODE}.json`);
    const outputHash = path.join(OUTPUT_DIR, `share-meta-${PORTFOLIO_MODE}.hash`);
    
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    fs.writeFileSync(outputJson, json, 'utf8');
    
    // Hash for deployment trigger detection
    const hash = createHash('sha256')
      .update(JSON.stringify(manifest.projects) + JSON.stringify(manifest.posts))
      .digest('hex');
    fs.writeFileSync(outputHash, hash, 'utf8');
    
    console.log(`[share-meta] ✅ Generated: ${outputJson}`);
    console.log(`[share-meta]    - Domain: ${config.domain}`);
    console.log(`[share-meta]    - Projects: ${projectMeta.length}`);
    console.log(`[share-meta]    - Posts: ${postMeta.length}`);
    console.log(`[share-meta]    - Hash: ${hash.substring(0, 16)}...`);
  } catch (e) {
    console.error('[share-meta] ❌ Generation failed:', e.message);
    process.exit(1);
  }
}

main();
