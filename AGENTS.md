# Agent Instructions

This backend is early-stage. Before changing code, inspect the current project structure and follow the conventions that already exist. Some expected pieces may not be set up yet; document gaps instead of assuming they exist.

## Required Workflow

1. Check `git status --short` before starting new work.
2. Review recent manual changes and confirm whether they require updates to `AGENTS.md`, `docs/`, Swagger/OpenAPI documentation, or `api_collections/Default`.
3. If implementation behavior, structure, routes, scripts, dependencies, or conventions differ from the docs, update the docs before continuing so future agents do not rely on stale context.
4. Build incrementally, one feature or bugfix at a time.
5. Use TDD for feature and bugfix work: write or update a failing test first, implement the smallest correct change, then make the test pass.
6. Use `verification-before-completion` before claiming work is complete or fixed.
7. Use `improve-codebase-architecture` when making structural changes, introducing module seams, or evaluating refactors.
8. Update the relevant documentation after each meaningful change.
9. Commit each distinct topic as a separate, atomic commit with a meaningful conventional-commit message. Never bundle unrelated changes (e.g. OpenAPI docs, dependency changes, and feature logic) into a single commit — split them into focused commits even if they were developed together.

## Project References

- Current structure and conventions: `docs/project-structure.md`
- Development workflow and standards: `docs/development-workflow.md`
- API documentation expectations: `docs/api-documentation.md`
- Architecture decisions and records: `docs/architecture-decisions.md`
- Feature tracking: `docs/feature-progress.md`

## API Documentation

For every API change, keep these in sync:

- Swagger/OpenAPI documentation exposed by the backend or generated from source.
- API client collection files under `api_collections/Default`.
- Any feature notes in `docs/feature-progress.md`.

The existing API collection uses OpenCollection YAML with Bruno extension metadata. Do not create a parallel collection unless the project intentionally migrates formats.

## Package Policy

Use recent compatible package versions. Before adding or upgrading dependencies, check compatibility with the current TypeScript, Express, Prisma, Better Auth, and Node.js setup. Avoid stale packages and avoid upgrades that force unrelated migrations.
