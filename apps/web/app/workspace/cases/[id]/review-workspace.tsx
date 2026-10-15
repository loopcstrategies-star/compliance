'use client';

import { useState } from 'react';

type Field = { fieldKey: string; label: string; value: unknown };
type DocumentRow = { id: string; fieldKey: string; fileId: string; expiresOn: string | null };
type PackageRow = { id: string; templateId: string; version: number; fileId: string; blocked: unknown };
type Decision = { id: string; stage: string; outcome: string; reason: string; createdAt: string; actor: string; documentVersion: number };

export type Dossier = {
  id: string;
  status: string;
  documentVersion: number;
  createdAt: string;
  statusChangedAt: string;
  legalName: string;
  customerType: string;
  assignee: string;
  sections: Record<string, Field[]>;
  documents: DocumentRow[];
  packages: PackageRow[];
  submissions: { id: string; documentVersion: number; createdAt: string }[];
  decisions: Decision[];
};

const TABS = [
  ['overview', 'Overview'],
  ['kyc', 'KYC form'],
  ['ownership', 'Ownership'],
  ['pep', 'PEP and AML'],
  ['financial', 'Supply chain and bank'],
  ['documents', 'Documents'],
  ['packages', 'Generated forms'],
  ['review', 'Review'],
  ['history', 'History'],
] as const;

export function ReviewWorkspace({ dossier, review }: { dossier: Dossier; review: React.ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('overview');
  return (
    <section>
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <div className="panel">
          <p>Reference {dossier.id}</p>
          <p>
            {dossier.legalName} · {dossier.customerType.replaceAll('_', ' ')} · {dossier.status.replaceAll('_', ' ')}
          </p>
          <p>Opened {new Date(dossier.createdAt).toLocaleString()}</p>
          <p>Assignee {dossier.assignee || 'unassigned'}</p>
          <p>Document version {dossier.documentVersion}</p>
        </div>
      ) : null}
      {tab === 'documents' ? <DocumentList rows={dossier.documents} /> : null}
      {tab === 'packages' ? <PackageList rows={dossier.packages} /> : null}
      {tab === 'review' ? review : null}
      {tab === 'history' ? <History dossier={dossier} /> : null}
      {tab !== 'overview' && tab !== 'documents' && tab !== 'packages' && tab !== 'review' && tab !== 'history' ? (
        <FieldList fields={dossier.sections[tab] ?? []} />
      ) : null}
    </section>
  );
}

function FieldList({ fields }: { fields: Field[] }) {
  if (fields.length === 0) {
    return <p className="notice">This section has no saved fields.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="queue">
        <thead>
          <tr>
            <th>Field</th>
            <th>Answer</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.fieldKey}>
              <td>{field.label}</td>
              <td>{formatValue(field.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentList({ rows }: { rows: DocumentRow[] }) {
  if (rows.length === 0) {
    return <p className="notice">No evidence has been uploaded.</p>;
  }
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id}>
          {row.fieldKey}
          {row.expiresOn ? ` · expires ${new Date(row.expiresOn).toLocaleDateString()}` : ''} · <a href={`/api/files/${row.fileId}`}>Download</a>
        </li>
      ))}
    </ul>
  );
}

function PackageList({ rows }: { rows: PackageRow[] }) {
  if (rows.length === 0) {
    return <p className="notice">No generated package is stored. Unresolved answer slots block a completed form.</p>;
  }
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id}>
          {row.templateId} version {row.version} · <a href={`/api/files/${row.fileId}`}>Download</a>
        </li>
      ))}
    </ul>
  );
}

function History({ dossier }: { dossier: Dossier }) {
  return (
    <ol>
      {dossier.submissions.map((item) => (
        <li key={item.id}>
          Submission version {item.documentVersion} at {new Date(item.createdAt).toLocaleString()}
        </li>
      ))}
      {dossier.decisions.map((item) => (
        <li key={item.id}>
          {item.actor} {item.outcome} at {item.stage} · {item.reason} · {new Date(item.createdAt).toLocaleString()}
        </li>
      ))}
      {dossier.submissions.length === 0 && dossier.decisions.length === 0 ? <li>No submission or decision is recorded.</li> : null}
    </ol>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
