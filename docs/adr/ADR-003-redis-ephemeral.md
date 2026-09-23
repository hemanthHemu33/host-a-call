# ADR-003: Redis Ephemeral Use

Status: Accepted
Date: 2026-08-18

## Context

Calls, host presence, throttles, and queue coordination need low-latency
ephemeral storage, but correctness cannot depend on cache durability.

## Decision

Redis is limited to presence, locks, throttles, cache, Socket.IO coordination,
and worker queue coordination. No authoritative money, call, account, or admin
state may live only in Redis.

## Consequences

- Redis can be flushed or replaced without losing correctness.
- Workers must resume from PostgreSQL after Redis loss.
- Any Redis-backed lock or queue consumer still requires idempotent database
  transitions.
