
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '../../theme';

interface CloseButtonProps {
    onClick: () => void;
    isLightTheme?: boolean;
}

export const CloseButton: React.FC<CloseButtonProps> = ({ onClick, isLightTheme = false }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    
    useEffect(() => {
        const handleScroll = () => {
            // Show dark styling after scrolling past ~60% of viewport height (past hero)
            const scrollThreshold = window.innerHeight * 0.6;
            setIsScrolled(window.scrollY > scrollThreshold);
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Check initial position
        
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    // Determine colors based on theme and scroll state
    const isDark = isLightTheme && isScrolled;
    const textColor = isDark ? 'text-black' : 'text-white';
    const borderColor = isDark ? 'border-black/30' : 'border-white/40';
    const hoverBg = isDark ? 'group-hover:bg-black' : 'group-hover:bg-white';
    const hoverText = isDark ? 'group-hover:text-white' : 'group-hover:text-black';
    // Add drop shadow to X when it's white (on hero) for better visibility
    const iconShadow = !isDark && isLightTheme ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]' : '';
    // Class to identify close button state for CSS
    const stateClass = isDark ? 'close-btn-dark' : 'close-btn-light';
    
    return createPortal(
        <div className={`fixed top-24 left-0 w-full z-[100] ${THEME.header.paddingX} pointer-events-none`}>
            <div className={`${THEME.projectDetail.contentMaxWidth} mx-auto flex justify-end`}>
                <button 
                    onClick={onClick} 
                    className={`${textColor} ${stateClass} group outline-none pointer-events-auto transition-colors duration-500`}
                    aria-label="Close"
                >
                    <div className="flex items-center gap-4">
                        <span className={`hidden md:block ${THEME.typography.meta} opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${THEME.animation.medium} ${THEME.animation.ease} ${isDark ? '' : 'mix-blend-difference'}`}>
                            Close
                        </span>
                        <div className={`${THEME.ui.closeButton.size} rounded-full border ${borderColor} backdrop-blur-[2px] flex items-center justify-center ${hoverBg} group-hover:border-transparent group-hover:scale-110 transition-all ${THEME.animation.medium} ${THEME.animation.ease}`}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${hoverText} ${iconShadow} transition-all ${THEME.animation.medium} ${THEME.animation.ease}`}>
                                <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="1.2"/>
                            </svg>
                        </div>
                    </div>
                </button>
            </div>
        </div>,
        document.body
    );
};
