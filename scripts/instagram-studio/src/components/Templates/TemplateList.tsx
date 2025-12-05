import type { RecurringTemplate } from '../../types/template';
import styles from './Templates.module.css';

interface TemplateListProps {
  templates: RecurringTemplate[];
  onSelect: (template: RecurringTemplate) => void;
  onToggleActive: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCreate: () => void;
}

export function TemplateList({
  templates,
  onSelect,
  onToggleActive,
  onDuplicate,
  onCreate,
}: TemplateListProps) {
  const formatFrequency = (template: RecurringTemplate): string => {
    const { frequency, daysOfWeek, timeSlots } = template.schedule;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let freq = frequency.charAt(0).toUpperCase() + frequency.slice(1);
    if (daysOfWeek && daysOfWeek.length > 0) {
      freq += ` on ${daysOfWeek.map((d) => days[d]).join(', ')}`;
    }
    if (timeSlots.length > 0) {
      freq += ` at ${timeSlots.join(', ')}`;
    }
    return freq;
  };

  return (
    <div className={styles.templateList}>
      <div className={styles.templateHeader}>
        <h3>📝 Recurring Templates</h3>
        <button className={styles.createButton} onClick={onCreate}>
          + New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <p>No templates yet</p>
          <p className={styles.emptyHint}>
            Create templates to automate your posting schedule
          </p>
        </div>
      ) : (
        <div className={styles.templates}>
          {templates.map((template) => (
            <div
              key={template.id}
              className={`${styles.templateCard} ${template.isActive ? styles.active : ''}`}
            >
              <div className={styles.templateInfo} onClick={() => onSelect(template)}>
                <div className={styles.templateName}>
                  <span className={styles.templateStatus}>
                    {template.isActive ? '🟢' : '⚪'}
                  </span>
                  {template.name}
                </div>
                <div className={styles.templateDescription}>
                  {template.description || formatFrequency(template)}
                </div>
                <div className={styles.templateMeta}>
                  <span>📷 {template.imageSelection}</span>
                  <span>🏷️ {template.hashtagGroups.length} groups</span>
                </div>
              </div>
              <div className={styles.templateActions}>
                <button
                  className={styles.toggleButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleActive(template.id);
                  }}
                  title={template.isActive ? 'Deactivate' : 'Activate'}
                >
                  {template.isActive ? '⏸️' : '▶️'}
                </button>
                <button
                  className={styles.duplicateButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(template.id);
                  }}
                  title="Duplicate"
                >
                  📋
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
