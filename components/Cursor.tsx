
import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '../theme';

interface CursorProps {
  activeImageUrl: string | null;
}

export const Cursor: React.FC<CursorProps> = ({ activeImageUrl }) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Only enable custom cursor if device supports hover (desktop)
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (mediaQuery.matches) {
        setIsEnabled(true);
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current && mediaQuery.matches) {
        cursorRef.current.style.left = `${e.clientX + 20}px`;
        cursorRef.current.style.top = `${e.clientY + 20}px`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!activeImageUrl || !isEnabled) return null;

  return (
    <div 
      ref={cursorRef}
      className={`hidden md:block fixed pointer-events-none z-[150] ${THEME.ui.cursor.size} aspect-video ${THEME.ui.cursor.radius} overflow-hidden`}
      style={{
        transition: `transform 0.3s ${THEME.animation.ease}, opacity 0.3s ease`,
        transform: activeImageUrl ? 'scale(1)' : 'scale(0.8)',
        opacity: activeImageUrl ? 1 : 0
      }}
    >
      <img 
        src={activeImageUrl} 
        alt="Preview" 
        className="w-full h-full object-cover"
      />
    </div>
  );
};
