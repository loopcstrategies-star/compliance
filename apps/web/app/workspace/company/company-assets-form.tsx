'use client';

import { FormEvent, useMemo, useState } from 'react';

type AssetType = 'logo' | 'stamp' | 'letterhead' | 'authorised_signature';
export type CompanyAssetSummary = {
  assetType: AssetType;
  fileId: string;
  mediaType: string;
  byteSize: number;
  uploadedAt: string;
};

const ASSET_FIELDS: { assetType: AssetType; title: string }[] = [
  { assetType: 'logo', title: 'Company logo' },
  { assetType: 'stamp', title: 'Company stamp' },
  { assetType: 'letterhead', title: 'Company letterhead' },
  { assetType: 'authorised_signature', title: "Authorised person's signature" },
];

export function CompanyAssetsForm({
  initialAssets,
  assetsLoaded,
}: {
  initialAssets: CompanyAssetSummary[];
  assetsLoaded: boolean;
}) {
  const [assets, setAssets] = useState<CompanyAssetSummary[]>(initialAssets);
  const [pendingType, setPendingType] = useState<AssetType | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const assetsByType = useMemo(() => new Map(assets.map((asset) => [asset.assetType, asset])), [assets]);

  async function upload(event: FormEvent<HTMLFormElement>, assetType: AssetType) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage('');
    setError('');
    const form = new FormData(formElement);
    form.set('assetType', assetType);
    if (assetType === 'authorised_signature') {
      form.set('authorisedUseConfirmed', form.get('authorisedUseConfirmed') === 'on' ? 'true' : 'false');
    }

    setPendingType(assetType);
    try {
      const response = await fetch('/api/platform/company-assets', {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        const detail = await safeMessage(response);
        setError(detail ?? `The ${labelFor(assetType).toLowerCase()} was not saved. Check the file type and try again.`);
        return;
      }
      const saved = (await response.json()) as CompanyAssetSummary;
      setAssets((current) => [...current.filter((item) => item.assetType !== saved.assetType), saved]);
      setMessage(`${labelFor(assetType)} uploaded and saved.`);
      formElement.reset();
    } catch {
      setError('The upload could not reach the server. Check your connection and try again.');
    } finally {
      setPendingType('');
    }
  }

  return (
    <div id="company-assets">
      {!assetsLoaded ? (
        <p className="notice error">
          Saved attachments could not be loaded. Uploading may require the latest API migration to be deployed.
        </p>
      ) : null}
      <div className="company-assets-grid">
        {ASSET_FIELDS.map((field) => {
          const saved = assetsByType.get(field.assetType);
          const busy = pendingType === field.assetType;
          return (
            <article key={field.assetType} className="company-asset-card">
              <div className="panel-head company-asset-card-head">
                <h3>{field.title}</h3>
                <span className={saved ? 'notice success' : 'notice'}>{saved ? 'Saved' : 'Not uploaded'}</span>
              </div>
              {saved ? (
                <div className="company-asset-saved">
                  <img
                    src={`/api/platform/company-assets/${field.assetType}/content`}
                    alt={`Saved ${field.title.toLowerCase()}`}
                    width={160}
                    height={100}
                  />
                  <p className="muted">
                    {formatBytes(saved.byteSize)} · Saved {new Date(saved.uploadedAt).toLocaleString()}
                  </p>
                </div>
              ) : null}
              <form onSubmit={(event) => void upload(event, field.assetType)}>
                <label>
                  {saved ? 'Choose a replacement image' : 'Choose image'}
                  <input name="file" type="file" accept="image/jpeg,image/png" required />
                </label>
                {field.assetType === 'authorised_signature' ? (
                  <label className="company-asset-consent">
                    <input name="authorisedUseConfirmed" type="checkbox" required />
                    I confirm I am authorised to upload and use this person&apos;s signature image on company documents.
                  </label>
                ) : null}
                <button type="submit" disabled={Boolean(pendingType)}>
                  {busy ? 'Uploading…' : saved ? 'Upload and replace' : 'Upload and save'}
                </button>
              </form>
            </article>
          );
        })}
      </div>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function labelFor(assetType: AssetType): string {
  return ASSET_FIELDS.find((field) => field.assetType === assetType)?.title ?? 'Company attachment';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function safeMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const candidate = Array.isArray(body.message) ? body.message[0] : body.message;
    if (typeof candidate !== 'string') return null;
    const value = candidate.trim();
    return value && value.length <= 200 && !/[\r\n]/.test(value) ? value : null;
  } catch {
    return null;
  }
}
