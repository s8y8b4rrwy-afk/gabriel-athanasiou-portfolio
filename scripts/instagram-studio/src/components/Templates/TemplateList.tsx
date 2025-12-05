import type { RecurringTemplate } from '../../types/template';
import styles from './Templates.module.css';

interface TemplateListProps {
  templates: RecurringTemplate[];
  defaultTemplate: RecurringTemplate;
  onSelect: (template: RecurringTemplate) => void;
  onDuplicate: (id: string) => void;
  onCreate: () => void;
}

export function TemplateList({
  templates,
  defaultTemplate,
  onSelect,
  onDuplicate,
  onCreate,
}: TemplateListProps) {
  return (
    <div className={styles.templateList}>
      <div className={styles.templateHeader}>
        <h3>📝 Post Templates</h3>
        <button className={styles.createButton} onClick={onCreate}>
          + New Template
        </button>
      </div>

      <div className={styles.templates}>
        {/* Default Template - Always shown first */}
        <div
          className={`${styles.templateCard} ${styles.defaultTemplate}`}
          onClick={() => onSelect(defaultTemplate)}
        >
          <div className={styles.templateInfo}>
            <div className={styles.templateName}>
              ⭐ {defaultTemplate.name}
            </div>
            {defaultTemplate.description && (
              <div className={styles.templateDescription}>
                {defaultTemplate.description}
              </div>
            )}
            <div className={styles.templateMeta}>
              <span>🏷️ {defaultTemplate.hashtagGroups.length} hashtag groups</span>
            </div>
          </div>
          <div className={styles.templateActions}>
            <button
              className={styles.duplicateButton}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(defaultTemplate.id);
              }}
              title="Duplicate"
            >
              📋
            </button>
          </div>
        </div>

        {/* Custom Templates */}
        {templates.map((template) => (
          <div
            key={template.id}
            className={styles.templateCard}
            onClick={() => onSelect(template)}
          >
            <div className={styles.templateInfo}>
              <div className={styles.templateName}>
                {template.name}
              </div>
              {template.description && (
                <div className={styles.templateDescription}>
                  {template.description}
                </div>
              )}
              <div className={styles.templateMeta}>
                <span>🏷️ {template.hashtagGroups.length} hashtag groups</span>
              </div>
            </div>
            <div className={styles.templateActions}>
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
    </div>
  );
}
