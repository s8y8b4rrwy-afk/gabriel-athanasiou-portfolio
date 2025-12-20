import { useDrop } from 'react-dnd';
import { ITEM_TYPES } from './DraggableProjectCard';
import type { ScheduledPost } from '../../types';
import styles from './DeleteDropZone.module.css';

interface DragItem {
  type: typeof ITEM_TYPES.SCHEDULED_POST;
  post: ScheduledPost;
}

interface DeleteDropZoneProps {
  onDelete: (slotId: string) => void;
  isVisible: boolean;
}

export function DeleteDropZone({ onDelete, isVisible }: DeleteDropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: ITEM_TYPES.SCHEDULED_POST,
    drop: (item) => {
      // Only delete pending/failed posts, not published ones
      if (item.post.scheduleSlot.status !== 'published') {
        onDelete(item.post.scheduleSlot.id);
      }
    },
    canDrop: (item) => item.post.scheduleSlot.status !== 'published',
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [onDelete]);

  if (!isVisible) return null;

  return (
    <div
      ref={drop}
      className={`${styles.deleteZone} ${isOver && canDrop ? styles.active : ''} ${canDrop ? styles.canDrop : ''}`}
    >
      <span className={styles.icon}>🗑️</span>
      <span className={styles.text}>
        {isOver && canDrop ? 'Release to delete' : 'Drop here to delete'}
      </span>
    </div>
  );
}
