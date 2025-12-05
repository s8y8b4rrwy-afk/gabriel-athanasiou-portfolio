import { useDrag } from 'react-dnd';
import type { Project } from '../../types';
import { ProjectCard } from '../ProjectList/ProjectCard';

export const ITEM_TYPES = {
  PROJECT: 'project',
  SCHEDULED_POST: 'scheduled_post',
} as const;

interface DragItem {
  type: typeof ITEM_TYPES.PROJECT;
  project: Project;
}

interface DraggableProjectCardProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
  scheduledCount?: number;
}

export function DraggableProjectCard({
  project,
  isSelected,
  onClick,
  scheduledCount = 0,
}: DraggableProjectCardProps) {
  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: ITEM_TYPES.PROJECT,
    item: { type: ITEM_TYPES.PROJECT, project },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [project]);

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <ProjectCard
        project={project}
        isSelected={isSelected}
        onClick={onClick}
        scheduledCount={scheduledCount}
      />
    </div>
  );
}
