'use client';

import { FormEvent, useState } from 'react';

export function TenantAdminForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const first = tenants[0]?.id ?? '';

  async function send(path: string, method: string, body: unknown) {
    setMessage('');
    setError('');
    const response = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      setError('The change was not saved.');
      return;
    }
    setMessage('Saved.');
  }

  return (
    <section>
      <h2>Tenant configuration</h2>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void send(`/api/tenants/${form.get('tenantId')}`, 'PATCH', { name: form.get('name') });
        }}
      >
        <label>
          Tenant
          <select name="tenantId" defaultValue={first}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input name="name" required />
        </label>
        <button type="submit">Rename tenant</button>
      </form>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void send(`/api/tenants/${form.get('tenantId')}/applicability`, 'POST', {
            customerType: form.get('customerType'),
            templateId: form.get('templateId'),
            required: form.get('required') === 'on',
          });
        }}
      >
        <h2>Required forms</h2>
        <label>
          Tenant
          <select name="tenantId" defaultValue={first}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Customer type
          <select name="customerType" defaultValue="local_company">
            <option value="local_company">Local company</option>
            <option value="foreign_company">Foreign company</option>
            <option value="mine">Mine</option>
            <option value="individual">Individual</option>
          </select>
        </label>
        <label>
          Template
          <select name="templateId" defaultValue="kyc">
            <option value="kyc">KYC</option>
            <option value="pep-declaration">PEP declaration</option>
            <option value="pep-questionnaire">PEP questionnaire</option>
            <option value="responsible-sourcing">Responsible sourcing</option>
          </select>
        </label>
        <label>
          <input name="required" type="checkbox" defaultChecked />
          Required
        </label>
        <button type="submit">Save requirement</button>
      </form>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const tenantId = String(form.get('tenantId'));
          const userId = String(form.get('userId'));
          const role = String(form.get('role'));
          const remove = form.get('remove') === 'on';
          void send(
            remove
              ? `/api/tenants/${tenantId}/users/${userId}/roles/${role}`
              : `/api/tenants/${tenantId}/users/${userId}/roles`,
            remove ? 'DELETE' : 'POST',
            remove ? undefined : { role },
          );
        }}
      >
        <h2>Staff access</h2>
        <label>
          Tenant
          <select name="tenantId" defaultValue={first}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          User id
          <input name="userId" required />
        </label>
        <label>
          Role
          <select name="role" defaultValue="maker">
            <option value="employee">Employee</option>
            <option value="maker">Maker</option>
            <option value="checker">Checker</option>
            <option value="authorised_approver">Authorised approver</option>
            <option value="super_admin">Super-admin</option>
          </select>
        </label>
        <label>
          <input name="remove" type="checkbox" />
          Remove this role
        </label>
        <button type="submit">Update role</button>
      </form>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void send(`/api/tenants/${form.get('tenantId')}/retention`, 'POST', {
            category: form.get('category'),
            retentionDays: Number(form.get('retentionDays')),
            effectiveFrom: form.get('effectiveFrom'),
          });
        }}
      >
        <h2>Retention</h2>
        <label>
          Tenant
          <select name="tenantId" defaultValue={first}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue="document">
            <option value="application">Application</option>
            <option value="document">Document</option>
            <option value="audit">Audit</option>
          </select>
        </label>
        <label>
          Days
          <input name="retentionDays" type="number" min={1} defaultValue={365} required />
        </label>
        <label>
          Effective from
          <input name="effectiveFrom" type="date" required />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <button type="submit">Save retention</button>
      </form>
    </section>
  );
}
