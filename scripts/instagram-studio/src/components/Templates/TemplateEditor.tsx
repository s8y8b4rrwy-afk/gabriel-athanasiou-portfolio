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

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const IMAGE_SELECTION_OPTIONS = [
  { value: 'hero', label: 'Hero image only' },
  { value: 'first', label: 'First gallery image' },
  { value: 'all', label: 'All images (up to max)' },
  { value: 'random', label: 'Random selection' },
];

export function TemplateEditor({ template, onSave, onCancel, onDelete }: TemplateEditorProps) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [captionTemplate, setCaptionTemplate] = useState(template.captionTemplate);
  const [hashtagGroups, setHashtagGroups] = useState<string[]>(template.hashtagGroups);
  const [frequency, setFrequency] = useState(template.schedule.frequency);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(template.schedule.daysOfWeek || []);
  const [timeSlots, setTimeSlots] = useState(template.schedule.timeSlots);
  const [imageSelection, setImageSelection] = useState(template.imageSelection);
  const [maxImages, setMaxImages] = useState(template.maxImages);
  const [excludePosted, setExcludePosted] = useState(template.projectFilters?.excludePosted ?? true);

  const handleSave = () => {
    onSave({
      name,
      description,
      captionTemplate,
      hashtagGroups,
      schedule: {
        frequency,
        daysOfWeek: frequency !== 'daily' ? daysOfWeek : undefined,
        timeSlots,
      },
      imageSelection,
      maxImages,
      projectFilters: {
        ...template.projectFilters,
        excludePosted,
      },
    });
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const toggleHashtagGroup = (group: string) => {
    setHashtagGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const addTimeSlot = () => {
    setTimeSlots((prev) => [...prev, '12:00']);
  };

  const removeTimeSlot = (index: number) => {
    setTimeSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index: number, value: string) => {
    setTimeSlots((prev) => prev.map((t, i) => (i === index ? value : t)));
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
              placeholder="Enter template name"
            />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
            />
          </div>
        </section>

        {/* Caption Template */}
        <section className={styles.section}>
          <h4>Caption Template</h4>
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
              Available placeholders: {'{title}'}, {'{year}'}, {'{description}'}, {'{credits}'}, 
              {'{awards}'}, {'{client}'}, {'{productionCompany}'}, {'{hashtags}'}
            </div>
          </div>
        </section>

        {/* Hashtag Groups */}
        <section className={styles.section}>
          <h4>Hashtag Groups</h4>
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
          <div className={styles.selectedTags}>
            {hashtagGroups.map((group) => (
              <div key={group} className={styles.tagGroup}>
                <strong>{group}:</strong> {HASHTAG_GROUPS[group as HashtagGroupKey]?.join(' ')}
              </div>
            ))}
          </div>
        </section>

        {/* Schedule */}
        <section className={styles.section}>
          <h4>Schedule</h4>
          <div className={styles.field}>
            <label>Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {frequency !== 'daily' && (
            <div className={styles.field}>
              <label>Days of Week</label>
              <div className={styles.daysOfWeek}>
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    className={`${styles.dayButton} ${
                      daysOfWeek.includes(day.value) ? styles.active : ''
                    }`}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label>Posting Times</label>
            <div className={styles.timeSlots}>
              {timeSlots.map((time, index) => (
                <div key={index} className={styles.timeSlot}>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTimeSlot(index, e.target.value)}
                  />
                  {timeSlots.length > 1 && (
                    <button
                      className={styles.removeTimeButton}
                      onClick={() => removeTimeSlot(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button className={styles.addTimeButton} onClick={addTimeSlot}>
                + Add Time
              </button>
            </div>
          </div>
        </section>

        {/* Image Selection */}
        <section className={styles.section}>
          <h4>Image Selection</h4>
          <div className={styles.field}>
            <label>Selection Mode</label>
            <select
              value={imageSelection}
              onChange={(e) => setImageSelection(e.target.value as typeof imageSelection)}
            >
              {IMAGE_SELECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Max Images (for carousel)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxImages}
              onChange={(e) => setMaxImages(parseInt(e.target.value) || 1)}
            />
          </div>
        </section>

        {/* Filters */}
        <section className={styles.section}>
          <h4>Project Filters</h4>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={excludePosted}
              onChange={(e) => setExcludePosted(e.target.checked)}
            />
            <span>Exclude already posted projects</span>
          </label>
        </section>
      </div>
    </div>
  );
}
