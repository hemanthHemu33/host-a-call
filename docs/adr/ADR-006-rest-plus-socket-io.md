# ADR-006: REST Plus Socket.IO

Status: Accepted
Date: 2026-08-18

## Context

Connecto needs auditable command/query endpoints plus low-latency host presence,
incoming call, reconnect, and video-upgrade events. Pure polling is too coarse
for call UX, while realtime-only APIs weaken replayability and admin inspection.

## Decision

Use REST over HTTPS for commands, queries, webhooks, and admin operations. Use
Socket.IO from the API edge for presence and user-facing realtime events.

## Consequences

- Mutations keep explicit HTTP idempotency and request tracing.
- Realtime paths stay optional at the transport edge; business invariants remain
  in application services.
- Frontend routes continue to map cleanly to endpoints, events, jobs, or typed
  unavailable states.
