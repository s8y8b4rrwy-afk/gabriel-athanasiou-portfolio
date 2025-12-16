import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Project, PostDraft, ScheduleSlot, RecurringTemplate, ImageDisplayMode } from '../../types';
import type { PublishResult } from '../../types/instagram';
import { ImageCarousel } from './ImageCarousel';
import { CaptionEditor } from './CaptionEditor';
import { ProjectScheduledPosts } from './ProjectScheduledPosts';
import { TimeSlotPicker } from '../Calendar';
import { PublishButton } from '../Schedule/PublishButton';
import { generateCaption, generateHashtags, formatHashtagsForCaption } from '../../utils';
import { useCloudinaryMappingReady } from '../../hooks';
import { buildCloudinaryUrl, getOptimizedCloudinaryUrl, getInstagramPreviewStyle, getCarouselTransformMode, getCloudinaryUrlForImage, getInstagramPublishUrls } from '../../utils/imageUtils';
import { getCredentialsLocally } from '../../services/instagramApi';
import { applyTemplateToProject, getHashtagsFromGroups, HashtagGroupKey } from '../../types/template';
import './PostPreview.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface EditingScheduleInfo {
  slotId: string;
  draftId: string;
  scheduledDate: string;
  scheduledTime: string;
}

interface PostPreviewProps {
  project: Project | null;
  onSaveDraft?: (draft: { caption: string; hashtags: string[]; selectedImages: string[]; imageMode: ImageDisplayMode }) => void;
  currentDraft?: { caption: string; hashtags: string[]; selectedImages: string[]; imageMode?: ImageDisplayMode } | null;
  onScheduleClick?: () => void;
  isEditing?: boolean;
  editingScheduleInfo?: EditingScheduleInfo | null;
  onPersistEdit?: (draft: { caption: string; hashtags: string[]; selectedImages: string[]; imageMode: ImageDisplayMode }) => void;
  onSaveEdit?: (draft: { caption: string; hashtags: string[]; selectedImages: string[]; imageMode: ImageDisplayMode }, newTime?: string) => void;
  onCancelEdit?: () => void;
  scheduledPostsForProject?: ScheduledPost[];
  onEditScheduledPost?: (post: ScheduledPost) => void;
  onUnschedulePost?: (slotId: string) => void;
  onReschedulePost?: (post: ScheduledPost) => void;
  onPublishSuccess?: (result: PublishResult) => void;
  templates?: RecurringTemplate[];
  defaultTemplate?: RecurringTemplate;
  // Navigation between posts in edit mode
  allPendingPosts?: ScheduledPost[];
  onNavigateToPost?: (post: ScheduledPost, saveCurrent: { caption: string; hashtags: string[]; selectedImages: string[]; imageMode?: ImageDisplayMode }) => void;
}

export function PostPreview({ 
  project, 
  onSaveDraft, 
  currentDraft, 
  onScheduleClick,
  isEditing = false,
  editingScheduleInfo,
  onPersistEdit,
  onSaveEdit,
  onCancelEdit,
  scheduledPostsForProject = [],
  onEditScheduledPost,
  onUnschedulePost,
  onReschedulePost,
  onPublishSuccess,
  templates = [],
  defaultTemplate,
  allPendingPosts = [],
  onNavigateToPost,
}: PostPreviewProps) {
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editingTime, setEditingTime] = useState<string>('11:00');
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());
  const [showSaved, setShowSaved] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false); // Toggle between original and Instagram crop
  const [imageMode, setImageMode] = useState<ImageDisplayMode>('fill'); // 'fill' = crop, 'fit' = letterbox
  const [debugPreview, setDebugPreview] = useState(false); // Toggle to show actual Cloudinary-transformed URLs
  const [debugUrls, setDebugUrls] = useState<string[]>([]); // Cached debug URLs from getInstagramPublishUrls
  const [debugLoading, setDebugLoading] = useState(false); // Loading state for debug URLs
  const loadedDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  
  // Check if Instagram is connected
  const credentials = getCredentialsLocally();
  const isInstagramConnected = credentials?.connected ?? false;
  
  // This will trigger re-render when Cloudinary mapping loads
  useCloudinaryMappingReady();

  // Get all available images for the project (use original URLs directly)
  // IMPORTANT: Memoize to prevent infinite re-renders in dependent effects
  const allImages = useMemo(() => {
    if (!project) return [];
    return [...(project.heroImage ? [project.heroImage] : []), ...project.gallery].filter(
      (img, idx, arr) => arr.indexOf(img) === idx // Remove duplicates
    );
  }, [project?.id, project?.heroImage, project?.gallery]);
    
  // Build a map of original URL -> Cloudinary URL for fast lookups
  const cloudinaryUrlMap = useMemo(() => {
    if (!project) return new Map<string, string>();
    const map = new Map<string, string>();
    allImages.forEach((url, index) => {
      if (url.includes('res.cloudinary.com')) {
        map.set(url, getOptimizedCloudinaryUrl(url));
      } else {
        map.set(url, buildCloudinaryUrl(project.id, index));
      }
    });
    return map;
  }, [allImages, project?.id]);
  
  // Helper to get Cloudinary URL for any image
  // Handles URLs from saved drafts that might not be in current project's allImages
  const getCloudinaryUrl = useCallback((url: string): string => {
    // First check the map (fastest path)
    const mapped = cloudinaryUrlMap.get(url);
    if (mapped) return mapped;
    
    // If already a Cloudinary URL, just optimize it
    if (url.includes('res.cloudinary.com')) {
      return getOptimizedCloudinaryUrl(url);
    }
    
    // For Airtable URLs, try to find the index from current project and build Cloudinary URL
    if (project && (url.includes('airtable.com') || url.includes('airtableusercontent.com'))) {
      return getCloudinaryUrlForImage(url, project.id, allImages);
    }
    
    // Fallback: return original URL
    return url;
  }, [cloudinaryUrlMap, project, allImages]);

  // Set editing time when schedule info is provided
  useEffect(() => {
    if (editingScheduleInfo) {
      setEditingTime(editingScheduleInfo.scheduledTime);
    }
  }, [editingScheduleInfo]);

  // Generate caption and hashtags when project changes, or load from currentDraft when editing
  useEffect(() => {
    if (project) {
      // If we have a currentDraft (editing mode), use its values
      if (currentDraft) {
        setCaption(currentDraft.caption);
        setHashtags(currentDraft.hashtags);
        
        // Convert any Airtable URLs to Cloudinary URLs
        // Old drafts may have Airtable URLs saved, but we should use Cloudinary URLs now
        const convertedImages = currentDraft.selectedImages.length > 0 
          ? currentDraft.selectedImages.map((url, index) => {
              // If it's already a Cloudinary URL, use it
              if (url.includes('res.cloudinary.com')) {
                return url;
              }
              // If it's an Airtable URL, use the corresponding image from allImages by position
              // (Airtable URLs can't be matched directly, so we use position-based fallback)
              if (url.includes('airtable') && allImages[index]) {
                console.log(`🔄 Converting Airtable URL to Cloudinary (position ${index})`);
                return allImages[index];
              }
              return url;
            })
          : allImages.slice(0, 10);
        setSelectedImages(convertedImages);
        setImageMode(currentDraft.imageMode || 'fill'); // Load saved image mode
      } else {
        // Generate fresh content using the default template if available
        if (defaultTemplate) {
          const newCaption = applyTemplateToProject(defaultTemplate.captionTemplate, project);
          const templateHashtags = getHashtagsFromGroups(defaultTemplate.hashtagGroups as HashtagGroupKey[]);
          const captionWithHashtags = templateHashtags.length > 0 
            ? `${newCaption}\n\n${formatHashtagsForCaption(templateHashtags)}`
            : newCaption;
          setCaption(captionWithHashtags);
          setHashtags(templateHashtags);
          setSelectedTemplateId('default');
        } else {
          // Fallback to old behavior
          const generatedHashtags = generateHashtags(project);
          setHashtags(generatedHashtags);
          setCaption(generateCaption(project, { includeHashtags: true, customHashtags: generatedHashtags }));
        }
        setSelectedImages(allImages.slice(0, 10)); // Select first 10 by default
      }
      setCurrentPreviewIndex(0); // Reset preview index
      loadedDimensionsRef.current.clear(); // Reset dimensions cache
    } else {
      setCaption('');
      setHashtags([]);
      setSelectedImages([]);
      setCurrentPreviewIndex(0);
    }
  }, [project?.id, currentDraft, defaultTemplate]); // Re-run when project ID, currentDraft, or defaultTemplate changes

  // Calculate aspect ratio for each selected image and store dimensions
  useEffect(() => {
    if (selectedImages.length === 0) {
      setImageDimensions(new Map());
      return;
    }

    // Load image dimensions for selected images
    const loadDimensions = async () => {
      const newDimensions = new Map<string, { width: number; height: number }>();
      
      for (const src of selectedImages) {
        // Check cache first
        if (loadedDimensionsRef.current.has(src)) {
          newDimensions.set(src, loadedDimensionsRef.current.get(src)!);
          continue;
        }
        
        // Use Cloudinary URL for loading (more reliable than Airtable URLs which can expire)
        const cloudinaryUrl = getCloudinaryUrl(src);
        
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const d = { width: img.naturalWidth, height: img.naturalHeight };
            loadedDimensionsRef.current.set(src, d);
            console.log(`📐 Loaded dimensions for image: ${d.width}x${d.height} (ratio: ${(d.width/d.height).toFixed(2)})`);
            resolve(d);
          };
          img.onerror = () => {
            console.warn(`❌ Failed to load image dimensions from: ${cloudinaryUrl.substring(0, 80)}...`);
            resolve({ width: 16, height: 9 }); // Default to landscape on error (more common for film stills)
          };
          img.src = cloudinaryUrl;
        });
        newDimensions.set(src, dims);
      }
      
      setImageDimensions(newDimensions);
    };

    loadDimensions();
  }, [selectedImages, getCloudinaryUrl]);

  // Get Instagram preview style for the ENTIRE CAROUSEL
  // Uses "majority rule" - all images use the same transform mode for consistency
  // - If majority of images are WIDE → letterbox all (object-fit: contain)
  // - If majority of images are TALL → crop all (object-fit: cover)
  const carouselMode = useMemo(() => {
    return getCarouselTransformMode(imageDimensions, selectedImages);
  }, [imageDimensions, selectedImages]);

  // Publishing uses a single target aspect ratio for the whole carousel.
  // Keep the on-screen preview aligned with that same decision.
  const publishTargetAspectRatio = useMemo(() => {
    // Publish uses the same majority-rule decision as URL generation:
    // - letterbox (wide-majority) → 1.91:1
    // - crop (tall/normal-majority) → 4:5
    return carouselMode.mode === 'letterbox' ? 1.91 : 0.8;
  }, [carouselMode.mode]);

  // Load debug URLs when debug mode is enabled - fetches actual Cloudinary-transformed URLs
  useEffect(() => {
    if (!debugPreview || !project || selectedImages.length === 0) {
      setDebugUrls([]);
      return;
    }

    let cancelled = false;
    setDebugLoading(true);

    getInstagramPublishUrls(selectedImages, project.id, imageMode)
      .then((urls) => {
        if (!cancelled) {
          setDebugUrls(urls);
          setDebugLoading(false);
          console.log('🔍 Debug preview URLs loaded:', urls);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load debug URLs:', err);
          setDebugLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debugPreview, project?.id, selectedImages, imageMode]);

  // For backwards compatibility, also get per-image style (used for indicator)
  const getCurrentImagePreviewStyle = useCallback(() => {
    const currentImage = selectedImages[currentPreviewIndex];
    if (!currentImage) {
      return getInstagramPreviewStyle(undefined, undefined);
    }
    
    const dims = imageDimensions.get(currentImage);
    return getInstagramPreviewStyle(dims?.width, dims?.height);
  }, [selectedImages, currentPreviewIndex, imageDimensions]);

  const currentImageStyle = getCurrentImagePreviewStyle();

  // Reset preview index if it goes out of bounds
  useEffect(() => {
    if (currentPreviewIndex >= selectedImages.length && selectedImages.length > 0) {
      setCurrentPreviewIndex(selectedImages.length - 1);
    }
  }, [selectedImages.length, currentPreviewIndex]);

  const handleRegenerateCaption = useCallback(() => {
    if (project) {
      setCaption(generateCaption(project, { includeHashtags: true, customHashtags: hashtags }));
    }
  }, [project, hashtags]);

  const handleCopyCaption = useCallback(() => {
    navigator.clipboard.writeText(caption);
  }, [caption]);

  const handleToggleImage = useCallback((imageUrl: string) => {
    setSelectedImages((prev) => {
      if (prev.includes(imageUrl)) {
        return prev.filter((img) => img !== imageUrl);
      }
      if (prev.length >= 10) {
        return prev; // Max 10 images for Instagram carousel
      }
      return [...prev, imageUrl];
    });
  }, []);

  const handleSelectAllImages = useCallback(() => {
    setSelectedImages(allImages.slice(0, 10));
  }, [allImages]);

  const handleDeselectAllImages = useCallback(() => {
    setSelectedImages([]);
  }, []);

  const handleReorderImages = useCallback((newOrder: string[]) => {
    setSelectedImages(newOrder);
  }, []);

  const handleHashtagsChange = useCallback((newHashtags: string[]) => {
    setHashtags(newHashtags);
    // Update caption with new hashtags
    if (project) {
      const captionWithoutHashtags = caption.split('\n\n').slice(0, -1).join('\n\n');
      setCaption(`${captionWithoutHashtags}\n\n${formatHashtagsForCaption(newHashtags)}`);
    }
  }, [caption, project]);

  // Apply a template to the current project
  const handleApplyTemplate = useCallback((template: RecurringTemplate) => {
    if (!project) return;
    
    // Generate caption from template
    const newCaption = applyTemplateToProject(template.captionTemplate, project);
    
    // Get hashtags from template groups
    const templateHashtags = getHashtagsFromGroups(template.hashtagGroups as HashtagGroupKey[]);
    
    // Add hashtags to caption
    const captionWithHashtags = templateHashtags.length > 0 
      ? `${newCaption}\n\n${formatHashtagsForCaption(templateHashtags)}`
      : newCaption;
    
    setCaption(captionWithHashtags);
    setHashtags(templateHashtags);
    setSelectedTemplateId(template.id);
  }, [project]);

  const handleDownloadImages = useCallback(() => {
    selectedImages.forEach((imageUrl, index) => {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${project?.slug || 'image'}-${index + 1}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }, [selectedImages, project]);

  // Carousel navigation handlers
  const goToPreviousImage = useCallback(() => {
    setCurrentPreviewIndex((prev) => 
      prev === 0 ? selectedImages.length - 1 : prev - 1
    );
  }, [selectedImages.length]);

  const goToNextImage = useCallback(() => {
    setCurrentPreviewIndex((prev) => 
      prev === selectedImages.length - 1 ? 0 : prev + 1
    );
  }, [selectedImages.length]);

  // Post navigation in edit mode (next/previous scheduled post)
  const currentPostIndex = useMemo(() => {
    if (!isEditing || !editingScheduleInfo) return -1;
    return allPendingPosts.findIndex(p => p.scheduleSlot.id === editingScheduleInfo.slotId);
  }, [isEditing, editingScheduleInfo, allPendingPosts]);

  const prevPost = currentPostIndex > 0 ? allPendingPosts[currentPostIndex - 1] : null;
  const nextPost = currentPostIndex >= 0 && currentPostIndex < allPendingPosts.length - 1 
    ? allPendingPosts[currentPostIndex + 1] 
    : null;

  const handleNavigatePrev = useCallback(() => {
    if (prevPost && onNavigateToPost) {
      onNavigateToPost(prevPost, { caption, hashtags, selectedImages, imageMode });
    }
  }, [prevPost, onNavigateToPost, caption, hashtags, selectedImages, imageMode]);

  const handleNavigateNext = useCallback(() => {
    if (nextPost && onNavigateToPost) {
      onNavigateToPost(nextPost, { caption, hashtags, selectedImages, imageMode });
    }
  }, [nextPost, onNavigateToPost, caption, hashtags, selectedImages, imageMode]);

  if (!project) {
    return (
      <div className="post-preview-empty">
        <div className="post-preview-empty-content">
          <span className="post-preview-empty-icon">📱</span>
          <h2>Select a Project</h2>
          <p>Choose a project from the list to preview it as an Instagram post</p>
        </div>
      </div>
    );
  }

  return (
    <div className="post-preview">
      {/* Post Navigation Bar - shown when editing a scheduled post */}
      {isEditing && allPendingPosts.length > 1 && (
        <div className="post-navigation-bar">
          <button 
            className="post-nav-btn post-nav-btn--prev"
            onClick={handleNavigatePrev}
            disabled={!prevPost}
            title={prevPost ? `Previous: ${prevPost.project?.title || 'Unknown'}` : 'No previous post'}
          >
            <span className="post-nav-arrow">←</span>
            <span className="post-nav-label">
              {prevPost ? (
                <>
                  <span className="post-nav-hint">Save & go to</span>
                  <span className="post-nav-title">{prevPost.project?.title?.substring(0, 20) || 'Previous'}{(prevPost.project?.title?.length || 0) > 20 ? '...' : ''}</span>
                </>
              ) : (
                <span className="post-nav-hint">No previous</span>
              )}
            </span>
          </button>
          
          <div className="post-nav-position">
            {currentPostIndex + 1} / {allPendingPosts.length}
          </div>
          
          <button 
            className="post-nav-btn post-nav-btn--next"
            onClick={handleNavigateNext}
            disabled={!nextPost}
            title={nextPost ? `Next: ${nextPost.project?.title || 'Unknown'}` : 'No next post'}
          >
            <span className="post-nav-label">
              {nextPost ? (
                <>
                  <span className="post-nav-hint">Save & go to</span>
                  <span className="post-nav-title">{nextPost.project?.title?.substring(0, 20) || 'Next'}{(nextPost.project?.title?.length || 0) > 20 ? '...' : ''}</span>
                </>
              ) : (
                <span className="post-nav-hint">No next</span>
              )}
            </span>
            <span className="post-nav-arrow">→</span>
          </button>
        </div>
      )}
      
      <div className="post-preview-container">
        {/* Column 1: Instagram Preview */}
        <div className="post-preview-instagram">
          <div className="instagram-mockup">
            <div className="instagram-header">
              <div className="instagram-profile">
                <div className="instagram-avatar">🍋</div>
                <span className="instagram-username">lemonpost.studio</span>
              </div>
              <span className="instagram-more">•••</span>
            </div>
            
            <div className="instagram-image" style={{ 
              aspectRatio: showOriginal 
                ? (imageDimensions.get(selectedImages[currentPreviewIndex])?.width || 4) / 
                  (imageDimensions.get(selectedImages[currentPreviewIndex])?.height || 5)
                : publishTargetAspectRatio // Match Instagram publish ratio (4:5 or 1.91:1)
            }}>
              {selectedImages.length > 0 ? (
                <>
                  {debugLoading ? (
                    <div className="instagram-debug-loading">🔄 Loading debug preview...</div>
                  ) : (
                    <img 
                      src={debugPreview && debugUrls[currentPreviewIndex] 
                        ? debugUrls[currentPreviewIndex] 
                        : getCloudinaryUrl(selectedImages[currentPreviewIndex])
                      } 
                      alt={project.title}
                      style={{ 
                        objectFit: showOriginal
                          ? 'contain'
                          : imageMode === 'fill'
                            ? 'cover' // FILL (c_lfill) crops to fill the chosen target ratio
                            : 'contain' // FIT (c_pad) preserves full image; bars are expected
                      }}
                    />
                  )}
                  {selectedImages.length > 1 && (
                    <>
                      <button 
                        className="instagram-nav instagram-nav--prev" 
                        onClick={goToPreviousImage}
                        aria-label="Previous image"
                      >
                        ‹
                      </button>
                      <button 
                        className="instagram-nav instagram-nav--next" 
                        onClick={goToNextImage}
                        aria-label="Next image"
                      >
                        ›
                      </button>
                    </>
                  )}
                </>
              ) : allImages.length > 0 ? (
                <img src={getCloudinaryUrl(allImages[0])} alt={project.title} style={{ objectFit: 'cover' }} />
              ) : (
                <div className="instagram-no-image">🎬</div>
              )}
              {selectedImages.length > 1 && (
                <>
                  <div className="instagram-carousel-indicator">
                    <span>{currentPreviewIndex + 1} / {selectedImages.length}</span>
                  </div>
                  <div className="instagram-carousel-dots">
                    {selectedImages.map((_, idx) => (
                      <button
                        key={idx}
                        className={`instagram-dot ${idx === currentPreviewIndex ? 'instagram-dot--active' : ''}`}
                        onClick={() => setCurrentPreviewIndex(idx)}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="instagram-actions">
              <div className="instagram-action-icons">
                <span>❤️</span>
                <span>💬</span>
                <span>📤</span>
              </div>
              <span>🔖</span>
            </div>

            <div className="instagram-caption-preview">
              <span className="instagram-caption-username">lemonpost.studio</span>{' '}
              <span className="instagram-caption-text">
                {caption.substring(0, 100)}
                {caption.length > 100 && '...'}
              </span>
            </div>
          </div>

          {/* Image Controls - Below the Instagram mockup */}
          {selectedImages.length > 0 && (
            <div className="instagram-image-controls">
              {/* Original view toggle */}
              <button 
                className={`instagram-control-btn ${showOriginal ? 'instagram-control-btn--active' : ''}`}
                onClick={() => setShowOriginal(!showOriginal)}
                title={showOriginal 
                  ? "Showing original - Click to see Instagram view" 
                  : "Click to see original image"
                }
              >
                📷 {showOriginal ? 'Original' : 'Preview'}
              </button>
              
              {/* Image Mode Toggle - Fill vs Fit */}
              {carouselMode.mode !== 'none' && (
                <button 
                  className={`instagram-control-btn ${imageMode === 'fill' ? 'instagram-control-btn--fill' : 'instagram-control-btn--fit'}`}
                  onClick={() => setImageMode(imageMode === 'fit' ? 'fill' : 'fit')}
                  title={imageMode === 'fit' 
                    ? "FIT: Full image with letterbox bars - Click for FILL mode" 
                    : "FILL: Cropped to fill frame - Click for FIT mode"
                  }
                >
                  {imageMode === 'fit' ? '▬ FIT' : '✂️ FILL'}
                </button>
              )}
              
              {/* Debug Preview Toggle - Shows actual Cloudinary-transformed images */}
              <button 
                className={`instagram-control-btn ${debugPreview ? 'instagram-control-btn--debug-active' : 'instagram-control-btn--debug'}`}
                onClick={() => setDebugPreview(!debugPreview)}
                title={debugPreview 
                  ? "DEBUG ON: Showing actual Cloudinary URLs that Instagram will receive - Click to disable" 
                  : "Click to show actual Cloudinary-transformed images (what Instagram will receive)"
                }
              >
                {debugLoading ? '⏳' : debugPreview ? '🔍 DEBUG' : '🔍'}
              </button>
            </div>
          )}

          {/* Time picker shown under preview when editing */}
          {isEditing && editingScheduleInfo && (
            <div className="editing-time-section">
              <div className="editing-date-display">
                📅 {new Date(editingScheduleInfo.scheduledDate).toLocaleDateString('en-GB', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short' 
                })}
                {onReschedulePost && project && (
                  <button 
                    className="reschedule-button"
                    onClick={() => {
                      // Create a ScheduledPost object using the real IDs from editingScheduleInfo
                      const scheduledPost: ScheduledPost = {
                        id: editingScheduleInfo.draftId,
                        projectId: project.id,
                        project,
                        caption,
                        hashtags,
                        selectedImages,
                        imageMode,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        scheduleSlot: {
                          id: editingScheduleInfo.slotId,
                          postDraftId: editingScheduleInfo.draftId,
                          scheduledDate: editingScheduleInfo.scheduledDate,
                          scheduledTime: editingScheduleInfo.scheduledTime,
                          status: 'pending'
                        }
                      };
                      onReschedulePost(scheduledPost);
                    }}
                    title="Pick a new date for this post"
                  >
                    📅 Reschedule
                  </button>
                )}
              </div>
              <TimeSlotPicker
                selectedTime={editingTime}
                onTimeSelect={setEditingTime}
                defaultTimes={['09:00', '11:00', '14:00', '17:00', '19:00']}
              />
            </div>
          )}
        </div>

        {/* Column 2: Project Info + Images + Templates + Caption + Actions */}
        <div className="post-preview-content-column">
          {isEditing && (
            <div className="editing-banner">
              ✏️ Editing scheduled post
            </div>
          )}
          
          <div className="post-preview-project-info">
            <h2>{project.title}</h2>
            <div className="project-info-meta">
              <span className="project-info-year">{project.year}</span>
              <span className="project-info-type">{project.type}</span>
              {project.kinds.map((kind) => (
                <span key={kind} className="project-info-kind">{kind}</span>
              ))}
            </div>
          </div>

          <ImageCarousel
            images={allImages}
            selectedImages={selectedImages}
            projectId={project.id}
            onToggleImage={handleToggleImage}
            onReorderImages={handleReorderImages}
            onSelectAll={handleSelectAllImages}
            onDeselectAll={handleDeselectAllImages}
          />

          {/* Template Selector */}
          <div className="template-selector">
            <label>Apply Template:</label>
            <div className="template-buttons">
              <button 
                className={`template-button ${!selectedTemplateId || selectedTemplateId === 'default' ? 'template-button--active' : ''}`}
                onClick={() => {
                  if (defaultTemplate) {
                    handleApplyTemplate(defaultTemplate);
                  } else {
                    const generatedHashtags = generateHashtags(project);
                    setHashtags(generatedHashtags);
                    setCaption(generateCaption(project, { includeHashtags: true, customHashtags: generatedHashtags }));
                    setSelectedTemplateId(null);
                  }
                }}
              >
                Default
              </button>
              {templates.map(template => (
                <button
                  key={template.id}
                  className={`template-button ${selectedTemplateId === template.id ? 'template-button--active' : ''}`}
                  onClick={() => handleApplyTemplate(template)}
                  title={template.description}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          <CaptionEditor
            caption={caption}
            hashtags={hashtags}
            onCaptionChange={setCaption}
            onHashtagsChange={handleHashtagsChange}
            onCopy={handleCopyCaption}
            onRegenerate={handleRegenerateCaption}
          />

          <div className="post-preview-final-actions">
            <button className="final-action" onClick={handleDownloadImages} disabled={selectedImages.length === 0}>
              📥 Download ({selectedImages.length})
            </button>
            
            {isEditing ? (
              <>
                <button 
                  className={`final-action final-action--save ${showSaved ? 'final-action--saved' : ''}`}
                  onClick={() => {
                    const draft = { caption, hashtags, selectedImages, imageMode };
                    // Persist the changes to localStorage (triggers auto-sync)
                    onPersistEdit?.(draft);
                    onSaveDraft?.(draft);
                    setShowSaved(true);
                    setTimeout(() => setShowSaved(false), 2000);
                  }}
                  disabled={selectedImages.length === 0}
                >
                  {showSaved ? '✓ Saved!' : '✅ Save'}
                </button>
                {isInstagramConnected && project && (
                  <PublishButton
                    draft={{
                      id: 'direct-publish',
                      projectId: project.id,
                      project,
                      caption,
                      hashtags,
                      selectedImages,
                      imageMode,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }}
                    onPublishSuccess={onPublishSuccess}
                    variant="primary"
                    disabled={selectedImages.length === 0}
                  />
                )}
                <button 
                  className="final-action final-action--cancel" 
                  onClick={() => {
                    // Save before closing
                    const draft = { caption, hashtags, selectedImages, imageMode };
                    onSaveDraft?.(draft);
                    onSaveEdit?.(draft, editingTime);
                    // Then close
                    onCancelEdit?.();
                  }}
                >
                  💾 Save & Close
                </button>
              </>
            ) : (
              <>
                <button 
                  className="final-action final-action--schedule" 
                  onClick={() => {
                    onSaveDraft?.({ caption, hashtags, selectedImages, imageMode });
                    onScheduleClick?.();
                  }}
                  disabled={selectedImages.length === 0}
                >
                  📅 Schedule
                </button>
                {isInstagramConnected && project ? (
                  <PublishButton
                    draft={{
                      id: 'direct-publish',
                      projectId: project.id,
                      project,
                      caption,
                      hashtags,
                      selectedImages,
                      imageMode,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }}
                    onPublishSuccess={onPublishSuccess}
                    variant="primary"
                    disabled={selectedImages.length === 0}
                  />
                ) : (
                  <button 
                    className="final-action final-action--publish" 
                    disabled
                    title="Connect Instagram in Settings to publish"
                  >
                    📱 Publish
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 3: Scheduled Posts */}
        <div className="post-preview-scheduled-column">
          {scheduledPostsForProject.length > 0 && onEditScheduledPost && onUnschedulePost ? (
            <ProjectScheduledPosts
              posts={scheduledPostsForProject}
              onEditPost={onEditScheduledPost}
              onUnschedulePost={onUnschedulePost}
              currentlyEditing={isEditing ? editingScheduleInfo?.scheduledDate : undefined}
            />
          ) : (
            <div className="no-scheduled-posts">
              <span>📅</span>
              <p>No scheduled posts for this project</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
