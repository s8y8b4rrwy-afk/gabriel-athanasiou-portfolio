
import React, { useEffect, useRef, useState } from 'react';
import { THEME } from '../theme';

interface CursorProps {
  activeImageUrl: string | null;
}

export const Cursor: React.FC<CursorProps> = ({ activeImageUrl }) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [displayImage, setDisplayImage] = useState<string | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only enable custom cursor if device supports hover (desktop)
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (mediaQuery.matches) {
        setIsEnabled(true);
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (mediaQuery.matches) {
        mousePos.current = { x: e.clientX, y: e.clientY };
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${e.clientX + 20}px, ${e.clientY + 20}px)`;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  // Handle fade in/out with proper unmounting delay
  useEffect(() => {
    if (activeImageUrl) {
      // Clear any pending fade-out timeout
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      // Update display image immediately
      setDisplayImage(activeImageUrl);
      // Render and then show
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      // Start fade out (keep the last image visible during fade)
      setIsVisible(false);
      // Wait for fade animation to complete before unmounting
      fadeTimeoutRef.current = setTimeout(() => {
        setShouldRender(false);
        setDisplayImage(null);
      }, 300); // Match the duration-300 CSS transition
    }
  }, [activeImageUrl]);

  if (!isEnabled || !shouldRender) return null;

  return (
    <div 
      ref={cursorRef}
      className={`hidden md:block fixed top-0 left-0 pointer-events-none z-[150] ${THEME.ui.cursor.size} aspect-video ${THEME.ui.cursor.radius} overflow-hidden shadow-2xl transition-opacity ${THEME.ui.cursor.fadeOutDuration} ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        willChange: 'transform, opacity'
      }}
    >
      <div className={`w-full h-full transition-transform ${THEME.ui.cursor.fadeOutDuration} ease-out ${isVisible ? 'scale-100' : 'scale-95'}`}>
        {displayImage && (
          <img 
            src={displayImage} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        )}
      </div>
    </div>
  );
};
