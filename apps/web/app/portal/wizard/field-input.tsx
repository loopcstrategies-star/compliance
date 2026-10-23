'use client';

import type { Field } from './types';

export function FieldInput({
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
      <fieldset className="wizard-fieldset">
        <legend>
          {field.label}
          {required}
        </legend>
        {rows.map((row, index) => (
          <div key={index} className="wizard-repeat-row">
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
            <button
              type="button"
              className="button-link button-link--outline"
              onClick={() => onChange(field.fieldKey, rows.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove row
            </button>
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
    const showSecondary =
      field.widget === 'duration_comments' ||
      record.answer === 'no' ||
      record.answer === 'n/a' ||
      record.answer === 'yes' ||
      Boolean(record[secondary]);
    return (
      <fieldset className="wizard-fieldset">
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
              {field.widget === 'yes_no_comments' ? <option value="n/a">N/A</option> : null}
            </select>
          </label>
        )}
        {showSecondary ? (
          <label>
            {secondary === 'details' ? 'Details' : 'Comments / explanation'}
            <textarea
              value={record[secondary] ?? ''}
              onChange={(event) =>
                onChange(field.fieldKey, { ...record, [primary]: record[primary] ?? '', [secondary]: event.target.value })
              }
            />
          </label>
        ) : null}
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
      <fieldset className="wizard-fieldset">
        <legend>
          {field.label}
          {required}
        </legend>
        {(field.options ?? []).map((option) => (
          <label key={option} className="wizard-check">
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
      <label className="wizard-check wizard-declaration">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(field.fieldKey, event.target.checked)} />
        <span>
          {field.label}
          {required}
        </span>
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
