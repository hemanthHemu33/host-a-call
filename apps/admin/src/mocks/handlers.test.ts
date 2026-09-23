import { describe, expect, it } from 'vitest';

import { adminMockHandlers } from './handlers';

describe('admin mock handlers', () => {
  it('covers the frontend HTTP service contract broadly', () => {
    expect(adminMockHandlers.length).toBeGreaterThanOrEqual(30);
  });
});
