
import React, { useEffect } from 'react';
import { THEME } from '../theme';

/**
 * Applies the settings from theme.ts as CSS Custom Properties (Variables).
 * This allows Tailwind in index.html to read these values dynamically.
 */
export const GlobalStyles: React.FC = () => {
  useEffect(() => {
    const root = document.documentElement;

    // Apply Colors
    root.style.setProperty('--color-bg-main', THEME.colors.background);
    root.style.setProperty('--color-text-main', THEME.colors.textMain);
    root.style.setProperty('--color-text-muted', THEME.colors.textMuted);

    // Apply Fonts
    root.style.setProperty('--font-sans', THEME.fonts.sans);
    root.style.setProperty('--font-serif', THEME.fonts.serif);
    
    // Apply Selection Color
    root.style.setProperty('--color-selection', THEME.colors.selectionBg);

    // Inject dynamic selection style
    const style = document.createElement('style');
    style.innerHTML = `
      ::selection {
        background: ${THEME.colors.selectionBg};
        color: ${THEME.colors.textMain};
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
    `;
    document.head.appendChild(style);

    return () => {
        document.head.removeChild(style);
    }

  }, []);

  return null;
};
