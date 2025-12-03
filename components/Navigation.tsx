
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { THEME } from '../theme';
import { clearScrollPosition } from '../utils/scrollRestoration';
import { HomeConfig } from '../types';

interface NavigationProps {
  showLinks?: boolean;
  config?: HomeConfig;
}

// Pages that have hero sections at the top
const PAGES_WITH_HERO = ['/', '/work/', '/journal/'];

export const Navigation: React.FC<NavigationProps> = ({ showLinks = true, config }) => {
  const location = useLocation();
  const [showGradient, setShowGradient] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  
  // Check if current page has a hero section
  const hasHero = location.pathname === '/' || 
                  location.pathname.startsWith('/work/') || 
                  location.pathname.startsWith('/journal/');

  // Check scroll position to show/hide fades
  const checkScrollPosition = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    
    const threshold = 5; // Small threshold to account for rounding
    setCanScrollLeft(el.scrollLeft > threshold);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - threshold);
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    
    checkScrollPosition();
    el.addEventListener('scroll', checkScrollPosition, { passive: true });
    window.addEventListener('resize', checkScrollPosition, { passive: true });
    
    return () => {
      el.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [checkScrollPosition]);
  
  useEffect(() => {
    // Reset gradient state on route change
    setShowGradient(!hasHero);
    
    if (!hasHero) return; // Always show gradient on non-hero pages
    
    const handleScroll = () => {
      // Show gradient after scrolling past ~60% of viewport height (past hero)
      const scrollThreshold = window.innerHeight * 0.6;
      setShowGradient(window.scrollY > scrollThreshold);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname, hasHero]);
  
  const getBtnClass = (isActive: boolean) => {
    return `${THEME.typography.nav} cursor-pointer ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'} transition-opacity duration-500`;
  };

  const handleNavClick = (path: string) => {
    // Clear saved scroll position for this page when navigating via menu
    clearScrollPosition(path);
    // Scroll to top immediately
    window.scrollTo(0, 0);
  };

  // Build dynamic mask based on scroll position
  const getMaskStyle = () => {
    if (!canScrollLeft && !canScrollRight) {
      return {}; // No mask needed
    }
    
    let maskImage = 'linear-gradient(to right, ';
    if (canScrollLeft) {
      maskImage += 'transparent, black 24px, ';
    } else {
      maskImage += 'black, black, ';
    }
    if (canScrollRight) {
      maskImage += 'black calc(100% - 24px), transparent)';
    } else {
      maskImage += 'black, black)';
    }
    
    return {
      maskImage,
      WebkitMaskImage: maskImage
    };
  };

  // Get dynamic values from config with fallbacks
  const navTitle = config?.navTitle || config?.portfolioOwnerName || 'Gabriel Athanasiou';
  const workSectionLabel = config?.workSectionLabel || 'Filmography';
  const hasJournal = config?.hasJournal !== false; // Default to true if not specified

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 flex flex-col items-center md:flex-row ${THEME.header.gap} text-white pointer-events-auto select-none ${THEME.header.paddingY} ${THEME.header.paddingX} transition-all duration-500 ease-out ${showGradient ? 'nav-scrolled' : ''}`}>
        {/* Gradient overlay with transition */}
        <div 
          className={`absolute inset-0 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ease-out pointer-events-none ${showGradient ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        />
        <Link 
            to="/"
            onClick={() => handleNavClick('/')}
            className={`${THEME.header.logoText} opacity-100 hover:opacity-70 transition-opacity duration-500 mb-6 md:mb-0 text-center relative z-10`}
        >
            {navTitle}
        </Link>
        
        {showLinks && (
            <div 
                ref={navScrollRef}
                className="flex gap-6 md:gap-8 overflow-x-auto max-w-full scrollbar-hide relative z-10" 
                style={{ 
                    WebkitOverflowScrolling: 'touch', 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none',
                    ...getMaskStyle()
                }}
            >
                <NavLink to="/" onClick={() => handleNavClick('/')} className={({ isActive }) => `${getBtnClass(isActive)} whitespace-nowrap`}>
                    Featured
                </NavLink>
                <NavLink to="/work" onClick={() => handleNavClick('/work')} className={({ isActive }) => `${getBtnClass(isActive)} whitespace-nowrap`}>
                    {workSectionLabel}
                </NavLink>
                {hasJournal && (
                    <NavLink to="/journal" onClick={() => handleNavClick('/journal')} className={({ isActive }) => `${getBtnClass(isActive)} whitespace-nowrap`}>
                        Journal
                    </NavLink>
                )}
                <NavLink to="/about" onClick={() => handleNavClick('/about')} className={({ isActive }) => `${getBtnClass(isActive)} whitespace-nowrap`}>
                    About
                </NavLink>
                {config?.portfolioId !== 'postproduction' && (
                    <NavLink to="/game" onClick={() => handleNavClick('/game')} className={({ isActive }) => `${getBtnClass(isActive)} whitespace-nowrap`}>
                        Game
                    </NavLink>
                )}
            </div>
        )}
    </nav>
  );
};