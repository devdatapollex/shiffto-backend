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
