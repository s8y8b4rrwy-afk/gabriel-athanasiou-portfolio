import { useState, useMemo } from 'react';
import type { Project } from '../../types';
import { ProjectFilters, type ScheduleStatus } from './ProjectFilters';
import { ProjectCard } from './ProjectCard';
import { DraggableProjectCard } from '../DragDrop/DraggableProjectCard';
import './ProjectList.css';

interface ProjectListProps {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  filters: {
    types: string[];
    kinds: string[];
    years: string[];
  };
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  scheduledCountByProject: Record<string, number>;
  publishedCountByProject: Record<string, number>;
  enableDragDrop?: boolean;
}

export function ProjectList({
  projects,
  isLoading,
  error,
  filters,
  selectedProject,
  onSelectProject,
  scheduledCountByProject,
  publishedCountByProject,
  enableDragDrop = false,
}: ProjectListProps) {
  const [filterType, setFilterType] = useState('');
  const [filterKind, setFilterKind] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Enhanced search function that searches all metadata
  const matchesSearchQuery = useMemo(() => {
    if (!searchQuery) return () => true;
    
    const query = searchQuery.toLowerCase();
    
    return (project: Project) => {
      // Basic fields
      if (project.title.toLowerCase().includes(query)) return true;
      if (project.description.toLowerCase().includes(query)) return true;
      if (project.client.toLowerCase().includes(query)) return true;
      if (project.type.toLowerCase().includes(query)) return true;
      if (project.productionCompany.toLowerCase().includes(query)) return true;
      if (project.year.toLowerCase().includes(query)) return true;
      if (project.slug.toLowerCase().includes(query)) return true;
      
      // Array fields
      if (project.kinds.some(k => k.toLowerCase().includes(query))) return true;
      if (project.genre.some(g => g.toLowerCase().includes(query))) return true;
      if (project.awards.some(a => a.toLowerCase().includes(query))) return true;
      
      // Credits - search by role and name
      if (project.credits.some(c => 
        c.role.toLowerCase().includes(query) || 
        c.name.toLowerCase().includes(query)
      )) return true;
      
      return false;
    };
  }, [searchQuery]);

  // Apply local filters
  const filteredProjects = projects.filter((project) => {
    if (filterType && project.type !== filterType) return false;
    if (filterKind && !project.kinds.includes(filterKind)) return false;
    if (filterYear && project.year !== filterYear) return false;
    
    // Schedule status filter
    if (scheduleStatus !== 'all') {
      const hasScheduled = (scheduledCountByProject[project.id] || 0) > 0;
      const hasPublished = (publishedCountByProject[project.id] || 0) > 0;
      
      if (scheduleStatus === 'scheduled' && !hasScheduled) return false;
      if (scheduleStatus === 'published' && !hasPublished) return false;
      if (scheduleStatus === 'unscheduled' && (hasScheduled || hasPublished)) return false;
    }
    
    // Enhanced search
    if (!matchesSearchQuery(project)) return false;
    
    return true;
  });

  // Sort projects by year (and maintain original order within same year)
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects].sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      return sortOrder === 'newest' ? yearB - yearA : yearA - yearB;
    });
    return sorted;
  }, [filteredProjects, sortOrder]);

  return (
    <div className="project-list">
      <ProjectFilters
        types={filters.types}
        kinds={filters.kinds}
        years={filters.years}
        selectedType={filterType}
        selectedKind={filterKind}
        selectedYear={filterYear}
        searchQuery={searchQuery}
        scheduleStatus={scheduleStatus}
        onTypeChange={setFilterType}
        onKindChange={setFilterKind}
        onYearChange={setFilterYear}
        onSearchChange={setSearchQuery}
        onScheduleStatusChange={setScheduleStatus}
      />

      <div className="project-list-content">
        {isLoading && (
          <div className="project-list-loading">
            <span>🍋</span>
            <p>Loading projects...</p>
          </div>
        )}

        {error && (
          <div className="project-list-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="project-list-header">
              <span className="project-list-count">
                {sortedProjects.length} project{sortedProjects.length !== 1 ? 's' : ''}
              </span>
              <button 
                className="sort-toggle"
                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                title={`Sorted by ${sortOrder === 'newest' ? 'newest first' : 'oldest first'}`}
              >
                {sortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
              </button>
            </div>

            <div className="project-list-items">
              {sortedProjects.map((project) => 
                enableDragDrop ? (
                  <DraggableProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => onSelectProject(project)}
                    scheduledCount={scheduledCountByProject[project.id] || 0}
                  />
                ) : (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => onSelectProject(project)}
                    scheduledCount={scheduledCountByProject[project.id] || 0}
                  />
                )
              )}

              {sortedProjects.length === 0 && (
                <div className="project-list-empty">
                  <span>🔍</span>
                  <p>No projects match your filters</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
