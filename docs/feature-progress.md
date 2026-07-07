# Feature Progress

Use this file to track feature-by-feature progress. Update it before starting a feature and after completing a meaningful slice.

## Status Values

- Planned: accepted work that has not started.
- In Progress: active work.
- Completed: implemented, documented, and verified.
- Blocked: waiting on a decision, dependency, or environment.

## Entry Format

```md
## Feature Name

Status: Planned | In Progress | Completed | Blocked
Started: YYYY-MM-DD
Completed: YYYY-MM-DD or N/A

Scope:

- What this feature includes.

Completed Work:

- What changed in code, tests, Swagger/OpenAPI, and `api_collections/Default`.

Verification:

- Commands run and their result.

Notes:

- Decisions, follow-ups, or known limitations.
```

## Agent Documentation Baseline

Status: Completed
Started: 2026-07-07
Completed: 2026-07-07

Scope:

- Add root agent instructions and dedicated documentation for project structure, workflow, API documentation, architecture decisions, and feature progress.

Completed Work:

- Added `AGENTS.md` as the root agent entrypoint.
- Documented current Express, Prisma, Better Auth, and API collection structure.
- Documented incremental workflow, TDD expectation, verification expectation, dependency policy, and Git commit standard.
- Documented that API client files live under `api_collections/Default` and use OpenCollection YAML with Bruno extension metadata.
- Recorded initial architecture decisions.

Verification:

- Documentation files were reviewed for consistency with the current project structure.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- Current git status before this documentation work included a deleted `src/app/middlewares/old-auth.ts`. Future agents should review whether that manual change needs additional cleanup or documentation before related auth work.

## Test Infrastructure And Health Endpoint

Status: Completed
Started: 2026-07-07
Completed: 2026-07-07

Scope:

- Add minimal TypeScript test infrastructure.
- Cover the existing `/api/health` endpoint with a request-level test.
- Keep `/api/health` in `src/app.ts`; do not create a health module until behavior becomes non-trivial.

Completed Work:

- Added Vitest and Supertest test tooling.
- Added `npm test` and `npm run test:watch` scripts.
- Added `src/app.test.ts` to verify `/api/health` returns `status: "ok"` and a parseable timestamp.
- Updated project structure and development workflow docs for the new test setup.

Verification:

- `npm test -- --run src/app.test.ts` completed successfully. The test passed immediately because `/api/health` already existed in the current uncommitted `src/app.ts` implementation.
- `npm test` completed successfully with 1 passing test file.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.
- `npm run lint` completed with 0 errors and 5 existing warnings in `src/app.ts`, `src/app/helper/jwtHelper.ts`, `src/app/middlewares/globalErrorHandler.ts`, and `src/server.ts`.

Notes:

- No production code change was required for this slice.

## Config Validation And CORS

Status: Completed
Started: 2026-07-07
Completed: 2026-07-07

Scope:

- Validate environment configuration at startup instead of using raw `process.env` values.
- Move hardcoded CORS origin to config-driven `frontend_url`.
- Expose `createConfig` as a testable interface.

Completed Work:

- Replaced default export with `createConfig(env)` that validates DATABASE_URL and normalizes PORT/defaults.
- Added `frontend_url` to config with default `http://localhost:3000`.
- Updated `src/app.ts` to read CORS origin from `config.frontend_url` instead of hardcoded string.
- Updated `.env.example` with `FRONTEND_URL`, Cloudinary, and JWT variables.
- Added `src/config/index.test.ts` with 3 passing tests.

Verification:

- `npm test` completed successfully: 4 total tests across 2 files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- Updated project-structure gap list to remove config and CORS entries.

## Swagger/OpenAPI Docs

Status: Completed
Started: 2026-07-07
Completed: 2026-07-07

Scope:

- Add a project-level OpenAPI spec endpoint.
- Serve Swagger UI for interactive API docs.

Completed Work:

- Created `src/app/docs/openapi.ts` with a minimal OpenAPI 3.1.0 spec describing the `/api/health` route.
- Created `src/app/docs/route.ts` serving the spec JSON at `/openapi.json` and Swagger UI at the root.
- Mounted the docs router in `src/app.ts` at `/api/docs`.
- Added `src/app/docs/docs.test.ts` verifying the OpenAPI spec endpoint returns valid JSON.

Verification:

- `npm test` completed successfully: 5 total tests across 3 files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- Updated project-structure gap list to remove Swagger entry.

## Legacy Template Cleanup

Status: Completed
Started: 2026-07-07
Completed: 2026-07-07

Scope:

- Remove template-specific text and hardcoded values from the codebase.

Completed Work:

- Added `cloudinary_folder` to config with default `"shiffto"` and `CLOUDINARY_FOLDER` env var support.
- Updated `src/app/helper/fileUploader.ts` to use config-driven folder name instead of hardcoded `"health_care_app"`.
- Updated `.env.example` with `CLOUDINARY_FOLDER`.
- Extended config tests to cover the new field.

Verification:

- `npm test` completed successfully: 5 total tests across 3 files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- The old root response text `"Ph health care server.."` was already replaced by a prior uncommitted change to `src/app.ts`.

## Cloudinary To Cloudflare R2 Migration

Status: Completed
Started: 2026-07-07
Completed: 2026-07-07

Scope:

- Replace Cloudinary package with Cloudflare R2 for file storage.
- Two-bucket strategy: public bucket (stable CDN URLs) and private bucket (presigned URL access).
- Switch multer from disk storage to memory storage (no orphaned files).
- Remove Cloudinary code, dependencies, and env vars.

Completed Work:

- Updated config: replaced `cloudinary` block with `r2` block (`account_id`, `access_key_id`, `secret_access_key`, `public_bucket`, `public_url`, `private_bucket`).
- Created `src/app/lib/storage.ts`: R2 S3Client adapter with `uploadToPublicBucket`, `uploadToPrivateBucket`, `getPresignedUrl`, `deleteObject`.
- Rewrote `src/app/helper/fileUploader.ts`: memory storage multer, `uploadPublic`, `uploadPrivate`, `getPrivateUrl`, `deleteFile` methods delegating to R2 adapter.
- Removed `cloudinary` npm package; added `@aws-sdk/client-s3@^3.1080.0` and `@aws-sdk/s3-request-presigner@^3.1080.0`.
- Updated `.env.example` with R2 env vars.
- Added `uploads/` to `.gitignore`; removed 39 stale tracked files from git.
- Added 8 new tests: 4 for storage adapter, 4 for fileUploader.

Verification:

- `npm test` completed successfully: 13 total tests across 5 files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- The old `fileUploader.ts` was never imported by any route, so no production callers were affected.
- Private bucket presigned URLs default to 1-hour expiry, configurable via `getPresignedUrl(key, expiresInSec)`.
