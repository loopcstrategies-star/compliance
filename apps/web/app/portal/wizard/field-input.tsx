'use client';

import type { Field } from './types';

const PLACEHOLDERS: Record<string, string> = {
  'kyc.entity.name': 'Enter registered company name',
  'kyc.entity.registration_no': 'Enter registration number',
  'kyc.entity.legal_structure': 'Select legal structure',
  'kyc.entity.date_of_establishment': 'Select date',
  'kyc.entity.place_of_establishment': 'Enter place of establishment',
  'kyc.entity.business_type_activities': 'Describe business type and activities',
  'kyc.entity.corporate_website': 'https://',
  'kyc.entity.registered_office_address': 'Enter registered office address',
  'kyc.entity.business_address': 'Enter business address if different',
  'kyc.entity.city': 'Enter city',
  'kyc.entity.country': 'Select country',
  'kyc.entity.postal_code': 'Enter postal code or PO Box',
  'kyc.entity.telephone_fax': 'Enter telephone and fax',
  'kyc.entity.registered_email': 'name@company.com',
  'kyc.entity.contact_name': 'Enter contact person name',
  'kyc.entity.contact_phone': 'Enter phone number',
  'kyc.entity.contact_email': 'name@company.com',
  'kyc.entity.compliance_officer_name': 'Enter compliance officer name',
  'kyc.entity.compliance_officer_phone': 'Enter phone number',
  'kyc.entity.compliance_officer_email': 'name@company.com',
  'kyc.entity.years_in_business': 'Enter years in business',
  'kyc.entity.external_auditor': 'Enter external auditor',
  'kyc.entity.tax_reference_no': 'Enter tax reference number',
  'kyc.entity.main_market_scope': 'Enter geographical scope',
  'kyc.entity.main_market': 'Enter main market',
  'kyc.entity.gold_industry_tenure': 'Enter tenure in gold industry',
};

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (fieldKey: string, value: unknown) => void;
}) {
  const requiredMark = field.required ? <span className="wizard-required">(required)</span> : null;
  const placeholder = PLACEHOLDERS[field.fieldKey] ?? `Enter ${field.label.toLowerCase()}`;

  if (field.repeatable) {
    const columns = field.columns ?? [];
    const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [];
    return (
      <fieldset className="wizard-fieldset wizard-field wizard-field--wide">
        <legend>
          {field.label} {requiredMark}
        </legend>
        {rows.map((row, index) => (
          <div key={index} className="wizard-repeat-row">
            {columns.map((column) => (
              <label key={column.key} className="wizard-field">
                <span className="wizard-field-label">{column.label}</span>
                <input
                  value={row[column.key] ?? ''}
                  placeholder={column.label}
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
      <label className="wizard-field">
        <span className="wizard-field-label">
          {field.label} {requiredMark}
        </span>
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
      <fieldset className="wizard-fieldset wizard-field wizard-field--wide">
        <legend>
          {field.label} {requiredMark}
        </legend>
        {field.widget === 'duration_comments' ? (
          <label className="wizard-field">
            <span className="wizard-field-label">Duration</span>
            <input
              value={record.duration ?? ''}
              onChange={(event) => onChange(field.fieldKey, { ...record, duration: event.target.value })}
            />
          </label>
        ) : (
          <label className="wizard-field">
            <span className="wizard-field-label">Answer</span>
            <select value={record.answer ?? ''} onChange={(event) => onChange(field.fieldKey, { ...record, answer: event.target.value })}>
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              {field.widget === 'yes_no_comments' ? <option value="n/a">N/A</option> : null}
            </select>
          </label>
        )}
        {showSecondary ? (
          <label className="wizard-field">
            <span className="wizard-field-label">{secondary === 'details' ? 'Details' : 'Comments / explanation'}</span>
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
      <label className="wizard-field">
        <span className="wizard-field-label">
          {field.label} {requiredMark}
        </span>
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
      <fieldset className="wizard-fieldset wizard-field wizard-field--wide">
        <legend>
          {field.label} {requiredMark}
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
      <label className="wizard-check wizard-declaration wizard-field wizard-field--wide">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(field.fieldKey, event.target.checked)} />
        <span>
          {field.label} {requiredMark}
        </span>
      </label>
    );
  }

  const isDate = field.fieldKey.endsWith('date_of_establishment') || field.fieldKey.endsWith('.date');
  const isEmail = field.fieldKey.includes('email');
  const isUrl = field.fieldKey.includes('website');

  return (
    <label className="wizard-field">
      <span className="wizard-field-label">
        {field.label} {requiredMark}
      </span>
      <input
        type={isDate ? 'date' : isEmail ? 'email' : isUrl ? 'url' : 'text'}
        value={typeof value === 'string' ? value : ''}
        placeholder={isDate ? undefined : placeholder}
        onChange={(event) => onChange(field.fieldKey, event.target.value)}
      />
    </label>
  );
}
