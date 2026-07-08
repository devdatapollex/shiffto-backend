# API Documentation

API documentation has two required outputs: Swagger/OpenAPI docs and the API client collection.

## Swagger/OpenAPI

Swagger/OpenAPI documentation must describe every implemented endpoint, including:

- Method and path.
- Request params, query, headers, cookies, and body.
- Response body examples.
- Error responses.
- Auth requirements.

When Swagger serving or generation is added, document the local URL here and keep it stable for agents and API consumers.

Current status:

- Better Auth is configured with its OpenAPI plugin in `src/app/lib/auth.ts`.
- Project-level Swagger/OpenAPI docs are available at `/api/docs` and `/api/docs/openapi.json`.

## API Client Collection

The existing collection lives at:

- `api_collections/Default/opencollection.yml`
- `api_collections/Default/*.yml`

The collection currently uses OpenCollection YAML with Bruno extension metadata. Preserve this structure unless the project explicitly migrates formats.

Existing request example:

- `api_collections/Default/Sign Up.yml`
- `POST http://localhost:5000/api/auth/sign-up/email`
- Better Auth email sign-up/sign-in requests must include an `Origin` header, such as `Origin: http://localhost:3000`. Browsers send this automatically, but Bruno/API clients need it configured explicitly.

Frontend auth alignment requests:

- `api_collections/Default/Sign Up.yml` uses `POST /api/auth/sign-up/email`.
- `api_collections/Default/Sign In.yml` uses `POST /api/auth/sign-in/email`.
- `api_collections/Default/Sign In With Google.yml` uses `POST /api/auth/sign-in/social` with `provider: "google"`.
- `api_collections/Default/Get Session.yml` uses `GET /api/auth/get-session`.
- `api_collections/Default/Has Permission.yml` uses `POST /api/auth/admin/has-permission`.

## Update Rules

For every API feature:

1. Add or update Swagger/OpenAPI docs.
2. Add or update matching request files in `api_collections/Default`.
3. Include realistic request bodies and headers.
4. Avoid committing secrets or real credentials.
5. Keep base URLs local and easy to change.
6. Update `docs/feature-progress.md` with the documentation work completed.

## Route Prefixes

- Better Auth endpoints currently live under `/api/auth`.
- The Next.js frontend proxies browser requests from `http://localhost:3000/api/auth/*` to this backend's `/api/auth/*`; keep `FRONTEND_URL` in Better Auth `trustedOrigins` and Express CORS.
- Application feature endpoints should live under `/api/v1` unless a documented architecture decision changes this.

## Better Auth Environment

Better Auth reads these standard environment variables directly when `secret` and `baseURL` are not passed in `src/app/lib/auth.ts`:

- `BETTER_AUTH_SECRET`: required secret for signing/encryption. Use a strong value of at least 32 characters.
- `BETTER_AUTH_URL`: backend auth base URL, such as `http://localhost:5000` locally.

Keep `BETTER_AUTH_URL` pointed at the backend, not the Next.js proxy origin. Keep `FRONTEND_URL` pointed at the browser-facing frontend origin for CORS and Better Auth `trustedOrigins`.

## Better Auth Prisma Schema Changes

When Better Auth plugins change, update the Prisma schema before applying database migrations. For this project, Better Auth uses the Prisma adapter, so do not use Better Auth's direct `migrate` command. Use Better Auth `generate` only to inspect or generate Prisma schema changes, then create/apply the database migration with Prisma.

Admin plugin Prisma migration workflow:

1. Run `npx auth@latest generate --config src/app/lib/auth.ts` and inspect the generated Prisma changes.
2. Apply only the needed admin fields to the current split Prisma schema if generation cannot safely handle `prisma/schema.prisma` plus `prisma/user.prisma`.
3. Run `npx prisma validate`.
4. Run `npx prisma migrate dev --name add_better_auth_admin_fields`.
5. Run `npx prisma generate`.
6. Inspect SQL and verify it only alters the existing `user` and `session` tables. The current admin migration is `prisma/migrations/20260708041238_add_better_auth_admin_fields/migration.sql`.
