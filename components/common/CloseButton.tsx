
import React from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '../../theme';

interface CloseButtonProps {
    onClick: () => void;
}

export const CloseButton: React.FC<CloseButtonProps> = ({ onClick }) => {
    return createPortal(
        <button 
            onClick={onClick} 
            className={`${THEME.ui.closeButton.position} z-[100] text-white group outline-none`}
            aria-label="Close"
        >
            <div className="flex items-center gap-4">
                <span className={`hidden md:block ${THEME.typography.meta} opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all ${THEME.animation.medium} ${THEME.animation.ease} mix-blend-difference`}>
                    Close
                </span>
                <div className={`${THEME.ui.closeButton.size} rounded-full border border-white/40 backdrop-blur-[2px] flex items-center justify-center group-hover:bg-white group-hover:border-transparent group-hover:scale-110 transition-all ${THEME.animation.medium} ${THEME.animation.ease}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={`group-hover:text-black transition-colors ${THEME.animation.medium} ${THEME.animation.ease}`}>
                        <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                </div>
            </div>
        </button>,
        document.body
    );
};
