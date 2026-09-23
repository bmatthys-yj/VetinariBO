# AGENTS.md

## Repository overview

VetinariBO is the backoffice for the Vetinari platform: clients, leads, workshops,
and repositories. It is a single TypeScript package, not a monorepo.

- `src/` — Hono server, Kysely/SQLite database, shared zod contracts, CLI scripts.
- `app/` — the React SPA, built by Vite into `dist/app` and served by the server.
- `test/` — Vitest suites covering the repositories and HTTP routes.

Keep the dependency direction one-way: `app/` talks to the server over HTTP only.
It must not import from `src/`, and the server must not import from `app/`.

## Working conventions

- Use `pnpm`; do not introduce npm or Yarn lockfiles.
- Keep source code in TypeScript and preserve strict type checking.
- `src/` is ESM with `NodeNext` resolution: include `.js` extensions in relative
  imports. `app/` uses bundler resolution and extensionless imports.
- Prefer `import type` for type-only imports.
- Mirror the Vetinari agent console for UI work: Tailwind utility classes with the
  shared CSS variables in `app/src/styles.css`, shadcn/ui "new-york" component
  conventions in `app/src/presentation/shared/ui`, and lucide icons. The theme
  tokens use the current shadcn Tailwind 4 format (`oklch(...)` in `:root`/`.dark`,
  mapped in `@theme inline`), so generated themes paste in unchanged. Vetinari
  still uses the older HSL-triplet format; do not copy its `styles.css` verbatim.
- Never hardcode a colour in a component. Use the semantic utilities
  (`bg-primary`, `text-muted-foreground`, `border-border`) so both themes follow.
- Keep the layering in `app/src`: `domain` (types and pure helpers), `transport`
  (fetch), `application` (Query hooks), `presentation` (components).
- Database columns are snake_case; the contracts shared with the client are
  camelCase. The repositories in `src/db` are the only place that maps between them.
- Add or update nearby Vitest tests for behavior changes and regressions.
- Keep tests deterministic and free of network access; they run against a temporary
  SQLite file.
- Never commit `.env` or the local `data/` database.

## Commands

```bash
pnpm install         # install dependencies
pnpm check           # format:check, lint, typecheck, test
pnpm build           # compile the server and the SPA
pnpm start           # run the built server
pnpm dev:server      # API on :3000
pnpm dev             # Vite dev server on :5174
```

Run `pnpm check` before handing off a change.

## Implementation notes

- Validate every request body with a zod schema from `src/contracts`. The `400`
  response carries field-level `issues` so the UI can render them inline.
- Add schema changes as a new entry in `src/db/migrations.ts`; keep the numeric
  name prefix so migrations stay ordered. Never edit an applied migration.
- The SPA router is a fall-through mounted last in `src/server/app.ts`; add API
  routes before it.
- `src/db/nodeSqliteDialect.ts` is a small Kysely dialect over Node's built-in
  `node:sqlite`. It avoids a native build step. If the database moves to
  PostgreSQL, replace the dialect rather than the query code.

## Documentation

Update `README.md` when commands, configuration, the API, or the data model change.
