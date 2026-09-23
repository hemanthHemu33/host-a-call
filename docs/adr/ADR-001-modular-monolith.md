# ADR-001: Modular Monolith

Status: Accepted
Date: 2026-08-18

## Context

Connecto has one mobile surface, one admin surface, a small engineering team,
and tightly coupled workflows across identity, calls, wallet, payouts, safety,
and admin review. Splitting those flows into services now would multiply
deployment, ownership, and correctness cost before measured scale exists.

## Decision

Run v1 as one deployable API plus one deployable worker inside a modular
monolith. Business capabilities stay inside bounded modules with explicit
dependency rules and shared PostgreSQL transactions.

## Consequences

- Financial and call invariants stay in-process and transactional.
- Frontend integration lands against one API host and one realtime namespace.
- Module boundaries stay explicit so extraction remains possible later.
- Microservices are deferred until measured extraction triggers are met.

## Extraction Policy

Extraction is allowed only when deploy coupling, independent scaling, database
contention, or ownership thresholds in `docs/architecture.md` are met. Future
service boundaries must preserve idempotency, ledger correctness, and auditable
state transitions.
