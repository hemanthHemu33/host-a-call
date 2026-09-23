# ADR-007: Separate Worker

Status: Accepted
Date: 2026-08-18

## Context

Provider reconciliation, outbox dispatch, moderation review, notification fan
out, and payout handling should not block API latency or crash user-facing HTTP
handlers.

## Decision

Run a separate worker process against the same PostgreSQL and Redis
dependencies. The worker owns asynchronous jobs, retries, and provider follow
up flows.

## Consequences

- API latency stays bounded around request/response work.
- Async retry policies are isolated from frontend traffic.
- The deployment shape remains small enough for a two-person team.
