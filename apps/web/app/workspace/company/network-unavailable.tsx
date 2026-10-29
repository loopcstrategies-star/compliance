type NetworkUnavailableProps = {
  title?: string;
  onRetry?: () => void;
};

export function NetworkUnavailable({
  title = 'Company networking is not available for this account',
  onRetry,
}: NetworkUnavailableProps) {
  return (
    <section className="network-unavailable" role="status">
      <h3>{title}</h3>
      <p>
        Platform system tenants manage onboarding and branding only. Sign in with an onboarding company staff account
        to use LoopC Network (My Company, Discover, Messages, and settings).
      </p>
      <div className="network-unavailable-actions">
        <a className="button-link" href="/workspace/company/onboarding">
          Customer onboarding
        </a>
        <a className="button-link button-link--outline" href="/workspace/company/branding">
          Company branding
        </a>
        {onRetry ? (
          <button type="button" className="button-secondary" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </section>
  );
}
