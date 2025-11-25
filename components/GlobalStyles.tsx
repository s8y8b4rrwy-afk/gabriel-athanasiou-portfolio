
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
    `;
    document.head.appendChild(style);

    return () => {
        document.head.removeChild(style);
    }

  }, []);

  return null;
};
