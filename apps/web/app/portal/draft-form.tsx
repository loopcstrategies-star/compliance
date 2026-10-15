'use client';

import { useState } from 'react';

type Column = { key: string; label: string };

type Field = {
  fieldKey: string;
  label: string;
  widget: string;
  repeatable: boolean;
  required: boolean;
  options: string[] | null;
  columns: Column[] | null;
};

type Template = {
  templateId: string;
  title: string;
  fields: Field[];
};

export type Draft = {
  application: { id: string; customerType: string; status: string; documentVersion: number };
  templates: Template[];
  extras: { id: string; label: string; fieldKey: string }[];
  answers: Record<string, unknown>;
};

export function DraftForm({ draft }: { draft: Draft }) {
  const [answers, setAnswers] = useState(draft.answers);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function setValue(fieldKey: string, value: unknown) {
    setAnswers((current) => ({ ...current, [fieldKey]: value }));
  }

  async function save() {
    setMessage('');
    setError('');
    const response = await fetch(`/api/applications/${draft.application.id}/answers`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (!response.ok) {
      setError('The draft was not saved.');
      return;
    }
    const body = (await response.json()) as Draft;
    setAnswers(body.answers);
    setMessage('Draft saved.');
  }

  return (
    <div>
      <p className="notice">
        {draft.application.customerType.replaceAll('_', ' ')} · {draft.application.status}
      </p>
      {draft.templates.map((template) => (
        <section key={template.templateId}>
          <h2>{template.title}</h2>
          {template.fields.map((field) => (
            <FieldInput key={field.fieldKey} field={field} value={answers[field.fieldKey]} onChange={setValue} />
          ))}
        </section>
      ))}
      {draft.extras.length > 0 ? (
        <section>
          <h2>Additional checklist</h2>
          {draft.extras.map((extra) => (
            <label key={extra.id}>
              {extra.label}
              <input
                value={typeof answers[extra.fieldKey] === 'string' ? (answers[extra.fieldKey] as string) : ''}
                onChange={(event) => setValue(extra.fieldKey, event.target.value)}
              />
            </label>
          ))}
        </section>
      ) : null}
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="button" onClick={save}>
        Save draft
      </button>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (fieldKey: string, value: unknown) => void;
}) {
  const required = field.required ? ' (required)' : '';
  if (field.repeatable) {
    const columns = field.columns ?? [];
    const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [];
    return (
      <fieldset>
        <legend>
          {field.label}
          {required}
        </legend>
        {rows.map((row, index) => (
          <div key={index} className="row">
            {columns.map((column) => (
              <label key={column.key}>
                {column.label}
                <input
                  value={row[column.key] ?? ''}
                  onChange={(event) => {
                    const next = rows.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, [column.key]: event.target.value } : item,
                    );
                    onChange(field.fieldKey, next);
                  }}
                />
              </label>
            ))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange(field.fieldKey, [...rows, Object.fromEntries(columns.map((column) => [column.key, '']))])}
        >
          Add row
        </button>
      </fieldset>
    );
  }

  if (field.widget === 'yes_no') {
    return (
      <label>
        {field.label}
        {required}
        <select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(field.fieldKey, event.target.value)}>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
    );
  }

  if (field.widget === 'yes_no_comments' || field.widget === 'yes_no_details' || field.widget === 'duration_comments') {
    const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
    const primary = field.widget === 'duration_comments' ? 'duration' : 'answer';
    const secondary = field.widget === 'yes_no_details' ? 'details' : 'comments';
    return (
      <fieldset>
        <legend>
          {field.label}
          {required}
        </legend>
        {field.widget === 'duration_comments' ? (
          <label>
            Duration
            <input value={record.duration ?? ''} onChange={(event) => onChange(field.fieldKey, { ...record, duration: event.target.value })} />
          </label>
        ) : (
          <label>
            Answer
            <select value={record.answer ?? ''} onChange={(event) => onChange(field.fieldKey, { ...record, answer: event.target.value })}>
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        )}
        <label>
          {secondary === 'details' ? 'Details' : 'Comments'}
          <textarea value={record[secondary] ?? ''} onChange={(event) => onChange(field.fieldKey, { ...record, [primary]: record[primary] ?? '', [secondary]: event.target.value })} />
        </label>
      </fieldset>
    );
  }

  if (field.widget === 'single_choice') {
    return (
      <label>
        {field.label}
        {required}
        <select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(field.fieldKey, event.target.value)}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.widget === 'multi_checkbox') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset>
        <legend>
          {field.label}
          {required}
        </legend>
        {(field.options ?? []).map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) => {
                const next = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                onChange(field.fieldKey, next);
              }}
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }

  if (field.widget === 'declaration') {
    return (
      <label>
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(field.fieldKey, event.target.checked)} />
        {field.label}
        {required}
      </label>
    );
  }

  return (
    <label>
      {field.label}
      {required}
      <input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(field.fieldKey, event.target.value)} />
    </label>
  );
}
