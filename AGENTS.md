# AGENTS.md

## Repository overview

VetinariBO is the backoffice for the Vetinari platform: clients, leads, workshops,
and repositories. It is a single TypeScript package, not a monorepo.

- `src/` — two Hono apps, Kysely/SQLite database, shared zod contracts, CLI scripts.
- `app/` — the backoffice React SPA, built by Vite into `dist/app`.
- `public-web/` — Tailwind entry for the server-rendered enrollment form.
- `test/` — Vitest suites covering the repositories, HTTP routes, and the isolation boundary.

Keep the dependency direction one-way: `app/` talks to the server over HTTP only.
It must not import from `src/`, and the server must not import from `app/`.

**The load-bearing rule of this repository:** `src/server/public/` must never
import from `src/server/backoffice/`. The enrollment form is public; the
backoffice is not. They are separate Hono apps on separate ports precisely so
that no route can leak, and `test/isolation.test.ts` asserts it. If that test
fails, the fix is the code, never the test.

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
pnpm dev:server      # API on :3100
pnpm dev             # Vite dev server on :5175
```

Run `pnpm check` before handing off a change.

## Implementation notes

- Validate every request body with a zod schema from `src/contracts`. The `400`
  response carries field-level `issues` so the UI can render them inline.
- Add schema changes as a new entry in `src/db/migrations.ts`; keep the numeric
  name prefix so migrations stay ordered. Never edit an applied migration.
- The SPA router is a fall-through mounted last in
  `src/server/backoffice/app.ts`; add API routes before it.
- Anything the public app returns about a workshop must be an explicit projection
  (see `toWorkshopView` in `src/server/public/http/enroll.tsx`), never a spread of
  the row, so a column added later cannot leak onto a public page by default.
- A workshop's enrollment form is live as soon as the row exists: the slug is
  generated on insert and the page is rendered from the database per request.
  There is no publish step to keep in sync, and adding one would be a behaviour
  change worth discussing first.
- The backoffice has no authentication yet; it is protected only by binding to
  loopback. Do not expose it on a routable interface without adding auth.
- `src/db/nodeSqliteDialect.ts` is a small Kysely dialect over Node's built-in
  `node:sqlite`. It avoids a native build step. If the database moves to
  PostgreSQL, replace the dialect rather than the query code.

## Documentation

Update `README.md` when commands, configuration, the API, or the data model change.
