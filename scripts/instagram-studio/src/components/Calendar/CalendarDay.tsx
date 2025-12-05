import styles from './Calendar.module.css';
import type { ScheduleSlot, PostDraft } from '../../types';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface CalendarDayProps {
  date: Date | null;
  posts: ScheduledPost[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
  onPostClick?: (post: ScheduledPost) => void;
  isWeekView?: boolean;
}

export function CalendarDay({ 
  date, 
  posts, 
  isToday, 
  isSelected, 
  onClick,
  onPostClick,
  isWeekView = false
}: CalendarDayProps) {
  if (!date) {
    return <div className={styles.emptyDay}></div>;
  }

  const dayNumber = date.getDate();
  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

  const getStatusClass = (status: ScheduleSlot['status']) => {
    switch (status) {
      case 'published':
        return styles.published;
      case 'failed':
        return styles.failed;
      default:
        return styles.pending;
    }
  };

  return (
    <div
      className={`
        ${styles.day}
        ${isToday ? styles.today : ''}
        ${isSelected ? styles.selected : ''}
        ${isPast ? styles.past : ''}
        ${isWeekView ? styles.weekViewDay : ''}
      `}
      onClick={onClick}
    >
      <span className={styles.dayNumber}>{dayNumber}</span>
      
      {posts.length > 0 && (
        <div className={styles.postsContainer}>
          {isWeekView ? (
            // Week view shows full post details
            posts.slice(0, 4).map(post => (
              <div
                key={post.scheduleSlot.id}
                className={`${styles.postCard} ${getStatusClass(post.scheduleSlot.status)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPostClick?.(post);
                }}
              >
                <span className={styles.postTime}>{post.scheduleSlot.scheduledTime}</span>
                <span className={styles.postTitle}>{post.project.title}</span>
              </div>
            ))
          ) : (
            // Month view shows dots only
            <div className={styles.dots}>
              {posts.slice(0, 3).map(post => (
                <span 
                  key={post.scheduleSlot.id}
                  className={`${styles.dot} ${getStatusClass(post.scheduleSlot.status)}`}
                  title={`${post.project.title} at ${post.scheduleSlot.scheduledTime}`}
                />
              ))}
              {posts.length > 3 && (
                <span className={styles.moreIndicator}>+{posts.length - 3}</span>
              )}
            </div>
          )}
          
          {isWeekView && posts.length > 4 && (
            <div className={styles.moreCount}>+{posts.length - 4} more</div>
          )}
        </div>
      )}
    </div>
  );
}
