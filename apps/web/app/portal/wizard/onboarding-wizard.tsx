'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DocumentsPanel } from '../documents-panel';
import { SubmitCase } from '../submit-case';
import { FieldInput } from './field-input';
import type { Draft, Field, SectionProgress } from './types';

const REVIEW_KEY = 'review';

export function OnboardingWizard({ draft }: { draft: Draft }) {
  const sections = useMemo(
    () => (draft.sections ?? []).filter((section) => section.applicable !== false),
    [draft.sections],
  );
  const [answers, setAnswers] = useState(draft.answers);
  const [sectionState, setSectionState] = useState<SectionProgress[]>(sections);
  const [activeKey, setActiveKey] = useState(draft.resumeSectionKey || sections[0]?.sectionKey || REVIEW_KEY);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [clientError, setClientError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const activeIndex = sections.findIndex((section) => section.sectionKey === activeKey);
  const isReview = activeKey === REVIEW_KEY;
  const activeSection = sections[activeIndex];
  const totalSteps = sections.length;
  const stepNumber = isReview ? totalSteps : Math.max(1, activeIndex + 1);

  const activeFields = useMemo(() => {
    if (!activeSection) {
      return [] as Field[];
    }
    const keys = new Set(activeSection.fieldKeys);
    return draft.templates.flatMap((template) => template.fields.filter((field) => keys.has(field.fieldKey)));
  }, [activeSection, draft.templates]);

  useEffect(() => {
    setAnswers(draft.answers);
    setSectionState(sections);
  }, [draft.answers, sections]);

  function setValue(fieldKey: string, value: unknown) {
    setAnswers((current) => {
      const next = { ...current, [fieldKey]: value };
      if (fieldKey.startsWith('rspolicy.ack.') && fieldKey !== 'rspolicy.ack.policy_version') {
        next['rspolicy.ack.policy_version'] = draft.policyVersion ?? String(draft.application.schemaVersion ?? 1);
      }
      scheduleAutosave(next);
      return next;
    });
    setSaveState('idle');
    setClientError('');
  }

  function scheduleAutosave(nextAnswers: Record<string, unknown>) {
    if (!activeSection || isReview) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void persistSection(activeSection.sectionKey, nextAnswers, false);
    }, 800);
  }

  async function persistSection(sectionKey: string, payloadAnswers: Record<string, unknown>, markComplete: boolean) {
    const section = sectionState.find((item) => item.sectionKey === sectionKey) ?? sections.find((item) => item.sectionKey === sectionKey);
    if (!section) {
      return false;
    }
    const bodyAnswers: Record<string, unknown> = {};
    for (const key of section.fieldKeys) {
      if (payloadAnswers[key] !== undefined) {
        bodyAnswers[key] = payloadAnswers[key];
      }
    }
    setSaveState('saving');
    setError('');
    const response = await fetch(`/api/applications/${draft.application.id}/sections/${encodeURIComponent(sectionKey)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: bodyAnswers, markComplete }),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { message?: string; missingAnswers?: string[] } | null;
      setSaveState('error');
      setError(
        detail?.missingAnswers?.length
          ? `Complete required fields before continuing: ${detail.missingAnswers.join(', ')}`
          : detail?.message || 'The section could not be saved. Your answers are still on this page — try again.',
      );
      return false;
    }
    const body = (await response.json()) as Draft;
    setAnswers(body.answers);
    if (body.sections) {
      setSectionState(body.sections.filter((item) => item.applicable !== false));
    }
    setSaveState('saved');
    return true;
  }

  function validateLocal(fields: Field[], current: Record<string, unknown>): string | null {
    for (const field of fields) {
      if (!field.required) {
        continue;
      }
      const value = current[field.fieldKey];
      if (value === undefined || value === null || value === '') {
        return `“${field.label}” is required.`;
      }
      if (field.widget === 'declaration' && value !== true) {
        return 'Please accept the declaration to continue.';
      }
    }
    return null;
  }

  async function saveAndNext() {
    if (!activeSection) {
      setActiveKey(REVIEW_KEY);
      return;
    }
    const localError = validateLocal(activeFields, answersRef.current);
    if (localError) {
      setClientError(localError);
      return;
    }
    const ok = await persistSection(activeSection.sectionKey, answersRef.current, true);
    if (!ok) {
      return;
    }
    const next = sections[activeIndex + 1];
    setActiveKey(next ? next.sectionKey : REVIEW_KEY);
    setClientError('');
  }

  async function saveAndExit() {
    if (activeSection) {
      await persistSection(activeSection.sectionKey, answersRef.current, false);
    }
  }

  function goBack() {
    if (isReview) {
      setActiveKey(sections[sections.length - 1]?.sectionKey ?? sections[0]?.sectionKey);
      return;
    }
    if (activeIndex > 0) {
      setActiveKey(sections[activeIndex - 1].sectionKey);
    }
  }

  const progressPct = Math.round(((isReview ? totalSteps : stepNumber - 1) / Math.max(totalSteps, 1)) * 100);

  return (
    <div className="onboarding-wizard">
      <aside className="wizard-nav" aria-label="Form sections">
        <h3>Onboarding forms</h3>
        <ol>
          {sectionState.map((section, index) => (
            <li key={section.sectionKey}>
              <button
                type="button"
                className={section.sectionKey === activeKey ? 'is-active' : undefined}
                onClick={() => setActiveKey(section.sectionKey)}
              >
                <span className={`wizard-status wizard-status--${section.status}`}>{statusLabel(section.status)}</span>
                <span>
                  {index + 1}. {section.title}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className={isReview ? 'is-active' : undefined} onClick={() => setActiveKey(REVIEW_KEY)}>
              <span className="wizard-status wizard-status--review">Review</span>
              <span>Review answers</span>
            </button>
          </li>
        </ol>
      </aside>

      <div className="wizard-main">
        <header className="wizard-progress-head">
          <p>
            Step {isReview ? totalSteps : stepNumber} of {totalSteps}
            {activeSection ? ` · ${activeSection.title}` : ' · Review answers'}
          </p>
          <div className="wizard-progress-bar" aria-hidden="true">
            <span style={{ width: `${isReview ? 100 : progressPct}%` }} />
          </div>
          <p className={`wizard-save-state wizard-save-state--${saveState}`} role="status">
            {saveState === 'saving' ? 'Saving…' : null}
            {saveState === 'saved' ? 'Draft saved.' : null}
            {saveState === 'error' ? 'Save failed.' : null}
            {saveState === 'idle' ? 'Changes save when you continue or pause typing.' : null}
          </p>
        </header>

        {error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : null}
        {clientError ? (
          <p className="notice error" role="alert">
            {clientError}
          </p>
        ) : null}

        {!isReview && activeSection ? (
          <section className="panel wizard-section-panel">
            <h2>{activeSection.title}</h2>
            {activeSection.sectionKey === 'kyc.management' ? (
              <ManagementSplit fields={activeFields} answers={answers} onChange={setValue} />
            ) : (
              activeFields.map((field) => (
                <FieldInput key={field.fieldKey} field={field} value={answers[field.fieldKey]} onChange={setValue} />
              ))
            )}
            {activeSection.sectionKey === 'kyc.docs' ? <DocumentsPanel draft={{ ...draft, answers }} /> : null}
            {activeSection.sectionKey === 'rspolicy' ? (
              <p className="notice">
                By completing this step you acknowledge the Responsible Sourcing Policy (version{' '}
                {draft.policyVersion ?? draft.application.schemaVersion ?? 1}). Acknowledgement is recorded only when you
                save this section.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="panel wizard-section-panel">
            <h2>Review answers</h2>
            <p className="notice">Check each section before submitting. Use Edit to return to a step.</p>
            {sectionState.map((section) => {
              const keys = new Set(section.fieldKeys);
              const fields = draft.templates.flatMap((template) => template.fields.filter((field) => keys.has(field.fieldKey)));
              return (
                <article key={section.sectionKey} className="wizard-review-block">
                  <header className="panel-head">
                    <h3>{section.title}</h3>
                    <button type="button" className="button-link button-link--outline" onClick={() => setActiveKey(section.sectionKey)}>
                      Edit
                    </button>
                  </header>
                  <p className={`wizard-status wizard-status--${section.status}`}>{statusLabel(section.status)}</p>
                  <dl className="wizard-review-dl">
                    {fields.slice(0, 8).map((field) => (
                      <div key={field.fieldKey}>
                        <dt>{field.label}</dt>
                        <dd>{formatAnswer(answers[field.fieldKey])}</dd>
                      </div>
                    ))}
                    {fields.length > 8 ? <p className="notice">{fields.length - 8} more fields in this section.</p> : null}
                  </dl>
                </article>
              );
            })}
            {sectionState.every((section) => section.status === 'completed') ? (
              <SubmitCase draft={{ ...draft, answers }} />
            ) : (
              <p className="notice">Complete every required section before submitting.</p>
            )}
          </section>
        )}

        <div className="wizard-actions">
          <button type="button" className="button-link button-link--outline" onClick={goBack} disabled={!isReview && activeIndex <= 0}>
            Back
          </button>
          <button type="button" className="button-link button-link--outline" onClick={() => void saveAndExit()} disabled={isReview}>
            Save and exit
          </button>
          {!isReview ? (
            <button type="button" onClick={() => void saveAndNext()}>
              Save &amp; Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ManagementSplit({
  fields,
  answers,
  onChange,
}: {
  fields: Field[];
  answers: Record<string, unknown>;
  onChange: (fieldKey: string, value: unknown) => void;
}) {
  const managementField = fields.find((item) => item.fieldKey === 'kyc.management.rows');
  if (!managementField) {
    return null;
  }
  const fieldKey = managementField.fieldKey;
  const rows = Array.isArray(answers[fieldKey]) ? (answers[fieldKey] as Record<string, string>[]) : [];
  const board = rows.filter((row) => (row.group || '').toLowerCase().includes('board'));
  const management = rows.filter((row) => !(row.group || '').toLowerCase().includes('board'));

  function updateGroup(groupLabel: string, groupRows: Record<string, string>[], otherRows: Record<string, string>[]) {
    const normalized = groupRows.map((row) => ({ ...row, group: groupLabel }));
    onChange(fieldKey, [...otherRows, ...normalized]);
  }

  return (
    <>
      <RepeatingTable
        title="Board of Directors"
        columns={managementField.columns ?? []}
        rows={board}
        onChange={(next) => updateGroup('Board of Directors', next, management)}
      />
      <RepeatingTable
        title="Management"
        columns={managementField.columns ?? []}
        rows={management}
        onChange={(next) => updateGroup('Management', next, board)}
      />
    </>
  );
}

function RepeatingTable({
  title,
  columns,
  rows,
  onChange,
}: {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const visibleColumns = columns.filter((column) => column.key !== 'group');
  return (
    <fieldset className="wizard-fieldset">
      <legend>{title}</legend>
      {rows.map((row, index) => (
        <div key={index} className="wizard-repeat-row">
          {visibleColumns.map((column) => (
            <label key={column.key}>
              {column.label}
              <input
                value={row[column.key] ?? ''}
                onChange={(event) => {
                  const next = rows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, [column.key]: event.target.value } : item,
                  );
                  onChange(next);
                }}
              />
            </label>
          ))}
          <button type="button" className="button-link button-link--outline" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            Remove row
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, Object.fromEntries(visibleColumns.map((column) => [column.key, '']))])}
      >
        Add row
      </button>
    </fieldset>
  );
}

function statusLabel(status: SectionProgress['status']): string {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function formatAnswer(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length ? `${value.length} row(s)` : '—';
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = [record.answer, record.details, record.comments, record.duration].filter(
      (part) => typeof part === 'string' && part.trim(),
    );
    if (parts.length) {
      return parts.join(' · ');
    }
    return JSON.stringify(value);
  }
  return String(value);
}
