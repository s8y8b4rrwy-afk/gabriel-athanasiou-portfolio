import type { Project } from '../../types';
import { useCloudinaryUrl } from '../../hooks';
import './ProjectCard.css';

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
  scheduledCount?: number;
}

export function ProjectCard({ project, isSelected, onClick, scheduledCount = 0 }: ProjectCardProps) {
  const rawImageUrl = project.heroImage || project.gallery[0] || '';
  // Hero image is index 0, first gallery image is also index 0 (if no hero)
  const imageUrl = useCloudinaryUrl(rawImageUrl, project.id, 0);
  const hasImages = rawImageUrl || project.gallery.length > 0;
  const imageCount = project.gallery.length || (project.heroImage ? 1 : 0);

  return (
    <div
      className={`project-card ${isSelected ? 'project-card--selected' : ''} ${scheduledCount > 0 ? 'project-card--has-scheduled' : ''}`}
      onClick={onClick}
    >
      <div className="project-card-image">
        {hasImages ? (
          <img src={imageUrl} alt={project.title} loading="lazy" />
        ) : (
          <div className="project-card-no-image">
            <span>🎬</span>
          </div>
        )}
        {imageCount > 1 && (
          <span className="project-card-image-count">📷 {imageCount}</span>
        )}
        {project.isFeatured && (
          <span className="project-card-featured">⭐</span>
        )}
        {scheduledCount > 0 && (
          <span className="project-card-scheduled-badge">📅 {scheduledCount}</span>
        )}
      </div>
      <div className="project-card-content">
        <h3 className="project-card-title">{project.title}</h3>
        <div className="project-card-meta">
          <span className="project-card-year">{project.year}</span>
          <span className="project-card-type">{project.type}</span>
        </div>
        {project.kinds.length > 0 && (
          <div className="project-card-kinds">
            {project.kinds.slice(0, 2).map((kind) => (
              <span key={kind} className="project-card-kind">
                {kind}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
