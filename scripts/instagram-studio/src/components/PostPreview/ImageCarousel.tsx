import React, { useState, useMemo } from 'react';
import { useCloudinaryMappingReady } from '../../hooks';
import { buildCloudinaryUrl, getOptimizedCloudinaryUrl } from '../../utils/imageUtils';
import './ImageCarousel.css';

interface ImageCarouselProps {
  images: string[];
  selectedImages: string[];
  projectId: string;
  onToggleImage: (imageUrl: string) => void;
  onReorderImages: (newOrder: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ImageCarousel({
  images,
  selectedImages,
  projectId,
  onToggleImage,
  onReorderImages,
  onSelectAll,
  onDeselectAll,
}: ImageCarouselProps) {
  const [draggedImage, setDraggedImage] = useState<string | null>(null);
  const [dragOverImage, setDragOverImage] = useState<string | null>(null);
  
  // This will trigger re-render when mapping loads
  useCloudinaryMappingReady();
  
  // Build a map of original URL -> Cloudinary URL
  const cloudinaryUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    images.forEach((url, index) => {
      if (url.includes('res.cloudinary.com')) {
        map.set(url, getOptimizedCloudinaryUrl(url));
      } else {
        map.set(url, buildCloudinaryUrl(projectId, index));
      }
    });
    return map;
  }, [images, projectId]);
  
  // Helper to get Cloudinary URL for an image
  const getCloudinaryUrl = (url: string): string => {
    return cloudinaryUrlMap.get(url) || url;
  };

  if (images.length === 0) {
    return (
      <div className="image-carousel-empty">
        <span>📷</span>
        <p>No images available</p>
      </div>
    );
  }

  // Drag and drop handlers for reordering selected images
  const handleDragStart = (e: React.DragEvent, image: string) => {
    if (!selectedImages.includes(image)) return;
    setDraggedImage(image);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', image);
  };

  const handleDragOver = (e: React.DragEvent, image: string) => {
    e.preventDefault();
    if (!selectedImages.includes(image) || !draggedImage) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverImage(image);
  };

  const handleDragLeave = () => {
    setDragOverImage(null);
  };

  const handleDrop = (e: React.DragEvent, dropImage: string) => {
    e.preventDefault();
    if (!draggedImage || draggedImage === dropImage || !selectedImages.includes(dropImage)) {
      setDraggedImage(null);
      setDragOverImage(null);
      return;
    }

    const draggedIndex = selectedImages.indexOf(draggedImage);
    const dropIndex = selectedImages.indexOf(dropImage);
    
    const newOrder = [...selectedImages];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedImage);
    
    onReorderImages(newOrder);
    setDraggedImage(null);
    setDragOverImage(null);
  };

  const handleDragEnd = () => {
    setDraggedImage(null);
    setDragOverImage(null);
  };

  return (
    <div className="image-carousel">
      {/* Unified image selection and reordering */}
      <div className="image-carousel-section">
        <h4>Select & Reorder Images (drag to reorder)</h4>
        <div className="image-carousel-grid">
          {/* Show selected images first (in order), then unselected images */}
          {[...selectedImages, ...images.filter(img => !selectedImages.includes(img))].map((image) => {
            const isImgSelected = selectedImages.includes(image);
            const selectionIndex = selectedImages.indexOf(image);
            const isDragging = draggedImage === image;
            const isDragOver = dragOverImage === image && isImgSelected;
            
            return (
              <div
                key={image}
                className={`grid-image-item ${isImgSelected ? 'grid-image-item--selected' : ''} ${
                  isDragging ? 'grid-image-item--dragging' : ''
                } ${isDragOver ? 'grid-image-item--dragover' : ''}`}
                draggable={isImgSelected}
                onDragStart={(e) => handleDragStart(e, image)}
                onDragOver={(e) => handleDragOver(e, image)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, image)}
                onDragEnd={handleDragEnd}
              >
                <img 
                  src={getCloudinaryUrl(image)} 
                  alt={`Image ${images.indexOf(image) + 1}`} 
                />
                
                {/* Selection checkbox */}
                <button
                  className={`grid-image-checkbox ${isImgSelected ? 'grid-image-checkbox--checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleImage(image);
                  }}
                  title={isImgSelected ? 'Remove from post' : 'Add to post'}
                >
                  {isImgSelected ? '✓' : ''}
                </button>
                
                {/* Order number badge */}
                {isImgSelected && (
                  <span className="grid-image-order">{selectionIndex + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="image-carousel-actions">
        <button className="carousel-action" onClick={onSelectAll}>
          Select All ({Math.min(images.length, 10)})
        </button>
        <button className="carousel-action" onClick={onDeselectAll}>
          Deselect All
        </button>
        <span className="carousel-selected-count">
          {selectedImages.length} selected (max 10)
        </span>
      </div>
    </div>
  );
}
