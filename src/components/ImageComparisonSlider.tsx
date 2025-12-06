/**
 * ImageComparisonSlider
 * 
 * Before/after comparison with draggable slider
 */

import React, { useState, useRef, useEffect } from 'react';

interface ImageComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  onClose: () => void;
}

export const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Original',
  afterLabel = 'Compressed',
  onClose
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleStart = () => {
    setIsDragging(true);
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(300, prev + 25));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(100, prev - 25));
  };

  const handleZoomReset = () => {
    setZoom(100);
    setPanOffset({ x: 0, y: 0 });
  };

  const handlePanStart = (clientX: number, clientY: number) => {
    if (zoom > 100) {
      setIsPanning(true);
      setPanStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
    }
  };

  const handlePanMove = (clientX: number, clientY: number) => {
    if (isPanning && zoom > 100) {
      setPanOffset({
        x: clientX - panStart.x,
        y: clientY - panStart.y
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    if (isPanning) {
      const handleMouseMove = (e: MouseEvent) => handlePanMove(e.clientX, e.clientY);
      const handleMouseUp = () => handlePanEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, panStart]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative max-w-6xl w-full aspect-video bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Close comparison"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Zoom controls */}
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 100}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <div className="px-3 h-10 rounded-full bg-white/10 flex items-center text-white text-sm font-medium">
            {zoom}%
          </div>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 300}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {zoom > 100 && (
            <button
              onClick={handleZoomReset}
              className="px-3 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center text-white text-sm transition-colors"
              aria-label="Reset zoom"
            >
              Reset
            </button>
          )}
        </div>

        {/* Comparison container */}
        <div 
          ref={containerRef}
          className="relative w-full h-full overflow-hidden cursor-ew-resize"
          onMouseDown={(e) => {
            if (e.button === 0 && !e.shiftKey) {
              handleStart();
            } else if (e.button === 0 && e.shiftKey) {
              handlePanStart(e.clientX, e.clientY);
            }
          }}
          onTouchStart={handleStart}
          style={{ 
            cursor: zoom > 100 ? (isPanning ? 'grabbing' : 'grab') : 'ew-resize' 
          }}
        >
          {/* Before image (full) */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ overflow: 'hidden' }}
          >
            <img 
              src={beforeImage} 
              alt={beforeLabel}
              className="max-w-none"
              style={{
                transform: `scale(${zoom / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
                transition: isDragging || isPanning ? 'none' : 'transform 0.2s ease-out'
              }}
              draggable={false}
            />
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm font-medium">
              {beforeLabel}
            </div>
          </div>

          {/* After image (clipped) */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ 
              clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              overflow: 'hidden'
            }}
          >
            <img 
              src={afterImage} 
              alt={afterLabel}
              className="max-w-none"
              style={{
                transform: `scale(${zoom / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
                transition: isDragging || isPanning ? 'none' : 'transform 0.2s ease-out'
              }}
              draggable={false}
            />
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm font-medium">
              {afterLabel}
            </div>
          </div>

          {/* Slider line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
            style={{ left: `${sliderPosition}%` }}
          >
            {/* Slider handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded text-sm text-center">
          <div>Drag slider to compare{zoom > 100 && ' • Hold Shift + drag to pan'}</div>
          <div className="text-xs text-white/60 mt-1">Press ESC to close • Zoom up to 300%</div>
        </div>
      </div>
    </div>
  );
};
