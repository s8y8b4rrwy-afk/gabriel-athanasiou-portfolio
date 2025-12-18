import styles from './Schedule.module.css';
import { ScheduleItem } from './ScheduleItem';
import type { ScheduleSlot, PostDraft } from '../../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface ScheduleQueueProps {
  posts: ScheduledPost[];
  displayTimezone: string;
  onEditPost: (post: ScheduledPost) => void;
  onUnschedulePost: (slotId: string) => void;
  onReschedulePost: (post: ScheduledPost) => void;
  onPublishSuccess?: (slotId: string, instagramPostId?: string, permalink?: string) => void;
  onMarkAsPublished?: (slotId: string) => void;
  maxItems?: number;
  showTitle?: boolean;
}

export function ScheduleQueue({ 
  posts, 
  displayTimezone,
  onEditPost, 
  onUnschedulePost, 
  onReschedulePost,
  onPublishSuccess,
  onMarkAsPublished,
  maxItems,
  showTitle = true
}: ScheduleQueueProps) {
  // Sort posts by scheduled date/time
  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = new Date(`${a.scheduleSlot.scheduledDate}T${a.scheduleSlot.scheduledTime}`);
    const dateB = new Date(`${b.scheduleSlot.scheduledDate}T${b.scheduleSlot.scheduledTime}`);
    return dateA.getTime() - dateB.getTime();
  });

  // Filter to only pending posts
  const pendingPosts = sortedPosts.filter(p => p.scheduleSlot.status === 'pending');
  const displayPosts = maxItems ? pendingPosts.slice(0, maxItems) : pendingPosts;

  if (pendingPosts.length === 0) {
    return (
      <div className={styles.queue}>
        {showTitle && <h3 className={styles.queueTitle}>Upcoming Posts</h3>}
        <div className={styles.emptyQueue}>
          <span className={styles.emptyIcon}>📅</span>
          <p>No scheduled posts yet</p>
          <p className={styles.emptyHint}>
            Select a project and schedule it to see it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.queue}>
      {showTitle && (
        <div className={styles.queueHeader}>
          <h3 className={styles.queueTitle}>Upcoming Posts</h3>
          <span className={styles.queueCount}>{pendingPosts.length}</span>
        </div>
      )}
      
      <div className={styles.queueList}>
        {displayPosts.map(post => (
          <ScheduleItem
            key={post.scheduleSlot.id}
            post={post}
            displayTimezone={displayTimezone}
            onEdit={() => onEditPost(post)}
            onUnschedule={() => onUnschedulePost(post.scheduleSlot.id)}
            onReschedule={() => onReschedulePost(post)}
            onPublishSuccess={onPublishSuccess ? (instagramPostId, permalink) => onPublishSuccess(post.scheduleSlot.id, instagramPostId, permalink) : undefined}
            onMarkAsPublished={onMarkAsPublished}
          />
        ))}
      </div>

      {maxItems && pendingPosts.length > maxItems && (
        <div className={styles.morePostsHint}>
          +{pendingPosts.length - maxItems} more scheduled
        </div>
      )}
    </div>
  );
}
