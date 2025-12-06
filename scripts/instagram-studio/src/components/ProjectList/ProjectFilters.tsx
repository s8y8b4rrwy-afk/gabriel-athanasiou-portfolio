import './ProjectFilters.css';

export type ScheduleStatus = 'all' | 'scheduled' | 'published' | 'unscheduled';

interface ProjectFiltersProps {
  types: string[];
  kinds: string[];
  years: string[];
  selectedType: string;
  selectedKind: string;
  selectedYear: string;
  searchQuery: string;
  scheduleStatus: ScheduleStatus;
  onTypeChange: (type: string) => void;
  onKindChange: (kind: string) => void;
  onYearChange: (year: string) => void;
  onSearchChange: (query: string) => void;
  onScheduleStatusChange: (status: ScheduleStatus) => void;
}

export function ProjectFilters({
  types,
  kinds,
  years,
  selectedType,
  selectedKind,
  selectedYear,
  searchQuery,
  scheduleStatus,
  onTypeChange,
  onKindChange,
  onYearChange,
  onSearchChange,
  onScheduleStatusChange,
}: ProjectFiltersProps) {
  return (
    <div className="project-filters">
      <div className="filter-search">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="filter-input"
        />
        {searchQuery && (
          <button 
            className="filter-clear"
            onClick={() => onSearchChange('')}
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="filter-row">
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="filter-select"
        >
          <option value="">Type</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={selectedKind}
          onChange={(e) => onKindChange(e.target.value)}
          className="filter-select"
        >
          <option value="">Kind</option>
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
          className="filter-select"
        >
          <option value="">Year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={scheduleStatus}
          onChange={(e) => onScheduleStatusChange(e.target.value as ScheduleStatus)}
          className="filter-select filter-select-schedule"
        >
          <option value="all">Status</option>
          <option value="scheduled">📅 Scheduled</option>
          <option value="published">✅ Published</option>
          <option value="unscheduled">⏳ Unscheduled</option>
        </select>
      </div>
    </div>
  );
}
