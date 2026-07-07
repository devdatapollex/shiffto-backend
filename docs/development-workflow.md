# Development Workflow

## Before Starting Work

1. Run `git status --short`.
2. Review recent commits with `git log --oneline -10` when context matters.
3. Look for manual changes that are not reflected in documentation, Swagger/OpenAPI, or `api_collections/Default`.
4. Compare the implementation against the docs you will rely on. If behavior, structure, routes, scripts, dependencies, or conventions have drifted from the docs, update the docs first.
5. If manual changes affect the work, update the relevant docs and API collection before starting the next feature.
6. Do not revert unrelated changes unless explicitly instructed.

## Incremental Feature Flow

1. Pick one feature or bugfix.
2. Record the feature in `docs/feature-progress.md` with status `Planned` or `In Progress`.
3. Use TDD for implementation work.
4. Implement the smallest correct slice.
5. Update Swagger/OpenAPI docs for API behavior.
6. Update `api_collections/Default` for client-ready requests.
7. Update `docs/feature-progress.md` with what was completed.
8. Run verification before claiming completion.
9. Commit the completed slice with a meaningful message when a small but significant milestone is done.

## Testing Standard

For feature or bugfix work:

- Start with a failing test when test infrastructure exists.
- If test infrastructure does not exist, add it as the first small feature before relying on manual checks.
- Keep tests focused on the public interface of the module.
- Prefer testing behavior through stable seams instead of testing private implementation details.

## Verification Standard

Before saying work is complete, run the relevant verification commands and report what passed or failed.

Current available commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

The current `check` script uses `bun run lint && bun run typecheck`. Use it only when Bun is available in the environment.

## Git Standard

- Make incremental commits for meaningful completed slices.
- Use concise, descriptive commit messages such as `docs: add agent workflow guide` or `feat: add shift route skeleton`.
- Do not commit secrets, `.env`, generated runtime uploads, or unrelated work.
- Inspect `git status`, `git diff`, and recent commits before committing.

## Dependency Standard

- Prefer recent compatible package versions.
- Check compatibility with the current TypeScript, Express, Prisma, Better Auth, and Node.js setup before installing.
- Avoid old tutorials or packages that require outdated CommonJS-only patterns unless there is a clear reason.
- Avoid broad dependency upgrades while implementing unrelated features.
