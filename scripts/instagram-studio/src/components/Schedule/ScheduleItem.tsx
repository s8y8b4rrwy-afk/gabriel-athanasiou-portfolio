import styles from './Schedule.module.css';
import type { ScheduleSlot, PostDraft } from '../../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface ScheduleItemProps {
  post: ScheduledPost;
  onEdit: () => void;
  onUnschedule: () => void;
  onReschedule: () => void;
  compact?: boolean;
}

export function ScheduleItem({ 
  post, 
  onEdit, 
  onUnschedule, 
  onReschedule,
  compact = false 
}: ScheduleItemProps) {
  const { scheduleSlot, project } = post;
  
  // Get thumbnail directly from post or project
  const thumbnail = post.selectedImages[0] || project.gallery?.[0] || '';
  
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
