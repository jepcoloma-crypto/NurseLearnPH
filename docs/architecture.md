# Architecture Decision Records

## ADR-001: Monorepo with npm Workspaces

**Status:** Accepted

**Decision:** Use npm workspaces for monorepo management.

**Rationale:**
- Native npm support, no extra tooling
- Shared node_modules reduce disk usage
- Simple to understand and maintain
- Sufficient for the project scale

## ADR-002: Drizzle ORM

**Status:** Accepted

**Decision:** Use Drizzle ORM for PostgreSQL.

**Rationale:**
- Lightweight and fast
- TypeScript-first with excellent type inference
- SQL-like API familiar to developers
- Good PostgreSQL support
- Migration generation built-in

## ADR-003: Local-First Architecture

**Status:** Accepted

**Decision:** Application runs entirely on local PC for v1.

**Rationale:**
- No cloud infrastructure required for development
- Faster development iteration
- Simpler debugging
- Environment variables enable future cloud migration
- Storage abstraction layer for file uploads

## ADR-004: JWT Authentication

**Status:** Accepted

**Decision:** Use JWT with refresh token rotation.

**Rationale:**
- Stateless authentication
- Works with local-first architecture
- Industry-standard approach
- Refresh tokens for session management

## ADR-005: Zod Validation

**Status:** Accepted

**Decision:** Use Zod for all validation (API and forms).

**Rationale:**
- Single validation library across frontend and backend
- TypeScript type inference from schemas
- Excellent error message formatting
- Composable validation rules
