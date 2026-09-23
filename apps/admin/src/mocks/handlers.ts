import { HttpResponse, http } from 'msw';

import {
  appHealthSchema,
  createMockDatabase,
  fixtureMoney,
} from '@connecto/domain';

const database = createMockDatabase();

export const adminMockHandlers = [
  http.get('*/auth/session', () => HttpResponse.json(null)),
  http.post('*/auth/otp', () =>
    HttpResponse.json({ requestId: 'mock-admin-otp' }),
  ),
  http.post('*/auth/otp/verify', () =>
    HttpResponse.json({
      issuedAtIso: '2026-07-16T00:00:00.000Z',
      role: 'customer',
      sessionId: 'mock-admin-session',
      userId: database.customer.id,
    }),
  ),
  http.post('*/auth/sign-out', () => HttpResponse.json({ ok: true })),
  http.post('*/analytics/events', () => HttpResponse.json({ ok: true })),
  http.get('/api/health', () =>
    HttpResponse.json(
      appHealthSchema.parse({
        appName: 'Connecto Admin',
        checkedAtIso: '2026-07-16T00:00:00.000Z',
        providerMode: 'mock',
        status: 'healthy',
      }),
    ),
  ),
  http.get('*/calls', () => HttpResponse.json(database.completedCalls)),
  http.post('*/calls/token', () =>
    HttpResponse.json({
      expiresAtIso: '2026-07-16T01:00:00.000Z',
      token: 'mock-admin-call-token',
    }),
  ),
  http.post('*/calls/:callId/complete', () =>
    HttpResponse.json(database.completedCalls[0]),
  ),
  http.get('*/customers/:customerId', () =>
    HttpResponse.json(database.customer),
  ),
  http.get('*/earnings', () => HttpResponse.json(database.earnings)),
  http.get('*/hosts', () => HttpResponse.json(database.hosts)),
  http.get('*/hosts/:hostId', () => HttpResponse.json(database.host)),
  http.get('*/hosts/:hostId/application', () =>
    HttpResponse.json(database.hostApplication),
  ),
  http.get('*/hosts/:hostId/dashboard', () =>
    HttpResponse.json({
      application: database.hostApplication,
      earnings: database.earnings,
      host: database.host,
    }),
  ),
  http.get('*/hosts/:hostId/earnings', () =>
    HttpResponse.json(database.earnings),
  ),
  http.patch('*/hosts/:hostId/availability', () =>
    HttpResponse.json(database.host),
  ),
  http.get('*/notifications', () => HttpResponse.json(database.notifications)),
  http.post('*/notifications/:notificationId/read', () =>
    HttpResponse.json(database.notifications[0]),
  ),
  http.post('*/payments', () =>
    HttpResponse.json({
      amount: fixtureMoney(25000),
      customerId: database.customer.id,
      id: 'payment_mock_created',
      providerOrderId: 'order_mock_created',
      status: 'created',
    }),
  ),
  http.post('*/payments/:paymentId/verify', () =>
    HttpResponse.json(database.payments[0]),
  ),
  http.get('*/referrals', () => HttpResponse.json(database.referrals)),
  http.get('/api/reports', () => HttpResponse.json(database.reports)),
  http.get('*/reports', () => HttpResponse.json(database.reports)),
  http.post('*/reports', () => HttpResponse.json(database.reports[0])),
  http.get('/api/support/tickets', () =>
    HttpResponse.json(database.supportTickets),
  ),
  http.get('*/support/tickets', () =>
    HttpResponse.json(database.supportTickets),
  ),
  http.post('*/support/tickets', () =>
    HttpResponse.json(database.supportTickets[0]),
  ),
  http.get('/api/withdrawals', () => HttpResponse.json(database.withdrawals)),
  http.get('*/withdrawals', () => HttpResponse.json(database.withdrawals)),
  http.post('*/withdrawals', () =>
    HttpResponse.json({
      amount: fixtureMoney(5000),
      hostId: database.host.id,
      id: 'withdrawal_mock_created',
      requestedAtIso: '2026-07-16T00:30:00.000Z',
      status: 'requested',
    }),
  ),
  http.get('/api/wallets', () => HttpResponse.json(database.wallet)),
  http.get('*/wallets', () => HttpResponse.json(database.wallet)),
  http.get('*/wallets/:walletId/transactions', () =>
    HttpResponse.json(database.transactions),
  ),
];
