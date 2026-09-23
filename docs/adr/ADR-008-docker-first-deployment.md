# ADR-008: Docker-First Deployment

Status: Accepted
Date: 2026-08-18

## Context

The repository needs a reproducible local and CI deployment target for one API,
one worker, PostgreSQL, and Redis. Environment drift would otherwise slow
backend integration and provider testing.

## Decision

Ship Dockerfiles for the API and worker plus a local
`docker-compose.backend.yml` that brings up PostgreSQL, Redis, the API, and the
worker.

## Consequences

- Local backend inspection has one documented startup path.
- CI and production packaging can reuse the same container boundaries.
- Docker remains a packaging choice, not a reason to introduce Kubernetes or
  service sprawl.
