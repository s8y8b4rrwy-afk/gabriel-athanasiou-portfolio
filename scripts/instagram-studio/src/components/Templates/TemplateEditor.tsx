import { useState } from 'react';
import type { RecurringTemplate, HashtagGroupKey } from '../../types/template';
import { CAPTION_TEMPLATES, HASHTAG_GROUPS } from '../../types/template';
import styles from './Templates.module.css';

interface TemplateEditorProps {
  template: RecurringTemplate;
  onSave: (updates: Partial<RecurringTemplate>) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export function TemplateEditor({ template, onSave, onCancel, onDelete }: TemplateEditorProps) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [captionTemplate, setCaptionTemplate] = useState(template.captionTemplate);
  const [hashtagGroups, setHashtagGroups] = useState<HashtagGroupKey[]>(
    template.hashtagGroups as HashtagGroupKey[]
  );

  const handleSave = () => {
    onSave({
      name,
      description,
      captionTemplate,
      hashtagGroups,
    });
  };

  const toggleHashtagGroup = (group: HashtagGroupKey) => {
    setHashtagGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const loadPresetCaption = (preset: keyof typeof CAPTION_TEMPLATES) => {
    setCaptionTemplate(CAPTION_TEMPLATES[preset]);
  };

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h3>Edit Template</h3>
        <div className={styles.editorActions}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.deleteButton} onClick={onDelete}>
            Delete
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      <div className={styles.editorContent}>
        {/* Basic Info */}
        <section className={styles.section}>
          <h4>Basic Info</h4>
          <div className={styles.field}>
            <label>Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Project Spotlight, Throwback Thursday"
            />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of when to use this template"
            />
          </div>
        </section>

        {/* Caption Template */}
        <section className={styles.section}>
          <h4>Caption Template</h4>
          <p className={styles.sectionHint}>
            Use placeholders that will be replaced with project data when applied.
          </p>
          <div className={styles.presetButtons}>
            {Object.keys(CAPTION_TEMPLATES).map((preset) => (
              <button
                key={preset}
                className={styles.presetButton}
                onClick={() => loadPresetCaption(preset as keyof typeof CAPTION_TEMPLATES)}
              >
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </button>
            ))}
          </div>
          <div className={styles.field}>
            <textarea
              value={captionTemplate}
              onChange={(e) => setCaptionTemplate(e.target.value)}
              rows={12}
              placeholder="Caption template with {placeholders}"
            />
            <div className={styles.hint}>
              <strong>Placeholders:</strong> {'{title}'}, {'{year}'}, {'{description}'}, {'{credits}'}, 
              {'{awards}'}, {'{client}'}, {'{productionCompany}'}, {'{type}'}, {'{genre}'}
            </div>
          </div>
        </section>

        {/* Hashtag Groups */}
        <section className={styles.section}>
          <h4>Hashtag Groups</h4>
          <p className={styles.sectionHint}>
            Select hashtag groups to include when this template is applied.
          </p>
          <div className={styles.hashtagGroups}>
            {(Object.keys(HASHTAG_GROUPS) as HashtagGroupKey[]).map((group) => (
              <button
                key={group}
                className={`${styles.hashtagGroupButton} ${
                  hashtagGroups.includes(group) ? styles.active : ''
                }`}
                onClick={() => toggleHashtagGroup(group)}
              >
                <span className={styles.groupName}>{group}</span>
                <span className={styles.groupCount}>
                  {HASHTAG_GROUPS[group].length} tags
                </span>
              </button>
            ))}
          </div>
          {hashtagGroups.length > 0 && (
            <div className={styles.selectedTags}>
              <strong>Selected hashtags:</strong>
              <div className={styles.tagPreview}>
                {hashtagGroups.map((group) => 
                  HASHTAG_GROUPS[group]?.join(' ')
                ).join(' ')}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
