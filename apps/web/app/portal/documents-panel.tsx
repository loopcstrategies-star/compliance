'use client';

import { useState } from 'react';
import type { Draft } from './draft-form';

const SIGNATURES = [
  { templateId: 'kyc', label: 'KYC signature' },
  { templateId: 'pep-declaration', label: 'PEP declaration signature' },
  { templateId: 'pep-questionnaire', label: 'PEP questionnaire signature' },
  { templateId: 'responsible-sourcing', label: 'Responsible sourcing signature' },
];

export function DocumentsPanel({ draft }: { draft: Draft }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const applicationId = draft.application.id;
  const checklist = draft.templates.flatMap((template) =>
    template.fields.filter((field) => field.fieldKey.startsWith('kyc.docs.')),
  );

  async function upload(path: string, form: FormData, success: string) {
    setMessage('');
    setError('');
    const response = await fetch(path, { method: 'POST', body: form });
    if (!response.ok) {
      setError('The file was not accepted.');
      return;
    }
    setMessage(success);
  }

  return (
    <section>
      <h2>Documents</h2>
      {checklist.map((field) => (
        <form
          key={field.fieldKey}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            data.set('fieldKey', field.fieldKey);
            void upload(`/api/applications/${applicationId}/documents`, data, `${field.fieldKey} uploaded.`);
          }}
        >
          <label>
            {field.label}
            {field.required ? ' (required)' : ''}
            <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
          </label>
          <button type="submit">Upload</button>
        </form>
      ))}
      {draft.extras.map((extra) => (
        <form
          key={extra.id}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            data.set('fieldKey', extra.fieldKey);
            void upload(`/api/applications/${applicationId}/documents`, data, `${extra.label} uploaded.`);
          }}
        >
          <label>
            {extra.label}
            <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
          </label>
          <button type="submit">Upload</button>
        </form>
      ))}
      <h2>Signature images</h2>
      <p>An uploaded signature is an image. It is not a qualified electronic signature, and it is not drawn while its placement rectangle is unresolved.</p>
      {SIGNATURES.filter((item) => draft.templates.some((template) => template.templateId === item.templateId)).map((item) => (
        <form
          key={item.templateId}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            data.set('templateId', item.templateId);
            data.set('authorised', 'true');
            data.set('consent', data.get('consent') === 'on' ? 'true' : 'false');
            void upload(`/api/applications/${applicationId}/signatures`, data, `${item.label} recorded.`);
          }}
        >
          <label>
            {item.label}
            <input name="file" type="file" accept="image/jpeg,image/png" required />
          </label>
          <label>
            <input name="consent" type="checkbox" required />
            I authorise use of this signature image. It is not a qualified electronic signature.
          </label>
          <button type="submit">Save signature</button>
        </form>
      ))}
      <h2>Generated packages</h2>
      {draft.templates.map((template) => (
        <div key={template.templateId}>
          <h3>{template.title}</h3>
          <button
            type="button"
            onClick={async () => {
              setError('');
              const response = await fetch(`/api/applications/${applicationId}/package-preview?templateId=${template.templateId}`);
              if (!response.ok) {
                setError('The preview was not available.');
                return;
              }
              const body = await response.json();
              const painted = body.pages.flatMap((page: { painted: unknown[] }) => page.painted).length;
              const blocked = body.pages[0]?.blocked?.length ?? 0;
              setPreview(`${template.title}: ${body.pageCount} pages, ${painted} painted slots, ${blocked} blocked slots.`);
            }}
          >
            Preview slots
          </button>
          <button
            type="button"
            onClick={async () => {
              setError('');
              const response = await fetch(`/api/applications/${applicationId}/packages`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ templateId: template.templateId }),
              });
              if (!response.ok) {
                setError('The package was not generated.');
                return;
              }
              const body = await response.json();
              const download = await fetch(`/api/files/${body.fileId}`);
              if (!download.ok) {
                setError('The package was not downloaded.');
                return;
              }
              const blob = await download.blob();
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `${template.templateId}.pdf`;
              link.click();
              URL.revokeObjectURL(url);
              setMessage(`${template.title} version ${body.version} downloaded.`);
            }}
          >
            Generate and download
          </button>
        </div>
      ))}
      {preview ? <p className="notice">{preview}</p> : null}
      {error ? <p className="notice">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
    </section>
  );
}
