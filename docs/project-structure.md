# Project Structure

This project is an early-stage TypeScript backend. Document the current shape before expanding it.

## Runtime Stack

- Language: TypeScript with ESM.
- HTTP framework: Express 5.
- Auth: Better Auth with Prisma adapter.
- Database: PostgreSQL through Prisma and `@prisma/adapter-pg`.
- Validation: Zod middleware exists.
- API client collection: OpenCollection YAML under `api_collections/Default` with Bruno extension metadata.

## Source Layout

- `src/server.ts` starts the HTTP server and imports the Express app.
- `src/app.ts` is the app composition module. It wires CORS, Better Auth, parsers, API routes, root response, error handling, and 404 handling.
- `src/config/index.ts` loads environment configuration.
- `src/app/routes/index.ts` is the `/api/v1` route registry.
- `src/app/middlewares/` contains cross-cutting Express middleware.
- `src/app/lib/` contains shared infrastructure modules and adapters.
- `src/app/helper/` contains small reusable helper functions.
- `src/app/errors/` contains application error types.
- `prisma/` contains Prisma schema files and migrations.
- `src/generated/prisma/` is generated output and is ignored by Git.
- `api_collections/Default/` contains API client request definitions.

## Current Route Shape

Better Auth is mounted directly in `src/app.ts`:

- `/api/auth/{*any}`

Versioned application routes are mounted through `src/app/routes/index.ts`:

- `/api/v1/*`

When adding a feature route, create the feature module first, then register its router in `src/app/routes/index.ts`.

## Current Module Vocabulary

Use these architecture terms consistently in docs and reviews:

- Module: a unit with an interface and implementation, such as a route module, middleware, helper, or library adapter.
- Interface: what callers must know to use the module, including inputs, outputs, invariants, errors, ordering, and config.
- Implementation: the code hidden behind the interface.
- Seam: where an interface lives and behavior can be changed without editing callers.
- Adapter: a concrete implementation at a seam, such as Prisma, Better Auth, Cloudinary, or the HTTP server adapter.
- Locality: keeping related behavior, bugs, and changes concentrated.
- Leverage: giving callers useful behavior through a small interface.

## Early-Stage Gaps

These are known gaps, not established conventions:

- No feature module structure is fully established yet.
- No test runner or test script is configured yet.
- Swagger/OpenAPI serving is not wired into the backend yet, although Better Auth has an OpenAPI plugin configured.
- Environment validation is not yet implemented.
- CORS origin is currently hardcoded.
- Some legacy text remains from a prior template.

Address these gaps incrementally when they become relevant to a feature.
