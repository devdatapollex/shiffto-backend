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
- A project-level Swagger/OpenAPI route is not yet wired into `src/app.ts`.

## API Client Collection

The existing collection lives at:

- `api_collections/Default/opencollection.yml`
- `api_collections/Default/*.yml`

The collection currently uses OpenCollection YAML with Bruno extension metadata. Preserve this structure unless the project explicitly migrates formats.

Existing request example:

- `api_collections/Default/Sign Up.yml`
- `POST http://localhost:5000/api/auth/sign-up/email`
- Better Auth email sign-up/sign-in requests must include an `Origin` header, such as `Origin: http://localhost:3000`. Browsers send this automatically, but Bruno/API clients need it configured explicitly.

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
- Application feature endpoints should live under `/api/v1` unless a documented architecture decision changes this.
