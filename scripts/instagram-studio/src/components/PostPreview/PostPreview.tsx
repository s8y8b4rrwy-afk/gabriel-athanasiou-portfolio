import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Project, PostDraft, ScheduleSlot, RecurringTemplate } from '../../types';
import type { PublishResult } from '../../types/instagram';
import { ImageCarousel } from './ImageCarousel';
import { CaptionEditor } from './CaptionEditor';
import { ProjectScheduledPosts } from './ProjectScheduledPosts';
import { TimeSlotPicker } from '../Calendar';
import { PublishButton } from '../Schedule/PublishButton';
import { generateCaption, generateHashtags, formatHashtagsForCaption } from '../../utils';
import { useCloudinaryMappingReady } from '../../hooks';
import { buildCloudinaryUrl, getOptimizedCloudinaryUrl, getInstagramPreviewStyle, getCarouselTransformMode } from '../../utils/imageUtils';
import { getCredentialsLocally } from '../../services/instagramApi';
import { applyTemplateToProject, getHashtagsFromGroups, HashtagGroupKey } from '../../types/template';
import './PostPreview.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface EditingScheduleInfo {
  scheduledDate: string;
  scheduledTime: string;
}

interface PostPreviewProps {
  project: Project | null;
  onSaveDraft?: (draft: { caption: string; hashtags: string[]; selectedImages: string[] }) => void;
  currentDraft?: { caption: string; hashtags: string[]; selectedImages: string[] } | null;
  onScheduleClick?: () => void;
  isEditing?: boolean;
  editingScheduleInfo?: EditingScheduleInfo | null;
  onSaveEdit?: (draft: { caption: string; hashtags: string[]; selectedImages: string[] }, newTime?: string) => void;
  onCancelEdit?: () => void;
  scheduledPostsForProject?: ScheduledPost[];
  onEditScheduledPost?: (post: ScheduledPost) => void;
  onUnschedulePost?: (slotId: string) => void;
  onPublishSuccess?: (result: PublishResult) => void;
  templates?: RecurringTemplate[];
  defaultTemplate?: RecurringTemplate;
}

export function PostPreview({ 
  project, 
  onSaveDraft, 
  currentDraft, 
  onScheduleClick,
  isEditing = false,
  editingScheduleInfo,
  onSaveEdit,
  onCancelEdit,
  scheduledPostsForProject = [],
  onEditScheduledPost,
  onUnschedulePost,
  onPublishSuccess,
  templates = [],
  defaultTemplate,
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
  const loadedDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  
  // Check if Instagram is connected
  const credentials = getCredentialsLocally();
  const isInstagramConnected = credentials?.connected ?? false;
  
  // This will trigger re-render when Cloudinary mapping loads
  useCloudinaryMappingReady();

  // Get all available images for the project (use original URLs directly)
  const allImages = project
    ? [...(project.heroImage ? [project.heroImage] : []), ...project.gallery].filter(
        (img, idx, arr) => arr.indexOf(img) === idx // Remove duplicates
      )
    : [];
    
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
  const getCloudinaryUrl = useCallback((url: string): string => {
    return cloudinaryUrlMap.get(url) || url;
  }, [cloudinaryUrlMap]);

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
        setSelectedImages(currentDraft.selectedImages.length > 0 ? currentDraft.selectedImages : allImages.slice(0, 10));
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
                : carouselMode.targetAspectRatio 
            }}>
              {selectedImages.length > 0 ? (
                <>
                  <img 
                    src={getCloudinaryUrl(selectedImages[currentPreviewIndex])} 
                    alt={project.title}
                    style={{ objectFit: showOriginal ? 'contain' : carouselMode.objectFit }}
                  />
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
                  {/* Transform indicator - shows carousel mode (majority rule) */}
                  {/* Click to toggle original vs Instagram view */}
                  {carouselMode.mode !== 'none' && (
                    <button 
                      className={`instagram-transform-indicator ${showOriginal ? 'instagram-transform-indicator--active' : ''}`}
                      onClick={() => setShowOriginal(!showOriginal)}
                      title={showOriginal 
                        ? "Showing original - Click to see Instagram view" 
                        : (carouselMode.mode === 'letterbox' 
                          ? `Majority letterbox (${carouselMode.letterboxCount}▬ ${carouselMode.cropCount}✂️) - Click to see original` 
                          : `Majority crop (${carouselMode.cropCount}✂️ ${carouselMode.letterboxCount}▬) - Click to see original`)
                      }
                    >
                      {showOriginal ? '📷' : (carouselMode.mode === 'letterbox' ? '▬' : '✂️')}
                    </button>
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

          {/* Time picker shown under preview when editing */}
          {isEditing && editingScheduleInfo && (
            <div className="editing-time-section">
              <div className="editing-date-display">
                📅 {new Date(editingScheduleInfo.scheduledDate).toLocaleDateString('en-GB', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short' 
                })}
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
                    const draft = { caption, hashtags, selectedImages };
                    onSaveDraft?.(draft);
                    onSaveEdit?.(draft, editingTime);
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
                  onClick={onCancelEdit}
                >
                  ✕ Close
                </button>
              </>
            ) : (
              <>
                <button 
                  className="final-action final-action--schedule" 
                  onClick={() => {
                    onSaveDraft?.({ caption, hashtags, selectedImages });
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
