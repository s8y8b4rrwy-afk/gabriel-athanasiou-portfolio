import styles from './Calendar.module.css';
import type { ScheduleSlot, PostDraft } from '../../types';
import { DraggableMiniCard } from '../DragDrop/DraggableMiniCard';

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

  const truncateTitle = (title: string, maxLength: number = 12) => {
    return title.length > maxLength ? title.slice(0, maxLength) + '...' : title;
  };

  return (
    <div
      className={`
        ${styles.day}
        ${isToday ? styles.today : ''}
        ${isSelected ? styles.selected : ''}
        ${isPast ? styles.past : ''}
        ${isWeekView ? styles.weekViewDay : ''}
        ${posts.length > 0 ? styles.hasEvents : ''}
      `}
      onClick={onClick}
    >
      <span className={styles.dayNumber}>{dayNumber}</span>
      
      {posts.length > 0 && (
        <div className={styles.postsContainer}>
          {isWeekView ? (
            // Week view shows full post details (also draggable)
            posts.slice(0, 4).map(post => (
              <DraggableMiniCard
                key={post.scheduleSlot.id}
                post={post}
                onClick={() => onPostClick?.(post)}
                statusClass={getStatusClass(post.scheduleSlot.status)}
                truncatedTitle={post.project?.title || 'Untitled'}
              />
            ))
          ) : (
            // Month view shows mini cards with truncated title
            <div className={styles.miniCards}>
              {posts.slice(0, 2).map(post => (
                <DraggableMiniCard
                  key={post.scheduleSlot.id}
                  post={post}
                  onClick={() => onPostClick?.(post)}
                  statusClass={getStatusClass(post.scheduleSlot.status)}
                  truncatedTitle={truncateTitle(post.project?.title || 'Untitled', 18)}
                />
              ))}
              {posts.length > 2 && (
                <div className={styles.moreCount}>+{posts.length - 2} more</div>
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
