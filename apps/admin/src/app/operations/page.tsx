'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { normalizeApiError, queryKeys } from '@connecto/domain';

import { frontendServices } from '@/services/adapters';

function QueryPanel<T>({
  children,
  empty,
  query,
  title,
}: {
  children: (data: T) => ReactNode;
  empty: (data: T) => boolean;
  query: UseQueryResult<T>;
  title: string;
}) {
  if (query.isPending) {
    return (
      <section className="ops-card" aria-busy="true">
        <h2>{title}</h2>
        <p>Loading data...</p>
      </section>
    );
  }

  if (query.isError) {
    const error = normalizeApiError(query.error);

    return (
      <section className="ops-card error" role="alert">
        <h2>{title}</h2>
        <p>{error.message}</p>
        <button
          type="button"
          onClick={() => {
            void query.refetch();
          }}
        >
          Retry
        </button>
      </section>
    );
  }

  if (query.data === undefined || empty(query.data)) {
    return (
      <section className="ops-card">
        <h2>{title}</h2>
        <p>No records for the selected mock scenario.</p>
      </section>
    );
  }

  return (
    <section className="ops-card">
      <h2>{title}</h2>
      {children(query.data)}
    </section>
  );
}

export default function OperationsPage() {
  const dashboard = useQuery({
    queryFn: () => frontendServices.admin.getDashboard(),
    queryKey: queryKeys.admin.dashboard,
  });
  const hosts = useQuery({
    queryFn: () => frontendServices.admin.listHosts(),
    queryKey: queryKeys.admin.hosts,
  });
  const payments = useQuery({
    queryFn: () => frontendServices.admin.searchPayments(),
    queryKey: queryKeys.admin.payments,
  });
  const refunds = useQuery({
    queryFn: () => frontendServices.admin.listRefunds(),
    queryKey: queryKeys.admin.refunds,
  });
  const reports = useQuery({
    queryFn: () => frontendServices.admin.listReports(),
    queryKey: queryKeys.admin.reports,
  });
  const settings = useQuery({
    queryFn: () => frontendServices.admin.getSettings(),
    queryKey: queryKeys.admin.settings,
  });

  return (
    <main className="ops-shell" aria-labelledby="ops-title">
      <header className="ops-hero">
        <p className="eyebrow">Admin operations</p>
        <h1 id="ops-title">Service-backed control room</h1>
      </header>

      <div className="ops-grid">
        <QueryPanel
          empty={(data) => data.metrics.length === 0}
          query={dashboard}
          title="Dashboard"
        >
          {(data) => (
            <dl className="ops-list">
              {data.metrics.map((metric) => (
                <div key={metric.label}>
                  <dt>{metric.label}</dt>
                  <dd>{metric.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </QueryPanel>

        <QueryPanel
          empty={(data) => data.length === 0}
          query={hosts}
          title="Hosts"
        >
          {(items) => (
            <ul className="ops-list">
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.type}</strong>
                  <span>{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </QueryPanel>

        <QueryPanel
          empty={(data) => data.length === 0}
          query={payments}
          title="Payments"
        >
          {(items) => (
            <ul className="ops-list">
              {items.map((payment) => (
                <li key={payment.id}>
                  <strong>{payment.status}</strong>
                  <span>{payment.amount.amountPaise / 100} INR</span>
                </li>
              ))}
            </ul>
          )}
        </QueryPanel>

        <QueryPanel
          empty={(data) => data.length === 0}
          query={refunds}
          title="Refunds"
        >
          {(items) => (
            <ul className="ops-list">
              {items.map((item) => (
                <li key={item.id}>
                  <strong>{item.priority}</strong>
                  <span>{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </QueryPanel>

        <QueryPanel
          empty={(data) => data.length === 0}
          query={reports}
          title="Reports"
        >
          {(items) => (
            <ul className="ops-list">
              {items.map((report) => (
                <li key={report.id}>
                  <strong>{report.kind}</strong>
                  <span>{report.status}</span>
                </li>
              ))}
            </ul>
          )}
        </QueryPanel>

        <QueryPanel
          empty={(data) => Object.keys(data.features).length === 0}
          query={settings}
          title="Settings"
        >
          {(data) => (
            <dl className="ops-list">
              <div>
                <dt>Maintenance</dt>
                <dd>{data.maintenance.mode}</dd>
              </div>
              <div>
                <dt>Features</dt>
                <dd>{Object.keys(data.features).length}</dd>
              </div>
              <div>
                <dt>Terms</dt>
                <dd>{data.legal.termsVersion}</dd>
              </div>
            </dl>
          )}
        </QueryPanel>
      </div>
    </main>
  );
}
