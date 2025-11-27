
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { THEME } from '../theme';
import { clearScrollPosition } from '../utils/scrollRestoration';

interface NavigationProps {
  showLinks?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ showLinks = true }) => {
  
  const getBtnClass = (isActive: boolean) => {
    return `${THEME.typography.nav} cursor-pointer ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'} transition-opacity ${THEME.animation.fast}`;
  };

  const handleNavClick = (path: string) => {
    // Clear saved scroll position for this page when navigating via menu
    clearScrollPosition(path);
    // Scroll to top immediately
    window.scrollTo(0, 0);
  };

  return (
    <nav className={`fixed top-0 left-0 w-full z-50 flex flex-col items-center md:flex-row ${THEME.header.gap} text-white transition-all ${THEME.animation.fast} pointer-events-auto select-none ${THEME.header.paddingY} ${THEME.header.paddingX} ${THEME.header.background}`}>
        <Link 
            to="/"
            onClick={() => handleNavClick('/')}
            className={`${THEME.header.logoText} hover:opacity-70 transition mb-6 md:mb-0 text-center`}
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