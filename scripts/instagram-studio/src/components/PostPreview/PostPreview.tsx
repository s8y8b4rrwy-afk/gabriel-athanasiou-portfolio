import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, PostDraft, ScheduleSlot } from '../../types';
import { ImageCarousel } from './ImageCarousel';
import { CaptionEditor } from './CaptionEditor';
import { ProjectScheduledPosts } from './ProjectScheduledPosts';
import { generateCaption, generateHashtags, formatHashtagsForCaption } from '../../utils';
import './PostPreview.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface PostPreviewProps {
  project: Project | null;
  onSaveDraft?: (draft: { caption: string; hashtags: string[]; selectedImages: string[] }) => void;
  currentDraft?: { caption: string; hashtags: string[]; selectedImages: string[] } | null;
  onScheduleClick?: () => void;
  isEditing?: boolean;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  scheduledPostsForProject?: ScheduledPost[];
  onEditScheduledPost?: (post: ScheduledPost) => void;
  onUnschedulePost?: (slotId: string) => void;
}

export function PostPreview({ 
  project, 
  onSaveDraft, 
  currentDraft, 
  onScheduleClick,
  isEditing = false,
  onSaveEdit,
  onCancelEdit,
  scheduledPostsForProject = [],
  onEditScheduledPost,
  onUnschedulePost,
}: PostPreviewProps) {
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(4 / 5); // Default to 4:5 (Instagram portrait)
  const loadedDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());

  // Get all available images for the project (use original URLs directly)
  const allImages = project
    ? [...(project.heroImage ? [project.heroImage] : []), ...project.gallery].filter(
        (img, idx, arr) => arr.indexOf(img) === idx // Remove duplicates
      )
    : [];

  // Generate caption and hashtags when project changes, or load from currentDraft when editing
  useEffect(() => {
    if (project) {
      // If we have a currentDraft (editing mode), use its values
      if (currentDraft) {
        setCaption(currentDraft.caption);
        setHashtags(currentDraft.hashtags);
        setSelectedImages(currentDraft.selectedImages.length > 0 ? currentDraft.selectedImages : allImages.slice(0, 10));
      } else {
        // Generate fresh content for a new post
        const generatedHashtags = generateHashtags(project);
        setHashtags(generatedHashtags);
        setCaption(generateCaption(project, { includeHashtags: true, customHashtags: generatedHashtags }));
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
  }, [project?.id, currentDraft]); // Re-run when project ID or currentDraft changes

  // Calculate median aspect ratio when selected images change
  useEffect(() => {
    if (selectedImages.length === 0) {
      setAspectRatio(4 / 5);
      return;
    }

    // Load image dimensions for selected images
    const loadDimensions = async () => {
      const dimensionPromises = selectedImages.map((src) => {
        // Check cache first
        if (loadedDimensionsRef.current.has(src)) {
          return Promise.resolve(loadedDimensionsRef.current.get(src)!);
        }
        
        return new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const dims = { width: img.naturalWidth, height: img.naturalHeight };
            loadedDimensionsRef.current.set(src, dims);
            resolve(dims);
          };
          img.onerror = () => resolve({ width: 4, height: 5 }); // Default on error
          img.src = src;
        });
      });

      const dimensions = await Promise.all(dimensionPromises);
      const ratios = dimensions.map((d) => d.width / d.height).sort((a, b) => a - b);
      
      // Get median
      const mid = Math.floor(ratios.length / 2);
      const medianRatio = ratios.length % 2 !== 0
        ? ratios[mid]
        : (ratios[mid - 1] + ratios[mid]) / 2;
      
      // Clamp to Instagram's allowed range: 1.91:1 (landscape) to 4:5 (portrait)
      const clampedRatio = Math.max(4 / 5, Math.min(1.91, medianRatio));
      setAspectRatio(clampedRatio);
    };

    loadDimensions();
  }, [selectedImages]);

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
        <div className="post-preview-instagram">
          <div className="instagram-mockup">
            <div className="instagram-header">
              <div className="instagram-profile">
                <div className="instagram-avatar">🍋</div>
                <span className="instagram-username">lemonpost.studio</span>
              </div>
              <span className="instagram-more">•••</span>
            </div>
            
            <div className="instagram-image" style={{ aspectRatio: aspectRatio }}>
              {selectedImages.length > 0 ? (
                <>
                  <img src={selectedImages[currentPreviewIndex]} alt={project.title} />
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
                <img src={allImages[0]} alt={project.title} />
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
        </div>

        <div className="post-preview-editor">
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

          {/* Show scheduled posts for this project */}
          {!isEditing && scheduledPostsForProject.length > 0 && onEditScheduledPost && onUnschedulePost && (
            <ProjectScheduledPosts
              posts={scheduledPostsForProject}
              onEditPost={onEditScheduledPost}
              onUnschedulePost={onUnschedulePost}
            />
          )}

          <ImageCarousel
            images={allImages}
            selectedImages={selectedImages}
            onToggleImage={handleToggleImage}
            onReorderImages={handleReorderImages}
            onSelectAll={handleSelectAllImages}
            onDeselectAll={handleDeselectAllImages}
          />

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
              📥 Download Images ({selectedImages.length})
            </button>
            
            {isEditing ? (
              <>
                <button 
                  className="final-action final-action--save" 
                  onClick={() => {
                    onSaveDraft?.({ caption, hashtags, selectedImages });
                    onSaveEdit?.();
                  }}
                  disabled={selectedImages.length === 0}
                >
                  ✅ Save Changes
                </button>
                <button 
                  className="final-action final-action--cancel" 
                  onClick={onCancelEdit}
                >
                  ✕ Cancel
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
                  📅 Schedule Post
                </button>
                <button className="final-action final-action--publish" disabled>
                  📱 Publish (Phase 3)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
