'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentsPanel } from '../documents-panel';
import { SubmitCase } from '../submit-case';
import { FieldInput } from './field-input';
import { groupsForSection, isWideField, STEPPER_LABELS } from './section-groups';
import { createSectionSaveQueue, type SectionSaveQueue } from './section-save-queue';
import type { Draft, Field, SectionProgress } from './types';

const REVIEW_KEY = 'review';

export function OnboardingWizard({ draft }: { draft: Draft }) {
  const router = useRouter();
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
  const saveGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const sectionStateRef = useRef(sectionState);
  sectionStateRef.current = sectionState;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const activeSectionRef = useRef<SectionProgress | undefined>(undefined);
  const queueRef = useRef<SectionSaveQueue | null>(null);

  const activeIndex = sections.findIndex((section) => section.sectionKey === activeKey);
  const isReview = activeKey === REVIEW_KEY;
  const activeSection = sections[activeIndex];
  activeSectionRef.current = activeSection;
  const totalSteps = sections.length;
  const stepNumber = isReview ? totalSteps + 1 : Math.max(1, activeIndex + 1);
  const incompleteSections = sectionState.filter((section) => section.status !== 'completed').map((section) => section.title);

  const activeFields = useMemo(() => {
    if (!activeSection) {
      return [] as Field[];
    }
    const keys = new Set(activeSection.fieldKeys);
    return draft.templates.flatMap((template) => template.fields.filter((field) => keys.has(field.fieldKey)));
  }, [activeSection, draft.templates]);

  const fieldGroups = useMemo(() => {
    if (!activeSection) {
      return [];
    }
    return groupsForSection(activeSection.sectionKey, activeSection.title, activeFields);
  }, [activeSection, activeFields]);

  if (!queueRef.current) {
    queueRef.current = createSectionSaveQueue(async (request) => {
      const generation = ++saveGenerationRef.current;
      if (mountedRef.current) {
        setSaveState('saving');
        setError('');
      }
      try {
        const response = await fetch(
          `/api/applications/${draft.application.id}/sections/${encodeURIComponent(request.sectionKey)}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ answers: request.answers, markComplete: request.markComplete }),
          },
        );
        if (!response.ok) {
          if (mountedRef.current && generation === saveGenerationRef.current) {
            const detail = (await response.json().catch(() => null)) as { message?: string; missingAnswers?: string[] } | null;
            setSaveState('error');
            setError(
              detail?.missingAnswers?.length
                ? `Complete required fields before continuing: ${detail.missingAnswers.join(', ')}`
                : detail?.message || 'The section could not be saved. Your answers are still on this page — try again.',
            );
          }
          return { ok: false };
        }
        const body = (await response.json()) as Draft;
        if (!mountedRef.current || generation !== saveGenerationRef.current) {
          return { ok: true };
        }
        setAnswers(body.answers);
        if (body.sections) {
          setSectionState(body.sections.filter((item) => item.applicable !== false));
        }
        setSaveState('saved');
        return { ok: true };
      } catch {
        if (mountedRef.current && generation === saveGenerationRef.current) {
          setSaveState('error');
          setError('The section could not be saved. Your answers are still on this page — try again.');
        }
        return { ok: false };
      }
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

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

  function clearDebounce() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  function buildBodyAnswers(sectionKey: string, payloadAnswers: Record<string, unknown>): Record<string, unknown> | null {
    const section =
      sectionStateRef.current.find((item) => item.sectionKey === sectionKey) ??
      sectionsRef.current.find((item) => item.sectionKey === sectionKey);
    if (!section) {
      return null;
    }
    const bodyAnswers: Record<string, unknown> = {};
    for (const key of section.fieldKeys) {
      if (payloadAnswers[key] !== undefined) {
        bodyAnswers[key] = payloadAnswers[key];
      }
    }
    return bodyAnswers;
  }

  function scheduleAutosave(_nextAnswers: Record<string, unknown>) {
    const section = activeSectionRef.current;
    if (!section || activeKey === REVIEW_KEY) {
      return;
    }
    clearDebounce();
    // Read answersRef at fire time so the last keystroke wins after debounce.
    debounceRef.current = setTimeout(() => {
      void persistSection(section.sectionKey, answersRef.current, false);
    }, 800);
  }

  async function persistSection(sectionKey: string, payloadAnswers: Record<string, unknown>, markComplete: boolean) {
    const bodyAnswers = buildBodyAnswers(sectionKey, payloadAnswers);
    if (!bodyAnswers || !queueRef.current) {
      return false;
    }
    const result = await queueRef.current.enqueue({
      sectionKey,
      answers: bodyAnswers,
      markComplete,
    });
    // Superseded means a newer save owns the outcome; navigation paths drain then re-enqueue.
    if (result.superseded) {
      await queueRef.current.drain();
      return true;
    }
    return result.ok;
  }

  async function flushPending(markComplete: boolean) {
    clearDebounce();
    if (queueRef.current) {
      await queueRef.current.drain();
    }
    const section = activeSectionRef.current;
    if (!section || activeKey === REVIEW_KEY) {
      return true;
    }
    return persistSection(section.sectionKey, answersRef.current, markComplete);
  }

  async function retrySave() {
    const section = activeSectionRef.current;
    if (!section || activeKey === REVIEW_KEY) {
      return;
    }
    clearDebounce();
    await persistSection(section.sectionKey, answersRef.current, false);
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
    clearDebounce();
    if (queueRef.current) {
      await queueRef.current.drain();
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
    const ok = await flushPending(false);
    if (!ok) {
      return;
    }
    router.push('/portal/saved');
  }

  async function goBack() {
    const ok = await flushPending(false);
    if (!ok) {
      return;
    }
    if (isReview) {
      setActiveKey(sections[sections.length - 1]?.sectionKey ?? sections[0]?.sectionKey);
      return;
    }
    if (activeIndex > 0) {
      setActiveKey(sections[activeIndex - 1].sectionKey);
    }
  }

  async function goToSection(sectionKey: string) {
    if (sectionKey === activeKey) {
      return;
    }
    const ok = await flushPending(false);
    if (!ok) {
      return;
    }
    setActiveKey(sectionKey);
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Draft saved'
        : saveState === 'error'
          ? 'Save failed'
          : 'Draft';

  return (
    <div className="onboarding-wizard">
      <header className="wizard-page-head">
        <div>
          <h1>Customer Due Diligence Questionnaire</h1>
          <p>
            Complete all sections below. Your progress is saved automatically.
            {draft.application.status ? (
              <>
                {' '}
                Status: {draft.application.status.replaceAll('_', ' ')} · {draft.application.customerType.replaceAll('_', ' ')}.
              </>
            ) : null}
          </p>
        </div>
        <p className={`wizard-save-pill wizard-save-pill--${saveState}`} role="status">
          <span className="wizard-save-dot" aria-hidden="true" />
          {saveLabel}
        </p>
      </header>

      <nav className="wizard-stepper" aria-label="Form sections">
        <ol>
          {sectionState.map((section, index) => {
            const active = section.sectionKey === activeKey;
            const completed = section.status === 'completed';
            return (
              <li key={section.sectionKey}>
                <button
                  type="button"
                  className={[active ? 'is-active' : '', completed ? 'is-completed' : ''].filter(Boolean).join(' ') || undefined}
                  onClick={() => void goToSection(section.sectionKey)}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="wizard-step-num" aria-hidden="true">
                    {completed && !active ? '✓' : index + 1}
                  </span>
                  <span className="wizard-step-title">{STEPPER_LABELS[section.sectionKey] ?? section.title}</span>
                </button>
                <span className="wizard-step-arrow" aria-hidden="true" />
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={isReview ? 'is-active' : undefined}
              onClick={() => void goToSection(REVIEW_KEY)}
              aria-current={isReview ? 'step' : undefined}
            >
              <span className="wizard-step-num" aria-hidden="true">
                {totalSteps + 1}
              </span>
              <span className="wizard-step-title">Review</span>
            </button>
          </li>
        </ol>
      </nav>

      <p className="wizard-mobile-step">
        Step {stepNumber} of {totalSteps + 1}
        {activeSection ? ` · ${activeSection.title}` : ' · Review answers'}
      </p>

      {error ? (
        <p className="notice error" role="alert">
          {error}{' '}
          <button type="button" className="button-link" onClick={() => void retrySave()}>
            Retry
          </button>
        </p>
      ) : null}
      {clientError ? (
        <p className="notice error" role="alert">
          {clientError}
        </p>
      ) : null}

      <div className="wizard-main">
        {!isReview && activeSection ? (
          <>
            <h2 className="wizard-section-title">{activeSection.title}</h2>
            {activeSection.sectionKey === 'kyc.management' ? (
              <article className="wizard-card">
                <header className="wizard-card-head">
                  <h3>Management Structure</h3>
                </header>
                <div className="wizard-card-body wizard-card-body--stack">
                  <ManagementSplit fields={activeFields} answers={answers} onChange={setValue} />
                </div>
              </article>
            ) : (
              fieldGroups.map((group) => (
                <article key={group.title} className="wizard-card">
                  <header className="wizard-card-head">
                    <h3>{group.title}</h3>
                  </header>
                  <div className="wizard-card-body">
                    {group.fields.map((field) => (
                      <div key={field.fieldKey} className={isWideField(field) ? 'wizard-grid-span' : undefined}>
                        <FieldInput field={field} value={answers[field.fieldKey]} onChange={setValue} />
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
            {activeSection.sectionKey === 'kyc.docs' ? (
              <article className="wizard-card">
                <header className="wizard-card-head">
                  <h3>Document uploads</h3>
                </header>
                <div className="wizard-card-body wizard-card-body--stack">
                  <DocumentsPanel draft={{ ...draft, answers }} />
                </div>
              </article>
            ) : null}
            {activeSection.sectionKey === 'rspolicy' ? (
              <p className="notice">
                By completing this step you acknowledge the Responsible Sourcing Policy (version{' '}
                {draft.policyVersion ?? draft.application.schemaVersion ?? 1}). Acknowledgement is recorded only when you save
                this section.
              </p>
            ) : null}
          </>
        ) : (
          <section className="wizard-card">
            <header className="wizard-card-head">
              <h3>Review answers</h3>
            </header>
            <div className="wizard-card-body wizard-card-body--stack">
              <p className="notice">Check each section before submitting. Use Edit to return to a step.</p>
              {sectionState.map((section) => {
                const keys = new Set(section.fieldKeys);
                const fields = draft.templates.flatMap((template) =>
                  template.fields.filter((field) => keys.has(field.fieldKey)),
                );
                return (
                  <article key={section.sectionKey} className="wizard-review-block">
                    <header className="panel-head">
                      <h3>{section.title}</h3>
                      <button
                        type="button"
                        className="button-link button-link--outline"
                        onClick={() => void goToSection(section.sectionKey)}
                      >
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
              <SubmitCase
                draft={{ ...draft, answers }}
                incompleteSections={incompleteSections}
                onBeforeSubmit={() => flushPending(false)}
              />
            </div>
          </section>
        )}
      </div>

      <footer className="wizard-footer">
        <button type="button" className="wizard-btn-exit" onClick={() => void saveAndExit()} disabled={isReview}>
          Save and exit
        </button>
        <div className="wizard-footer-nav">
          <button
            type="button"
            className="wizard-btn-back"
            onClick={() => void goBack()}
            disabled={!isReview && activeIndex <= 0}
          >
            Back
          </button>
          {!isReview ? (
            <button type="button" className="wizard-btn-next" onClick={() => void saveAndNext()}>
              Next
            </button>
          ) : null}
        </div>
      </footer>
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
            <label key={column.key} className="wizard-field">
              <span className="wizard-field-label">{column.label}</span>
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
          <button
            type="button"
            className="button-link button-link--outline"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
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
