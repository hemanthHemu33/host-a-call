import {
  colorRoles,
  darkColorRoles,
  radii,
  spacing,
  typography,
} from '@connecto/design-tokens';
import { notFound } from 'next/navigation';

import { isAdminInternalRouteAvailable } from '@/config/internalRoutes';

const swatches = [
  ['Brand primary', colorRoles.brand.primary],
  ['Primary pressed', colorRoles.brand.primaryPressed],
  ['Primary soft', colorRoles.brand.primarySoft],
  ['Coral accent', colorRoles.accent.coral],
  ['Accent soft', colorRoles.accent.coralSoft],
  ['Success', colorRoles.status.success],
  ['Warning', colorRoles.status.warning],
  ['Error', colorRoles.status.error],
  ['Info', colorRoles.status.info],
] as const;

const rankEntries = Object.entries(colorRoles.rank);
const spacingEntries = Object.entries(spacing).filter(([key]) =>
  ['0', '2', '4', '8', '12', '16'].includes(key),
);

export default function AdminTokenGalleryPage() {
  if (!isAdminInternalRouteAvailable()) {
    notFound();
  }

  return (
    <main className="token-shell" aria-labelledby="token-gallery-title">
      <section className="token-hero">
        <p className="eyebrow">Design tokens</p>
        <h1 id="token-gallery-title">Connecto token gallery</h1>
        <p>
          Admin defaults to this polished light theme. Dark mode tokens are
          exported and can be enabled by setting <code>data-theme="dark"</code>.
        </p>
      </section>

      <section className="token-section" aria-labelledby="color-title">
        <h2 id="color-title">Semantic colors</h2>
        <div className="token-grid">
          {swatches.map(([label, value]) => (
            <article className="token-card" key={label}>
              <div
                aria-hidden="true"
                className="token-swatch"
                style={{ background: value }}
              />
              <div className="token-meta">
                <strong>{label}</strong>
                <span>{value}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="token-section" aria-labelledby="rank-title">
        <h2 id="rank-title">Rank colors</h2>
        <div className="token-grid">
          {rankEntries.map(([rank, value]) => (
            <article className="token-card" key={rank}>
              <div className="token-meta">
                <span
                  className="token-rank"
                  style={{
                    background: value.background,
                    color: value.foreground,
                  }}
                >
                  {rank}
                </span>
                <span>{value.background}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="token-section" aria-labelledby="scale-title">
        <h2 id="scale-title">Spacing, radii, and type</h2>
        <div className="token-grid">
          <article className="token-card">
            <div className="token-meta">
              <strong>4-point spacing scale</strong>
              <div className="token-scale" aria-label="Spacing scale samples">
                {spacingEntries.map(([key, value]) => (
                  <span
                    aria-label={`Space ${key} is ${String(value)}px`}
                    className="token-space"
                    key={key}
                    style={{ height: value }}
                  />
                ))}
              </div>
            </div>
          </article>
          <article className="token-card">
            <div className="token-meta">
              <strong>Radii</strong>
              <span>{Object.values(radii).join(' / ')}</span>
            </div>
          </article>
          <article className="token-card">
            <div className="token-meta">
              <strong>Admin headline</strong>
              <span>
                {typography.admin.headline.fontSize}/
                {typography.admin.headline.lineHeight}
              </span>
            </div>
          </article>
          <article className="token-card">
            <div className="token-meta">
              <strong>Optional dark background</strong>
              <span>{darkColorRoles.background.app}</span>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
