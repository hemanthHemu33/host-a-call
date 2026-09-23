import { describe, expect, it } from 'vitest';

import { frontendAdapters, frontendServices } from './adapters';

describe('admin frontend adapters', () => {
  it('uses mock adapters by default', async () => {
    await expect(frontendAdapters.reports.listReports()).resolves.toHaveLength(
      1,
    );
  });

  it('exposes service interfaces for admin flows', async () => {
    await expect(frontendServices.report.listReports()).resolves.toHaveLength(
      1,
    );
  });
});
