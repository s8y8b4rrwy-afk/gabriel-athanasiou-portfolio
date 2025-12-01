
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { THEME } from '../theme';
import { clearScrollPosition } from '../utils/scrollRestoration';

interface NavigationProps {
  showLinks?: boolean;
}

// Pages that have hero sections at the top
const PAGES_WITH_HERO = ['/', '/work/', '/journal/'];

export const Navigation: React.FC<NavigationProps> = ({ showLinks = true }) => {
  const location = useLocation();
  const [showGradient, setShowGradient] = useState(false);
  
  // Check if current page has a hero section
  const hasHero = location.pathname === '/' || 
                  location.pathname.startsWith('/work/') || 
                  location.pathname.startsWith('/journal/');
  
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

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 flex flex-col items-center md:flex-row ${THEME.header.gap} text-white pointer-events-auto select-none ${THEME.header.paddingY} ${THEME.header.paddingX} ${showGradient ? 'bg-gradient-to-b from-black/80 to-transparent' : 'bg-transparent'}`}>
        <Link 
            to="/"
            onClick={() => handleNavClick('/')}
            className={`${THEME.header.logoText} opacity-100 hover:opacity-70 transition-opacity duration-500 mb-6 md:mb-0 text-center`}
        >
            Gabriel Athanasiou
        </Link>
        
        {showLinks && (
            <div className="flex gap-8">
                <NavLink to="/" onClick={() => handleNavClick('/')} className={({ isActive }) => getBtnClass(isActive)}>
                    Featured
                </NavLink>
                <NavLink to="/work" onClick={() => handleNavClick('/work')} className={({ isActive }) => getBtnClass(isActive)}>
                    Filmography
                </NavLink>
                <NavLink to="/journal" onClick={() => handleNavClick('/journal')} className={({ isActive }) => getBtnClass(isActive)}>
                    Journal
                </NavLink>
                <NavLink to="/about" onClick={() => handleNavClick('/about')} className={({ isActive }) => getBtnClass(isActive)}>
                    About
                </NavLink>
            </div>
        )}
    </nav>
  );
};