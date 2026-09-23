import { describe, expect, it } from 'vitest';

import { isAdminInternalRouteAvailable } from './internalRoutes';

describe('admin internal routes', () => {
  it('disables internal routes in production', () => {
    expect(isAdminInternalRouteAvailable('development')).toBe(true);
    expect(isAdminInternalRouteAvailable('preview')).toBe(true);
    expect(isAdminInternalRouteAvailable('production')).toBe(false);
  });
});
