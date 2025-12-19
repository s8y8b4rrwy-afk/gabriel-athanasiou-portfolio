import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { RecurringTemplate } from '../types/template';
import { DEFAULT_RECURRING_TEMPLATE, CAPTION_TEMPLATES } from '../types/template';

function generateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// The built-in default template with a fixed ID
const BUILT_IN_DEFAULT: RecurringTemplate = {
  id: 'default',
  name: 'Default',
  description: 'Standard Lemon Post caption format',
  captionTemplate: CAPTION_TEMPLATES.standard,
  hashtagGroups: ['base', 'london'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

interface UseTemplatesOptions {
  onDelete?: (templateId: string) => void;
}

interface UseTemplatesReturn {
  templates: RecurringTemplate[];
  defaultTemplate: RecurringTemplate;
  createTemplate: (template?: Partial<RecurringTemplate>) => RecurringTemplate;
  updateTemplate: (id: string, updates: Partial<RecurringTemplate>) => void;
  updateDefaultTemplate: (updates: Partial<RecurringTemplate>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => RecurringTemplate | null;
  importTemplates: (templates: RecurringTemplate[], defaultTemplate?: RecurringTemplate) => void;
}

export function useTemplates(options?: UseTemplatesOptions): UseTemplatesReturn {
  const [templates, setTemplates] = useLocalStorage<RecurringTemplate[]>(
    'instagram-studio-templates',
    []
  );
  
  const [defaultTemplate, setDefaultTemplate] = useLocalStorage<RecurringTemplate>(
    'instagram-studio-default-template',
    BUILT_IN_DEFAULT
  );

  const createTemplate = useCallback((
    partial?: Partial<RecurringTemplate>
  ): RecurringTemplate => {
    const now = new Date().toISOString();
    const template: RecurringTemplate = {
      ...DEFAULT_RECURRING_TEMPLATE,
      ...partial,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    setTemplates((prev) => [...prev, template]);
    return template;
  }, [setTemplates]);

  const updateTemplate = useCallback((
    id: string,
    updates: Partial<RecurringTemplate>
  ) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }, [setTemplates]);

  const updateDefaultTemplate = useCallback((
    updates: Partial<RecurringTemplate>
  ) => {
    setDefaultTemplate((prev) => ({
      ...prev,
      ...updates,
      id: 'default', // Always keep the default ID
      updatedAt: new Date().toISOString(),
    }));
  }, [setDefaultTemplate]);

  const deleteTemplate = useCallback((id: string) => {
    // Notify parent about deletion for cloud sync tracking
    options?.onDelete?.(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, [setTemplates, options]);

  const duplicateTemplate = useCallback((id: string): RecurringTemplate | null => {
    // Check if duplicating the default template
    const original = id === 'default' 
      ? defaultTemplate 
      : templates.find((t) => t.id === id);
    if (!original) return null;

    const now = new Date().toISOString();
    const duplicate: RecurringTemplate = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    setTemplates((prev) => [...prev, duplicate]);
    return duplicate;
  }, [templates, defaultTemplate, setTemplates]);

  // Import templates from synced data
  const importTemplates = useCallback((
    importedTemplates: RecurringTemplate[],
    importedDefaultTemplate?: RecurringTemplate
  ) => {
    if (importedTemplates && importedTemplates.length > 0) {
      setTemplates(importedTemplates);
    }
    if (importedDefaultTemplate) {
      setDefaultTemplate(importedDefaultTemplate);
    }
  }, [setTemplates, setDefaultTemplate]);

  return {
    templates,
    defaultTemplate,
    createTemplate,
    updateTemplate,
    updateDefaultTemplate,
    deleteTemplate,
    duplicateTemplate,
    importTemplates,
  };
}
