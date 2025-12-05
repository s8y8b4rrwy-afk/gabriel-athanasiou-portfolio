import styles from './Schedule.module.css';
import { PublishButton } from './PublishButton';
import { getCredentialsLocally } from '../../services/instagramApi';
import { buildCloudinaryUrl, findImageIndex, getOptimizedCloudinaryUrl } from '../../utils/imageUtils';
import type { ScheduleSlot, PostDraft } from '../../types';
import type { PublishResult } from '../../types/instagram';
import { useMemo } from 'react';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface ScheduleItemProps {
  post: ScheduledPost;
  onEdit: () => void;
  onUnschedule: () => void;
  onReschedule: () => void;
  onPublishSuccess?: (result: PublishResult) => void;
  compact?: boolean;
}

export function ScheduleItem({ 
  post, 
  onEdit, 
  onUnschedule, 
  onReschedule,
  onPublishSuccess,
  compact = false 
}: ScheduleItemProps) {
  const { scheduleSlot, project } = post;
  const credentials = getCredentialsLocally();
  
  // Get thumbnail with Cloudinary conversion
  const thumbnail = useMemo(() => {
    const rawThumbnail = post.selectedImages[0] || project.gallery?.[0] || '';
    if (!rawThumbnail) return '';
    
    // If already Cloudinary, just optimize it
    if (rawThumbnail.includes('res.cloudinary.com')) {
      return getOptimizedCloudinaryUrl(rawThumbnail);
    }
    
    // Find the index in the gallery
    const allImages = project.gallery || [];
    const index = findImageIndex(rawThumbnail, allImages);
    if (index !== -1) {
      return buildCloudinaryUrl(project.id, index);
    }
    
    // Fallback: use index 0 if first selected image
    if (post.selectedImages[0] === rawThumbnail) {
      return buildCloudinaryUrl(project.id, 0);
    }
    
    return rawThumbnail;
  }, [post.selectedImages, project.gallery, project.id]);
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusBadge = () => {
    switch (scheduleSlot.status) {
      case 'published':
        return <span className={`${styles.badge} ${styles.published}`}>Published</span>;
      case 'failed':
        return <span className={`${styles.badge} ${styles.failed}`}>Failed</span>;
      default:
        return <span className={`${styles.badge} ${styles.pending}`}>Pending</span>;
    }
  };

  if (compact) {
    return (
      <div className={`${styles.item} ${styles.compact}`}>
        {thumbnail && (
          <img src={thumbnail} alt={project.title} className={styles.thumbnailSmall} />
        )}
        <div className={styles.compactInfo}>
          <span className={styles.compactTitle}>{project.title}</span>
          <span className={styles.compactTime}>{formatTime(scheduleSlot.scheduledTime)}</span>
        </div>
        {getStatusBadge()}
      </div>
    );
  }

  return (
    <div className={`${styles.item} ${styles[scheduleSlot.status]}`}>
      <div className={styles.itemHeader}>
        <div className={styles.datetime}>
          <span className={styles.date}>{formatDate(scheduleSlot.scheduledDate)}</span>
          <span className={styles.time}>{formatTime(scheduleSlot.scheduledTime)}</span>
        </div>
        {getStatusBadge()}
      </div>

      <div className={styles.itemContent}>
        {thumbnail && (
          <img 
            src={thumbnail} 
            alt={project.title} 
            className={styles.thumbnail} 
          />
        )}
        <div className={styles.itemDetails}>
          <h4 className={styles.projectTitle}>{project.title}</h4>
          <p className={styles.projectYear}>{project.year}</p>
          <div className={styles.imageCount}>
            📷 {post.selectedImages.length || project.gallery?.length || 0} images
          </div>
        </div>
      </div>

      <div className={styles.captionPreview}>
        {post.caption.slice(0, 100)}
        {post.caption.length > 100 && '...'}
      </div>

      {scheduleSlot.status === 'pending' && (
        <div className={styles.itemActions}>
          {credentials?.connected && (
            <PublishButton
              draft={post}
              onPublishSuccess={onPublishSuccess}
              variant="small"
            />
          )}
          <button onClick={onEdit} className={styles.actionButton}>
            ✏️ Edit
          </button>
          <button onClick={onReschedule} className={styles.actionButton}>
            📅 Reschedule
          </button>
          <button onClick={onUnschedule} className={`${styles.actionButton} ${styles.danger}`}>
            ✕ Remove
          </button>
        </div>
      )}
    </div>
  );
}
