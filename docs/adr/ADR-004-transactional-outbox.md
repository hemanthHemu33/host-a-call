# ADR-004: Transactional Outbox

Status: Accepted
Date: 2026-08-18

## Context

Payments, payouts, moderation, notifications, analytics, and admin audit all
need asynchronous follow-up work. Direct fire-and-forget side effects from HTTP
handlers would lose events on crashes and create split-brain state.

## Decision

Business transactions write an outbox record in the same PostgreSQL transaction
as the state change. The worker dispatches outbox events and retries idempotent
side effects until completion.

## Consequences

- Notifications, analytics, moderation, and reconciliation can lag without
  corrupting source-of-truth state.
- HTTP handlers stay thin and transactional.
- Consumers must remain idempotent because delivery is at least once.
