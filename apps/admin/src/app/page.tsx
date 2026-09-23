import { mockHealthAdapter } from '@connecto/domain';

import { adminRuntimeConfig } from '@/config/runtime';
import { featureFlags } from '@/config/featureFlags';

export default async function AdminHealthPage() {
  const health = await mockHealthAdapter(
    'Connecto Admin',
    adminRuntimeConfig.providerMode,
  ).getHealth();

  return (
    <main className="health-shell" aria-labelledby="health-title">
      <section className="health-panel">
        {adminRuntimeConfig.environment === 'production' ? null : (
          <p className="env-badge">
            {adminRuntimeConfig.environment} /{' '}
            {adminRuntimeConfig.mockMode
              ? 'mock'
              : adminRuntimeConfig.providerMode}
          </p>
        )}
        <p className="eyebrow">Admin workspace</p>
        <h1 id="health-title">Connecto Admin is healthy</h1>
        <dl className="health-grid">
          <div>
            <dt>Provider</dt>
            <dd>{health.providerMode}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{health.status}</dd>
          </div>
          <div>
            <dt>Token source</dt>
            <dd>frontend mock adapter</dd>
          </div>
          <div>
            <dt>Analytics</dt>
            <dd>{featureFlags.analyticsEnabled ? 'enabled' : 'disabled'}</dd>
          </div>
        </dl>
        <p className="health-link">
          <a href="/operations">Open service-backed operations</a>
        </p>
      </section>
      <div className="accent" aria-hidden="true" />
    </main>
  );
}
