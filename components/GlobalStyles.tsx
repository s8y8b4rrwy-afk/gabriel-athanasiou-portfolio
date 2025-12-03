
import React, { useEffect } from 'react';
import { THEME } from '../theme';
import { HomeConfig } from '../types';

interface GlobalStylesProps {
  config?: HomeConfig;
}

/**
 * Applies the settings from theme.ts as CSS Custom Properties (Variables).
 * This allows Tailwind in index.html to read these values dynamically.
 * Also handles dynamic font loading based on portfolio config.
 */
export const GlobalStyles: React.FC<GlobalStylesProps> = ({ config }) => {
  // Load custom fonts based on portfolio type
  useEffect(() => {
    const isPostProduction = config?.portfolioId === 'postproduction';
    
    if (isPostProduction) {
      // Premium font pairing for Lemon Post Studio:
      // Outfit - Modern, geometric, refined sans-serif for headings
      // DM Sans - Clean, geometric sans-serif for body text
      const fontsToLoad = [
        { name: 'Outfit', weights: '300;400;500;600;700' },
        { name: 'DM Sans', weights: '300;400;500;600;700' }
      ];
      
      fontsToLoad.forEach(font => {
        const fontQuery = font.name.replace(/ /g, '+');
        const existingLink = document.querySelector(`link[href*="${fontQuery}"]`);
        if (!existingLink) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = `https://fonts.googleapis.com/css2?family=${fontQuery}:wght@${font.weights}&display=swap`;
          document.head.appendChild(link);
        }
      });
      
      // Apply the premium post-production fonts (both sans-serif for modern tech feel)
      document.documentElement.style.setProperty('--font-sans', '"DM Sans", system-ui, sans-serif');
      document.documentElement.style.setProperty('--font-serif', '"Outfit", system-ui, sans-serif');
      document.documentElement.style.setProperty('--font-portfolio', '"DM Sans"');
    } else {
      // Custom font from config for other portfolios
      const customFont = config?.fontFamily;
      if (customFont && customFont !== 'Inter') {
        const existingLink = document.querySelector(`link[href*="${customFont.replace(' ', '+')}"]`);
        if (!existingLink) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = `https://fonts.googleapis.com/css2?family=${customFont.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`;
          document.head.appendChild(link);
        }
        
        document.documentElement.style.setProperty('--font-sans', `"${customFont}", system-ui, sans-serif`);
        document.documentElement.style.setProperty('--font-portfolio', `"${customFont}"`);
      }
    }
  }, [config?.fontFamily, config?.portfolioId]);

  // Apply theme mode (light/dark) - postproduction uses light theme
  useEffect(() => {
    const root = document.documentElement;
    const isLight = config?.portfolioId === 'postproduction';
    
    if (isLight) {
      // Light theme colors
      root.style.setProperty('--color-bg-main', '#ffffff');
      root.style.setProperty('--color-text-main', '#1a1a1a');
      root.style.setProperty('--color-text-muted', '#666666');
      root.style.setProperty('--color-selection', 'rgba(0, 0, 0, 0.15)');
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      // Dark theme colors (default - directing)
      root.style.setProperty('--color-bg-main', THEME.colors.background);
      root.style.setProperty('--color-text-main', THEME.colors.textMain);
      root.style.setProperty('--color-text-muted', THEME.colors.textMuted);
      root.style.setProperty('--color-selection', THEME.colors.selectionBg);
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }
  }, [config?.portfolioId]);

  useEffect(() => {
    const root = document.documentElement;
    const isPostProduction = config?.portfolioId === 'postproduction';

    // Apply Fonts - use custom fonts for post-production, theme defaults for others
    if (!isPostProduction) {
      root.style.setProperty('--font-sans', THEME.fonts.sans);
      root.style.setProperty('--font-serif', THEME.fonts.serif);
    }
    // Note: Post-production fonts are set in the earlier useEffect

    // Inject dynamic selection style
    const isLight = config?.portfolioId === 'postproduction';
    const style = document.createElement('style');
    style.id = 'theme-styles';
    
    // Remove previous theme styles if they exist
    const existingStyle = document.getElementById('theme-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    style.innerHTML = `
      ::selection {
        background: ${isLight ? 'rgba(0, 0, 0, 0.15)' : THEME.colors.selectionBg};
        color: ${isLight ? '#1a1a1a' : THEME.colors.textMain};
      }
      
      /* Light theme overrides */
      .light-theme {
        --tw-bg-opacity: 1;
        background-color: #ffffff !important;
        color: #1a1a1a !important;
      }
      
      /* Remove italic from headings in light theme (post-production) */
      .light-theme .italic,
      .light-theme .font-serif.italic,
      .light-theme h1.italic,
      .light-theme h2.italic,
      .light-theme h3.italic {
        font-style: normal !important;
      }
      
      .light-theme .text-white {
        color: #1a1a1a !important;
      }
      
      .light-theme .text-text-muted {
        color: #888888 !important;
      }
      
      .light-theme .bg-bg-main {
        background-color: #ffffff !important;
      }
      
      /* Keep bg-black for hero image containers - don't convert to white */
      /* Only convert bg-black to white when it's used for page backgrounds, not image overlays */
      
      .light-theme .border-white\\/10,
      .light-theme .border-white\\/20,
      .light-theme .border-white\\/30 {
        border-color: rgba(0, 0, 0, 0.12) !important;
      }
      
      /* Filter separator line */
      .light-theme .filter-separator,
      .light-theme .bg-white\\/10.filter-separator {
        background-color: rgba(0, 0, 0, 0.1) !important;
      }
      
      /* Keep white borders for buttons over images */
      .light-theme button .border-white\\/40,
      .light-theme button.text-white .border-white\\/40,
      .light-theme .bg-black .border-white\\/40,
      .light-theme [class*="bg-black"] .border-white\\/40 {
        border-color: rgba(255, 255, 255, 0.4) !important;
      }
      
      /* Keep white borders for buttons inside hero sections */
      .light-theme button .rounded-full.border,
      .light-theme .bg-black button .rounded-full.border {
        border-color: rgba(255, 255, 255, 0.4) !important;
      }
      
      .light-theme .bg-white\\/5 {
        background-color: rgba(0, 0, 0, 0.04) !important;
      }
      
      .light-theme .bg-white\\/10 {
        background-color: rgba(0, 0, 0, 0.06) !important;
      }
      
      .light-theme .text-white\\/20 {
        color: rgba(0, 0, 0, 0.25) !important;
      }
      
      .light-theme .text-white\\/60,
      .light-theme .text-white\\/70,
      .light-theme .text-white\\/80 {
        color: rgba(0, 0, 0, 0.65) !important;
      }
      
      /* Bullet points in awards list */
      .light-theme .before\\:text-white\\/20::before {
        color: rgba(0, 0, 0, 0.25) !important;
      }
      
      .light-theme .opacity-60 {
        opacity: 0.5 !important;
      }
      
      .light-theme .from-bg-main {
        --tw-gradient-from: #ffffff !important;
      }
      
      .light-theme .to-transparent {
        --tw-gradient-to: transparent !important;
      }
      
      .light-theme .bg-gradient-to-t {
        background-image: linear-gradient(to top, var(--tw-gradient-from), var(--tw-gradient-to)) !important;
      }
      
      .light-theme .bg-gradient-to-l {
        background-image: linear-gradient(to left, #ffffff, transparent) !important;
      }
      
      .light-theme .hover\\:text-white:hover {
        color: #000000 !important;
      }
      
      .light-theme .hover\\:opacity-100:hover {
        opacity: 1 !important;
      }
      
      /* Navigation - transparent on hero pages, subtle on scroll */
      .light-theme nav {
        background-color: transparent !important;
        background-image: none !important;
      }
      
      /* Nav gradient overlay - change to light gradient in light theme */
      .light-theme nav > div.bg-gradient-to-b {
        background-image: linear-gradient(to bottom, rgba(255,255,255,0.9), transparent) !important;
      }
      
      /* Nav on hero (not scrolled) - keep white text */
      .light-theme nav:not(.nav-scrolled) {
        color: white !important;
      }
      
      .light-theme nav:not(.nav-scrolled) a,
      .light-theme nav:not(.nav-scrolled) .text-white {
        color: white !important;
      }
      
      /* Nav scrolled - dark text */
      .light-theme nav.nav-scrolled {
        color: #1a1a1a !important;
      }
      
      .light-theme nav.nav-scrolled a,
      .light-theme nav.nav-scrolled .text-white {
        color: #1a1a1a !important;
      }
      
      /* Smooth text color transition for nav */
      .light-theme nav a,
      .light-theme nav .text-white {
        transition: color 0.5s ease-out !important;
      }
      
      .light-theme footer {
        background-color: #f8f8f8 !important;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
      }
      
      /* View toggle pill */
      .light-theme .rounded-full.border {
        border-color: rgba(0, 0, 0, 0.15) !important;
        background-color: rgba(0, 0, 0, 0.02) !important;
      }
      
      /* Active filter underline */
      .light-theme .border-b.border-white {
        border-color: #1a1a1a !important;
      }
      
      /* Project cards - type labels */
      .light-theme .text-right.text-text-muted {
        color: #999999 !important;
      }
      
      /* Project card hover states */
      .light-theme .group:hover .text-white {
        color: #000000 !important;
      }
      
      /* Remove dark gradient overlays on images */
      .light-theme .bg-gradient-to-t.from-black,
      .light-theme .bg-gradient-to-b.from-black,
      .light-theme [class*="from-black"],
      .light-theme .from-bg-main {
        background-image: none !important;
        background: transparent !important;
      }
      
      /* Hero section - remove dark overlays */
      .light-theme .bg-black\\/10,
      .light-theme .bg-black\\/20,
      .light-theme .bg-black\\/30 {
        background-color: transparent !important;
      }
      
      /* Hero image overlay - remove for light theme */
      .light-theme .bg-black[style*="opacity"] {
        background-color: transparent !important;
      }
      
      /* Loading skeleton - light theme */
      .light-theme .bg-white\\/5,
      .light-theme .bg-white\\/\\[0\\.02\\] {
        background-color: rgba(0, 0, 0, 0.05) !important;
      }
      
      .light-theme .bg-white\\/\\[0\\.02\\] {
        background-color: rgba(0, 0, 0, 0.02) !important;
      }
      
      /* Hero text on homepage - ensure readability on light bg */
      /* Only apply to elements NOT inside buttons or image containers */
      .light-theme .mix-blend-difference:not(button):not(button *):not([class*="bg-black"] .mix-blend-difference):not(.home-hero-text):not(.home-hero-text *):not(.next-project-text):not(.next-project-text *) {
        mix-blend-mode: normal !important;
        color: #1a1a1a !important;
      }
      
      /* Home hero text - keep white over dark hero images */
      .light-theme .home-hero-text,
      .light-theme .home-hero-text * {
        color: white !important;
      }
      
      /* Next project preview text - keep white over hero images */
      .light-theme .next-project-text,
      .light-theme .next-project-text * {
        color: white !important;
      }
      
      /* Project detail hero text - keep white text with blend mode for images */
      .light-theme .bg-black .mix-blend-difference,
      .light-theme [class*="bg-black"] .mix-blend-difference {
        mix-blend-mode: difference !important;
        color: white !important;
      }
      
      /* Buttons over images - disable mix-blend-difference and use solid white */
      .light-theme button.mix-blend-difference {
        mix-blend-mode: normal !important;
      }
      
      .light-theme button.mix-blend-difference span,
      .light-theme button.mix-blend-difference span.text-white,
      .light-theme button.text-white span {
        color: white !important;
      }
      
      /* Watch Film button text - keep white on hover */
      .light-theme button.group.mix-blend-difference:hover span.text-white,
      .light-theme button.group.mix-blend-difference .text-white {
        color: white !important;
      }
      
      /* Close button - light state (on hero, white icon) */
      .light-theme button.close-btn-light,
      .light-theme button.close-btn-light svg,
      .light-theme button.close-btn-light svg path {
        color: white !important;
        stroke: white !important;
      }
      
      .light-theme button.close-btn-light .border-white\\/40 {
        border-color: rgba(255, 255, 255, 0.4) !important;
      }
      
      /* Close button - dark state (scrolled, black icon) */
      .light-theme button.close-btn-dark,
      .light-theme button.close-btn-dark svg,
      .light-theme button.close-btn-dark svg path {
        color: #1a1a1a !important;
        stroke: #1a1a1a !important;
      }
      
      .light-theme button.close-btn-dark .border-black\\/30 {
        border-color: rgba(0, 0, 0, 0.3) !important;
      }
      
      /* Close button hover states */
      .light-theme button.close-btn-light:hover .group-hover\\:bg-white {
        background-color: white !important;
      }
      
      .light-theme button.close-btn-light.group:hover svg,
      .light-theme button.close-btn-light.group:hover svg path {
        stroke: black !important;
        color: black !important;
      }
      
      .light-theme button.close-btn-dark:hover .group-hover\\:bg-black {
        background-color: black !important;
      }
      
      .light-theme button.close-btn-dark.group:hover svg,
      .light-theme button.close-btn-dark.group:hover svg path {
        stroke: white !important;
        color: white !important;
      }
      
      /* Keep white border on play button circles */
      .light-theme button .border-white\\/40,
      .light-theme .border-white\\/40 {
        border-color: rgba(255, 255, 255, 0.4) !important;
      }
      
      /* Play button icon fill */
      .light-theme .bg-black svg[fill="currentColor"],
      .light-theme [class*="bg-black"] svg[fill="currentColor"] {
        fill: white !important;
        color: white !important;
      }
      
      .light-theme .bg-black svg[fill="currentColor"] path,
      .light-theme [class*="bg-black"] svg[fill="currentColor"] path {
        fill: white !important;
      }
      
      /* Links */
      .light-theme a:hover {
        color: #000000 !important;
      }
      
      /* Scrollbar for light theme */
      .light-theme ::-webkit-scrollbar-track {
        background: #f0f0f0;
      }
      
      .light-theme ::-webkit-scrollbar-thumb {
        background: #cccccc;
      }
      
      .light-theme ::-webkit-scrollbar-thumb:hover {
        background: #aaaaaa;
      }
      
      /* About page specific overrides for light theme */
      .light-theme .bg-gray-100 {
        background-color: #f5f5f5 !important;
      }
      
      .light-theme .bg-gray-900 {
        background-color: #f5f5f5 !important;
      }

      /* Loading screen gradient - light theme override */
      .light-theme [style*="loadingShimmer"] {
        background: linear-gradient(
          90deg,
          rgba(0, 0, 0, 0.01) 0%,
          rgba(0, 0, 0, 0.03) 16.7%,
          rgba(0, 0, 0, 0.06) 33.3%,
          rgba(0, 0, 0, 0.08) 50%,
          rgba(0, 0, 0, 0.06) 66.7%,
          rgba(0, 0, 0, 0.03) 83.3%,
          rgba(0, 0, 0, 0.01) 100%
        ) !important;
        background-size: 200% 100% !important;
      }

      /* Loading screen gradient animation */
      @keyframes loadingShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      /* Procedural hero animation: subtle evolving color + gradient drift */
      @keyframes heroHue {
        0% { filter: hue-rotate(0deg) saturate(1.05) contrast(1.03); }
        50% { filter: hue-rotate(180deg) saturate(1.20) contrast(1.06); }
        100% { filter: hue-rotate(360deg) saturate(1.05) contrast(1.03); }
      }
      @keyframes gradientShift {
        0% { transform: translate3d(0,0,0) scale(1); opacity: 0.35; }
        100% { transform: translate3d(2%, -2%, 0) scale(1.02); opacity: 0.55; }
      }
      .hero-anim {
        animation: heroHue 24s linear infinite;
        will-change: filter, transform;
      }
      .hero-anim-gradient {
        position: absolute;
        inset: 0;
        pointer-events: none;
        mix-blend-mode: overlay;
        background:
          radial-gradient(120% 80% at 20% 20%, rgba(255,255,255,0.06), transparent 60%),
          radial-gradient(120% 80% at 80% 80%, rgba(255,255,255,0.05), transparent 60%);
        animation: gradientShift 18s ease-in-out infinite alternate;
      }
      
      /* Blog post link styling */
      .blog-content a {
        color: rgba(255, 255, 255, 0.9);
        text-decoration: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.3);
        padding-bottom: 2px;
        transition: all 0.3s ease;
        display: inline-block;
      }
      
      .blog-content a::after {
        content: ' →';
        color: rgba(255, 255, 255, 0.5);
        transition: color 0.3s ease;
        font-size: 0.9em;
        margin-left: 2px;
      }
      
      .blog-content a:hover {
        color: rgba(255, 255, 255, 1);
        border-bottom-color: rgba(255, 255, 255, 0.6);
      }
      
      .blog-content a:hover::after {
        color: rgba(255, 255, 255, 1);
      }
      
      /* Image loading animation */
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      .img-loading {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.03) 0%,
          rgba(255, 255, 255, 0.08) 50%,
          rgba(255, 255, 255, 0.03) 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }
      
      .img-loaded {
        animation: fadeIn 0.4s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      /* Page Transition Animations */
      .page-transition-wrapper {
        transition: opacity 2.4s ease-out;
      }
      
      .page-hidden {
        opacity: 0;
      }
      
      .page-visible {
        opacity: 1;
      }
      
      /* Staggered fade-in for child elements */
      .page-visible > * {
        animation: staggerFadeIn 3.2s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      
      .page-visible > *:nth-child(1) { animation-delay: 0.1s; }
      .page-visible > *:nth-child(2) { animation-delay: 0.2s; }
      .page-visible > *:nth-child(3) { animation-delay: 0.3s; }
      .page-visible > *:nth-child(4) { animation-delay: 0.4s; }
      .page-visible > *:nth-child(5) { animation-delay: 0.5s; }
      .page-visible > *:nth-child(6) { animation-delay: 0.6s; }
      .page-visible > *:nth-child(7) { animation-delay: 0.7s; }
      .page-visible > *:nth-child(8) { animation-delay: 0.8s; }
      
      @keyframes staggerFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      /* Enhanced hero section animations */
      .page-visible .hero-section {
        animation: heroFadeIn 4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
      }
      
      .page-visible .hero-content > * {
        animation: heroTextFadeIn 3.2s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      
      .page-visible .hero-content > *:nth-child(1) { animation-delay: 0.3s; }
      .page-visible .hero-content > *:nth-child(2) { animation-delay: 0.5s; }
      .page-visible .hero-content > *:nth-child(3) { animation-delay: 0.7s; }
      
      @keyframes heroFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      @keyframes heroTextFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      /* Grid item stagger animations */
      .page-visible .grid-item {
        animation: gridItemFadeIn 2.8s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      
      @keyframes gridItemFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      
      /* CTA Aurora Animation */
      .cta-aurora {
        background: var(--color-bg-main);
      }
      
      .cta-gradient-1 {
        background: radial-gradient(ellipse 80% 50% at 20% 40%, rgba(120, 119, 198, 0.15), transparent 60%);
        animation: aurora1 12s ease-in-out infinite;
      }
      
      .cta-gradient-2 {
        background: radial-gradient(ellipse 60% 40% at 70% 60%, rgba(255, 255, 255, 0.08), transparent 50%);
        animation: aurora2 15s ease-in-out infinite;
      }
      
      .cta-gradient-3 {
        background: radial-gradient(ellipse 90% 60% at 50% 50%, rgba(180, 180, 220, 0.06), transparent 55%);
        animation: aurora3 18s ease-in-out infinite;
      }
      
      @keyframes aurora1 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
        33% { transform: translate(5%, -3%) scale(1.1); opacity: 0.8; }
        66% { transform: translate(-3%, 5%) scale(0.95); opacity: 0.5; }
      }
      
      @keyframes aurora2 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
        50% { transform: translate(-8%, 4%) scale(1.15); opacity: 0.7; }
      }
      
      @keyframes aurora3 {
        0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.4; }
        25% { transform: translate(3%, -2%) rotate(1deg) scale(1.05); opacity: 0.6; }
        50% { transform: translate(-2%, 3%) rotate(-1deg) scale(1.1); opacity: 0.5; }
        75% { transform: translate(4%, 2%) rotate(0.5deg) scale(1.02); opacity: 0.7; }
      }
      
      .cta-button-glow {
        text-shadow: 0 0 40px rgba(255, 255, 255, 0.1);
        transition: text-shadow 0.7s ease-out;
      }
      
      .cta-button-glow:hover {
        text-shadow: 0 0 60px rgba(255, 255, 255, 0.25), 0 0 100px rgba(255, 255, 255, 0.15);
      }
      
      /* ===== GAME ANIMATIONS ===== */
      
      /* Card shuffle animation */
      @keyframes cardShuffle {
        0% { transform: rotateY(0deg) scale(1); }
        25% { transform: rotateY(90deg) scale(0.9); }
        50% { transform: rotateY(180deg) scale(0.85); }
        75% { transform: rotateY(270deg) scale(0.9); }
        100% { transform: rotateY(360deg) scale(1); }
      }
      
      .animate-card-shuffle {
        animation: cardShuffle 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        transform-style: preserve-3d;
      }
      
      /* Holographic shimmer effect */
      @keyframes holoShimmer {
        0% {
          background-position: -200% 0;
          opacity: 0;
        }
        50% {
          opacity: 0.4;
        }
        100% {
          background-position: 200% 0;
          opacity: 0;
        }
      }
      
      .animate-holo-shimmer {
        background: linear-gradient(
          105deg,
          transparent 20%,
          rgba(255, 255, 255, 0.1) 25%,
          rgba(255, 255, 255, 0.3) 30%,
          rgba(180, 200, 255, 0.3) 35%,
          rgba(255, 200, 180, 0.3) 40%,
          rgba(255, 255, 255, 0.1) 45%,
          transparent 50%
        );
        background-size: 200% 100%;
        animation: holoShimmer 1.5s ease-out forwards;
      }
      
      /* Score pop animation */
      @keyframes scorePop {
        0% { transform: scale(1); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      
      .animate-score-pop {
        animation: scorePop 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* High score glow animation */
      @keyframes highScoreGlow {
        0%, 100% { text-shadow: 0 0 10px rgba(250, 204, 21, 0.5); }
        50% { text-shadow: 0 0 25px rgba(250, 204, 21, 0.8), 0 0 40px rgba(250, 204, 21, 0.4); }
      }
      
      .animate-high-score-glow {
        animation: highScoreGlow 1.5s ease-in-out infinite;
      }
      
      /* Confetti animation */
      @keyframes confettiFall {
        0% {
          transform: translateY(-100vh) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }
      
      .confetti-container {
        overflow: hidden;
      }
      
      .confetti-piece {
        position: absolute;
        width: 10px;
        height: 10px;
        top: -20px;
        animation: confettiFall 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      }
      
      .confetti-piece:nth-child(odd) {
        border-radius: 50%;
      }
      
      .confetti-piece:nth-child(even) {
        border-radius: 2px;
        transform: rotate(45deg);
      }
    `;
    document.head.appendChild(style);

    return () => {
        document.head.removeChild(style);
    }

  }, []);

  return null;
};
