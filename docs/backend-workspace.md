# Samvad backend workspace

Status: current as of 2026-10-28. The backend is the independently versioned
[`backend/samvad-api`](../backend/samvad-api) Git submodule, not a pnpm
workspace package. It runs a NestJS API and a companion worker against an
existing MongoDB replica set and Redis instance.

## First-time setup

```powershell
git submodule update --init --recursive
npm --prefix backend/samvad-api ci
```

Configure Samvad’s environment (normally through Doppler or injected platform
variables). At minimum, supply a MongoDB replica-set `MONGODB_URI`,
`MONGODB_DB_NAME`, Redis connection details, JWT secrets, CORS origins, and the
provider credentials required for the flow being tested. See the Samvad README
and its configuration module for the complete list.

## Root commands

| Command | Purpose |
| --- | --- |
| `npm run dev:backend` or `npm run dev:api` | Start Samvad API in watch mode |
| `npm run dev:worker` | Start the Samvad worker in watch mode |
| `npm run build:backend` | Build Samvad |
| `npm run test:backend` | Run Samvad’s Jest suite serially |
| `npm run check:backend` | Build then test Samvad |
| `npm run infra:backend:up` | Start Samvad API and worker using its Compose file |
| `npm run infra:backend:down` | Stop the Samvad Compose stack |

The Compose file expects MongoDB and Redis to exist separately. Its default
development connection points at the Docker host; it does not provision a
database or replace the required replica-set configuration.

## Retired workspace

The root PostgreSQL Compose file, SQL migration commands, generated `/v1`
contract commands, and `backend/apps` / `backend/packages` project references
were removed from the active workflow. Their documentation is historical only;
use [API source of truth](./api-source-of-truth.md) for the current boundary.
