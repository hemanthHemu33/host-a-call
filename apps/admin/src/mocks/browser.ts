import { setupWorker } from 'msw/browser';

import { adminMockHandlers } from './handlers';

let worker: ReturnType<typeof setupWorker> | null = null;

export const startAdminMockWorker = async () => {
  worker ??= setupWorker(...adminMockHandlers);
  await worker.start({ onUnhandledRequest: 'bypass' });
};
