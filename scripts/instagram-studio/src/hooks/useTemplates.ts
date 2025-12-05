import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { RecurringTemplate } from '../types/template';
import { DEFAULT_RECURRING_TEMPLATE } from '../types/template';

function generateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface UseTemplatesReturn {
  templates: RecurringTemplate[];
  createTemplate: (template?: Partial<RecurringTemplate>) => RecurringTemplate;
  updateTemplate: (id: string, updates: Partial<RecurringTemplate>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => RecurringTemplate | null;
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useLocalStorage<RecurringTemplate[]>(
    'instagram-studio-templates',
    []
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

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, [setTemplates]);

  const duplicateTemplate = useCallback((id: string): RecurringTemplate | null => {
    const original = templates.find((t) => t.id === id);
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
  }, [templates, setTemplates]);

  return {
    templates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  };
}
