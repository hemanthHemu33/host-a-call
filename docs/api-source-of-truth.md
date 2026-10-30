# Samvad API source of truth

Status: current and canonical as of 2026-10-28.

Samvad is the only backend API that mobile and admin clients may target. Its
implementation lives in [`backend/samvad-api`](../backend/samvad-api), an
independently versioned Git submodule backed by MongoDB and Redis.

## Authority order

1. The NestJS controllers, DTOs, guards, services, and tests in
   `backend/samvad-api/src` define runtime behaviour.
2. A running Samvad instance exposes the generated OpenAPI specification and
   Swagger UI at `/api/docs`.
3. [Backend API contract](./backend-api-contract.md) is the repository guide
   to those runtime surfaces.

If these sources disagree, fix the implementation and regenerate or update the
documentation. Do not introduce a parallel root API contract.

## Runtime endpoints

| Surface | Local address |
| --- | --- |
| REST base URL | `http://localhost:4000/api/v1` |
| Swagger UI | `http://localhost:4000/api/docs` |
| Health | `GET /api/v1/health` |
| Readiness | `GET /api/v1/ready` |
| Socket.IO namespace | `http://localhost:4000/signaling` |

The REST prefix is configurable with the backend-only `API_PREFIX` setting;
the default is `api/v1`. Client code must take the base URL from its runtime
configuration rather than hard-code a host.

## Data and deployment ownership

- MongoDB is the durable application datastore. It must be configured as a
  replica set because Samvad uses transactions.
- Redis provides distributed locks, presence, rate limiting, and worker
  coordination; it is not a replacement source of business truth.
- The Samvad API and its worker are separate processes from the same
  `backend/samvad-api` project. Its Compose file connects to existing MongoDB
  and Redis services; it does not provision PostgreSQL.

## Retired contract

The root `docs/contracts/openapi-v1*.json`, `docs/contracts/v1-client.ts`, and
the former `backend/apps` and `backend/packages` design describe an abandoned
PostgreSQL API. They are historical evidence only and must not be generated,
implemented, or consumed by new client work.

The current mobile app still contains calls to that retired `/v1` API. Those
adapters need an explicit migration to Samvad’s `/api/v1` routes and DTOs;
changing only the base URL would produce incorrect paths and payloads.

See [ADR-009](./adr/ADR-009-samvad-mongodb-api-source-of-truth.md) for the
decision and [Backend workspace](./backend-workspace.md) for local commands.
