
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
    `;
    document.head.appendChild(style);

    return () => {
        document.head.removeChild(style);
    }

  }, []);

  return null;
};
