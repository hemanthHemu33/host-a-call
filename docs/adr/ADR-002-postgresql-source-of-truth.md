# ADR-002: PostgreSQL Source Of Truth

Status: Superseded by [ADR-009](./ADR-009-samvad-mongodb-api-source-of-truth.md)
Date: 2026-08-18

## Context

Connecto must never trust client money state, client call timers, payout status,
or provider callback order. The system needs one durable source of truth for
sessions, calls, ledger postings, reports, and admin actions.

## Decision

PostgreSQL is the only system of record for v1. Ledger postings, call state,
refund state, payout state, provider callback envelopes, and outbox events are
stored transactionally in PostgreSQL.

## Consequences

- All money remains integer paise in immutable ledger postings.
- Redis loss cannot corrupt balances or call state.
- Provider callbacks reconcile against PostgreSQL state instead of mutating
  frontend assumptions directly.
- Schema changes become explicit migrations and operational rollouts.
