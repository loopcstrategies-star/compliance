export type Column = { key: string; label: string };

export type Field = {
  fieldKey: string;
  label: string;
  widget: string;
  repeatable: boolean;
  required: boolean;
  options: string[] | null;
  columns: Column[] | null;
};

export type Template = {
  templateId: string;
  title: string;
  fields: Field[];
};

export type SectionProgress = {
  sectionKey: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  completedAt: string | null;
  applicable: boolean;
  fieldKeys: string[];
};

export type Draft = {
  application: { id: string; customerType: string; status: string; documentVersion: number; schemaVersion?: number };
  templates: Template[];
  extras: { id: string; label: string; fieldKey: string }[];
  answers: Record<string, unknown>;
  sections?: SectionProgress[];
  resumeSectionKey?: string | null;
  policyVersion?: string;
  editable?: boolean;
  submittedAt?: string | null;
};
