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

## Frontend Auth Alignment

Status: Completed
Started: 2026-07-08
Completed: 2026-07-08

Scope:

- Align Better Auth backend configuration with the initialized Next.js frontend auth contract.
- Add Google OAuth config, trusted frontend origins, shared RBAC permissions, and Admin plugin configuration.
- Preserve the existing Better Auth OpenAPI plugin.
- Add Better Auth Admin plugin Prisma schema fields and migration after manual inspection.

Completed Work:

- Added Google OAuth environment config fields to `src/config/index.ts` and `.env.example`.
- Added Better Auth standard `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` entries to `.env.example`.
- Added `src/config/permissions.ts` with shared `shipment`, `trip`, `settlement`, and `withdrawal` permissions plus `admin` and `user` roles.
- Updated `src/app/lib/auth.ts` to use Google social auth, Better Auth `trustedOrigins`, the Admin plugin, and the existing OpenAPI plugin.
- Added tests for config, permissions, and auth configuration.
- Added API collection requests for Google social sign-in, session retrieval, and admin permission checks.
- Updated docs with the frontend auth proxy/trusted-origin expectations and Prisma manual migration handoff.
- Added Better Auth Admin plugin fields to `prisma/user.prisma` and migration `20260708041238_add_better_auth_admin_fields`.

Verification:

- `npm test` completed successfully: 18 passing tests across 7 test files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.
- `npm run lint` completed with 0 errors and 4 existing warnings in `src/app.ts`, `src/app/middlewares/globalErrorHandler.ts`, and `src/server.ts`.
- `npx prisma validate` completed successfully; the current schemas at `prisma` are valid.
- The admin migration SQL was reviewed and only alters the existing `user` and `session` tables.

Notes:

- For Prisma, use Better Auth `generate` only to inspect/generate schema changes, then use Prisma migration commands; do not use Better Auth direct `migrate` for this adapter.

## Admin Seed Script

Status: Completed
Started: 2026-07-08
Completed: 2026-07-08

Scope:

- Provide a way to bootstrap the first admin user via a simple CLI script.

Completed Work:

- Created `prisma/seeds/admin.ts` that calls Better Auth Admin plugin's server-side `auth.api.createUser` with `role: "admin"`, so user/account creation follows the active Better Auth configuration.
- Added `npm run seed:admin` script in `package.json`.
- Added optional `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` environment variables to `.env.example`.

Verification:

- `npm run typecheck` completed successfully.

Notes:

- The script is idempotent — it skips if the admin email already exists.
- Defaults: admin@shiffto.com / admin123.

## Shipment And Shipment Category Modules

Status: Completed
Started: 2026-07-08
Completed: 2026-07-08

Scope:

- Implement shipment and shipment-category CRUD modules following the route → validation → controller → service pattern.
- Single `authGuard` middleware handling session, email verification for normal users, and optional admin-only restriction.
- Category constraint validation: weight ≤ maxWeight, quantity ≤ maxQuantity, price ≥ minPrice, price ≤ maxPrice.
- Users see only their own shipments. Categories are admin-only.

Completed Work:

- Created `src/types/express.d.ts` augmenting Express `Request` with `user` property.
- Created `src/app/middlewares/authGuard.ts` with TDD: 7 tests verifying session check, verification check, and admin-only mode.
- Created `src/app/modules/shipment-category/` module with CRUD endpoints (admin-only via `authGuard({ adminOnly: true })`).
- Created `src/app/modules/shipment/` module with CRUD endpoints (verified users via `authGuard()`).
- Shipment service validates weight, quantity, pricePerKg against the linked category's constraints on create and update.
- Updated `src/config/permissions.ts` with `shipmentCategory` resource (admin role only).
- Updated `src/app/routes/index.ts` registering both modules at `/api/v1/shipments` and `/api/v1/shipment-categories`.
- Updated `src/generated/prisma/` with regenerated Prisma client including shipment models.
- Added 21 service-level tests: 8 for shipment-category (CRUD + error cases), 13 for shipment (CRUD, ownership isolation, constraint validation).
- Updated `docs/project-structure.md` with feature module convention and auth guard documentation.
- Updated `docs/feature-progress.md` with this entry.
- Updated OpenAPI spec in `src/app/docs/openapi.ts` with shipment and shipment-category endpoints.
- Added API collection files in dedicated per-module subfolders: `api_collections/Default/shipment/` and `api_collections/Default/shipment-category/`.
- Updated `docs/api-documentation.md` with per-module subfolder convention.

Verification:

- `npm test` completed successfully: 51 passing tests across 11 test files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- Auth guard uses Better Auth's `auth.api.getSession()` with `fromNodeHeaders()` from `better-auth/node`.
- The auth guard does not check `emailVerified` for admin users, allowing unverified admins to manage categories.

## Email OTP Verification During Sign-Up

Status: Completed
Started: 2026-07-08
Completed: 2026-07-08

Scope:

- Add OTP-based email verification to the sign-up flow using Better Auth's emailOTP plugin.
- Auto-send OTP on sign-up. Frontend manually requests OTP via `send-verification-otp` endpoint.
- Use Nodemailer + SMTP for email delivery.

Completed Work:

- Added `nodemailer` and `@types/nodemailer` dependencies.
- Added `smtp` config block (`host`, `port`, `user`, `pass`, `from`) to `src/config/index.ts`.
- Added SMTP environment variables to `.env.example`.
- Created `src/app/lib/email.ts` with `sendVerificationOTP` — Nodemailer-based OTP sender.
- Updated `src/app/lib/auth.ts`:
  - Added `emailOTP` plugin with `overrideDefaultEmailVerification: true` and `sendVerificationOnSignUp: true`.
  - `requireEmailVerification` is commented out; the frontend triggers verification by calling `POST /api/auth/email-otp/send-verification-otp`.
- Added tests for config (`smtp` fields), email module (3 tests), and auth plugin presence.
- Added OpenAPI spec entries for `POST /api/auth/email-otp/send-verification-otp` and `POST /api/auth/email-otp/verify-email`.
- Added Bruno API collection files: `Send OTP.yml` and `Verify Email.yml`.

Verification:

- `npm test` completed successfully: 21 passing tests across 8 test files.
- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.
- `npm run lint` completed with 0 errors and 4 pre-existing warnings.

Notes:

- The Prisma schema already had the `Verification` model and `emailVerified` Boolean — no migration needed.
- OTP is stored in the `verification` table (`identifier` = email, `value` = OTP code).
- The frontend signs up via `POST /api/auth/sign-up/email`, then manually calls `POST /api/auth/email-otp/send-verification-otp` to receive the OTP, then calls `POST /api/auth/email-otp/verify-email` to complete verification.

## Password Reset Via Email OTP

Status: Completed
Started: 2026-07-09
Completed: 2026-07-09

Scope:

- Add password reset via Better Auth emailOTP plugin endpoints.
- Request password reset OTP, then verify OTP and set new password.

Completed Work:

- Added Bruno API collection files:
  - `api_collections/Default/Auth/Request Password Reset.yml` — `POST /api/auth/email-otp/request-password-reset`
  - `api_collections/Default/Auth/Reset Password.yml` — `POST /api/auth/email-otp/reset-password`
- Added OpenAPI spec entries for both endpoints in `src/app/docs/openapi.ts`.
- Updated `docs/feature-progress.md` with this entry.

Verification:

- `npm run typecheck` completed successfully.
- `npm run build` completed successfully.

Notes:

- No Prisma migration or code change required — Better Auth's emailOTP plugin already handles the flow via the existing `Verification` model.
- The `sendVerificationOTP` function in `src/app/lib/email.ts` already supported the `"forget-password"` OTP type with the subject "Reset your Shiffto password".
- The deprecated `/api/auth/forget-password/email-otp` endpoint exists in Better Auth but is intentionally not added to the API collection.
