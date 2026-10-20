'use client';

import { FormEvent, useState } from 'react';
import { letterheadOwnerLabel } from '../../lib/brand-label';

type Template = {
  templateId: string;
  letterheadOwner: string;
  pageCount: number;
};

export function LetterheadForm({
  tenants,
  templates,
}: {
  tenants: { id: string; name: string }[];
  templates: Template[];
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [owners, setOwners] = useState(templates);

  async function saveOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const templateId = String(form.get('templateId'));
    const response = await fetch(`/api/templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ letterheadOwner: form.get('letterheadOwner') }),
    });
    if (!response.ok) {
      setError('The letterhead owner was not saved.');
      return;
    }
    const body = (await response.json()) as Template;
    setOwners((current) => current.map((item) => (item.templateId === body.templateId ? body : item)));
    setMessage(`Letterhead owner for ${body.templateId} is ${letterheadOwnerLabel(body.letterheadOwner)}.`);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const tenantId = String(form.get('tenantId'));
    const response = await fetch(`/api/tenants/${tenantId}/letterhead`, { method: 'POST', body: form });
    if (!response.ok) {
      setError('The letterhead image was not stored.');
      return;
    }
    setMessage('Tenant letterhead stored. It is drawn only when that document owner is customer and a measured rectangle exists.');
  }

  return (
    <div>
      <form onSubmit={saveOwner}>
        <h2>Letterhead owner</h2>
        <label>
          Document
          <select name="templateId" defaultValue={owners[0]?.templateId ?? ''}>
            {owners.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateId} ({letterheadOwnerLabel(template.letterheadOwner)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Owner
          <select name="letterheadOwner" defaultValue="myka">
            <option value="myka">LoopC</option>
            <option value="customer">Customer</option>
            <option value="none">None</option>
          </select>
        </label>
        {error ? <p className="notice error">{error}</p> : null}
        {message ? <p className="notice success">{message}</p> : null}
        <button type="submit">Save owner</button>
      </form>
      <form onSubmit={upload}>
        <h2>Tenant letterhead image</h2>
        <label>
          Tenant
          <select name="tenantId" required defaultValue={tenants[0]?.id ?? ''}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Image
          <input name="file" type="file" accept="image/jpeg,image/png" required />
        </label>
        <button type="submit">Upload letterhead</button>
      </form>
    </div>
  );
}
