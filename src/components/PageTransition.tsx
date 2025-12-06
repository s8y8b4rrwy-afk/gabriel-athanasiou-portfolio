import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition Component
 * 
 * Wraps page content (excluding Navigation) to create beautiful staggered
 * fade-in animations when navigating between pages.
 * 
 * Features:
 * - Smooth opacity transitions
 * - Staggered animations for child elements
 * - Automatic reset on route change (works with browser back/forward buttons)
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Reset animation state on any route change (including back/forward navigation)
    setIsVisible(false);
    
    // Trigger animation immediately - no delay needed
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [location.pathname, location.key]); // location.key changes on every navigation including back/forward

  return (
    <div 
      key={location.key} // Force re-mount on navigation to ensure animations work
      className={`page-transition-wrapper ${isVisible ? 'page-visible' : 'page-hidden'}`}
    >
      {children}
    </div>
  );
};
