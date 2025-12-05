import { useDrag } from 'react-dnd';
import type { ScheduleSlot, PostDraft } from '../../types';
import { ITEM_TYPES } from './DraggableProjectCard';
import styles from '../Calendar/Calendar.module.css';

interface ScheduledPost extends PostDraft {
  scheduleSlot: ScheduleSlot;
}

interface DragItem {
  type: typeof ITEM_TYPES.SCHEDULED_POST;
  post: ScheduledPost;
}

interface DraggableMiniCardProps {
  post: ScheduledPost;
  onClick?: () => void;
  statusClass: string;
  truncatedTitle: string;
}

export function DraggableMiniCard({
  post,
  onClick,
  statusClass,
  truncatedTitle,
}: DraggableMiniCardProps) {
  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: ITEM_TYPES.SCHEDULED_POST,
    item: { type: ITEM_TYPES.SCHEDULED_POST, post },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [post]);

  return (
    <div
      ref={drag}
      className={`${styles.miniCard} ${statusClass}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={`${post.project.title} at ${post.scheduleSlot.scheduledTime}`}
    >
      <span className={styles.miniTitle}>{truncatedTitle}</span>
    </div>
  );
}
