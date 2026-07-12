# Architecture Decisions

Record decisions here when they affect future implementation choices. Keep entries short and dated.

## Decision Format

Use this format:

```md
## YYYY-MM-DD - Decision Title

Status: Accepted | Superseded | Proposed

Context: What problem or constraint led to the decision.

Decision: What we decided.

Consequences: What this enables, limits, or requires agents to remember.
```

## 2026-07-07 - Use Express As The HTTP App Framework

Status: Accepted

Context: The current backend is already wired around Express 5 in `src/app.ts` and `src/server.ts`.

Decision: Continue using Express for application routes, middleware, and server composition unless a future migration is explicitly planned.

Consequences: New HTTP modules should expose Express routers and be registered through `src/app/routes/index.ts` for `/api/v1` features.

## 2026-07-07 - Keep Better Auth Outside The Versioned API Router

Status: Accepted

Context: Better Auth is currently mounted directly at `/api/auth/{*any}` through `toNodeHandler(auth)`.

Decision: Treat Better Auth as a separate adapter seam from the versioned application API.

Consequences: Feature routes should not assume auth endpoints are under `/api/v1`. API docs and client collections must document auth endpoints under `/api/auth`.

## 2026-07-07 - Preserve Existing API Collection Format

Status: Accepted

Context: The project already has `api_collections/Default` with OpenCollection YAML and Bruno extension metadata.

Decision: Update the existing collection instead of creating a new parallel `api_collection` or `.bru` collection.

Consequences: Agents must add and update request YAML files under `api_collections/Default` when API behavior changes.

## 2026-07-07 - Use Dedicated Docs Instead Of A Large Agent File

Status: Accepted

Context: Agent instructions need to cover workflow, architecture, API docs, and feature progress without making the root file hard to scan.

Decision: Keep `AGENTS.md` concise and move topic-specific details into `docs/`.

Consequences: Future agents should update the focused doc that matches the change instead of appending everything to `AGENTS.md`.
