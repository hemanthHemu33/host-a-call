# ADR-009: Samvad MongoDB API source of truth

Status: Accepted
Date: 2026-10-28

## Context

The repository contained an unimplemented root PostgreSQL `/v1` backend design
alongside the working `backend/samvad-api` NestJS service. The two systems have
different paths, request shapes, authentication flows, data models, and
operational dependencies. Calling both canonical would cause frontend teams to
build against a backend that is not deployed.

## Decision

Samvad is the sole canonical API and datastore boundary. Its MongoDB-backed
NestJS service owns the REST `/api/v1` API, the Socket.IO `/signaling`
namespace, its Swagger specification, and its API/worker deployment commands.

The root PostgreSQL `/v1` contract, generated client, Compose stack, and
workspace references are retired. Historical documentation remains readable
only to explain the migration; it must not guide new implementation.

## Consequences

- MongoDB (configured as a replica set) becomes the durable datastore for
  Samvad-owned product state. Redis remains an operational dependency.
- Root API scripts delegate to `backend/samvad-api`; the root pnpm workspace no
  longer treats the retired backend packages as projects.
- Mobile and admin integrations must use Samvad DTOs, auth, REST paths, and
  realtime events. An adapter migration is required before production traffic
  can move; no compatibility is implied by the similar version number.
- ADR-002 is superseded. Older architecture and contract documents are
  historical where they prescribe PostgreSQL or the root `/v1` API.
