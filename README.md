# VetinariBO

Backoffice for keeping track of all clients, leads, workshops, repos and so on.

It reuses the UI stack of the [Vetinari](../vetinari) agent console — React 19, Vite,
Tailwind CSS 4 with shadcn/ui (new-york) conventions, TanStack Router and Query,
lucide icons, and a Hono server — on top of a small local SQLite database.

## Stack

| Concern  | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| UI       | React 19, TanStack Router, TanStack Query, Tailwind CSS 4, lucide |
| Build    | Vite 8, TypeScript 5 (strict, ESM, `NodeNext`)                    |
| Server   | Hono 4 on `@hono/node-server`                                     |
| Database | SQLite through Node's built-in `node:sqlite`, queried with Kysely |

The database differs from Vetinari on purpose: Vetinari runs PostgreSQL in Docker,
while the backoffice only needs one local file. The query layer is still Kysely, so
the same migration and query style applies and a later move to PostgreSQL is a
dialect swap rather than a rewrite.

## Getting started

```bash
pnpm install
pnpm build          # compile the server and the SPA
pnpm start          # http://localhost:3000
```

`pnpm start` runs pending migrations before listening, so the first run creates
`data/vetinari-bo.db` on its own.

### Development

Run the API and the Vite dev server side by side:

```bash
pnpm dev:server     # Hono API on :3000
pnpm dev            # Vite dev server on :5174, proxying /api to :3000
```

### Checks

```bash
pnpm check          # format:check, lint, typecheck, test
```

## Configuration

Copy `.env.example` to `.env` to override the defaults.

| Variable                    | Default                 | Purpose                            |
| --------------------------- | ----------------------- | ---------------------------------- |
| `VETINARI_BO_DATABASE_FILE` | `./data/vetinari-bo.db` | Path to the local SQLite file      |
| `VETINARI_BO_PORT`          | `3000`                  | Port the server listens on         |
| `VETINARI_BO_PROXY`         | `http://localhost:3000` | API target for the Vite dev server |

## Theming

All colours, fonts, and radii live in `app/src/styles.css`.

| What                            | Where                                                    |
| ------------------------------- | -------------------------------------------------------- |
| Font files loaded               | the `@fontsource/*` imports at the top                   |
| Font families                   | `--font-sans`, `--font-serif`, `--font-mono` in `:root`  |
| Light palette                   | the `:root` block                                        |
| Dark palette                    | the `.dark` block                                        |
| Shadows, radius, letter spacing | `--shadow-*`, `--radius`, `--tracking-normal` in `:root` |

Components never hardcode a colour; they use the semantic Tailwind utilities
(`bg-primary`, `text-muted-foreground`, `border-border`). Changing `--primary`
therefore restyles every button, active nav item, icon badge, and focus ring at once.

Tokens use the shadcn/ui Tailwind 4 format: `oklch(...)` values assigned directly and
mapped to Tailwind colours in `@theme inline`. That means a theme from
[tweakcn.com](https://tweakcn.com) or [ui.shadcn.com/themes](https://ui.shadcn.com/themes)
can be pasted straight over the `:root` and `.dark` blocks with no conversion, and

```bash
npx shadcn@latest add dialog table dropdown-menu
```

drops components into `app/src/presentation/shared/ui/` that pick up the theme
automatically. `app/components.json` is already configured for this.

To change a font, install it and update the two matching lines:

```bash
pnpm add @fontsource/<name>
```

Run `pnpm dev:server` and `pnpm dev` while editing; Vite hot-reloads the stylesheet.

## The dashboard

The first page is the dashboard. It shows three metrics — workshops in the
register, how many are still upcoming, and the seats those offer — above the
workshop container view, which lists every workshop and shows an empty state
until one is added.

## Workshops

A workshop holds:

| Field             | Notes                           |
| ----------------- | ------------------------------- |
| `name`            | Public title                    |
| `date`            | ISO calendar date, `YYYY-MM-DD` |
| `maxApplicants`   | Positive integer                |
| `subject`         | Topic the workshop covers       |
| `url`             | Page hosting the workshop       |
| `locationName`    | Venue name                      |
| `locationAddress` | Venue street address            |

The location lives on the workshop rather than in its own table: the backoffice
only needs to show where a workshop happens, so a separate venue entity would add
joins without adding behavior.

### Adding a workshop

From the **Workshops** page in the UI, or from the command line:

```bash
pnpm db:add-workshop \
  --name "Agentic AI Kickstart" \
  --date 2026-10-14 \
  --max-applicants 20 \
  --subject "Building agents with Vetinari" \
  --url https://example.com/workshops/kickstart \
  --location-name "De Hoorn" \
  --location-address "Sluisstraat 79, 3000 Leuven"
```

Or over HTTP:

```bash
curl -X POST http://localhost:3000/api/workshops \
  -H 'content-type: application/json' \
  -d '{"name":"Agentic AI Kickstart","date":"2026-10-14","maxApplicants":20,
       "subject":"Building agents with Vetinari",
       "url":"https://example.com/workshops/kickstart",
       "locationName":"De Hoorn","locationAddress":"Sluisstraat 79, 3000 Leuven"}'
```

## HTTP API

| Method | Path             | Purpose                                             |
| ------ | ---------------- | --------------------------------------------------- |
| `GET`  | `/health`        | Liveness probe                                      |
| `GET`  | `/api/workshops` | List workshops, soonest first                       |
| `POST` | `/api/workshops` | Create a workshop; `400` carries field-level issues |

Any other path serves the SPA shell.

## Layout

```text
src/                      server and database
  contracts/              zod schemas shared by the API and the CLI
  db/                     Kysely setup, node:sqlite dialect, migrations, repositories
  server/                 Hono routes and SPA hosting
  scripts/                command-line entry points
app/src/                  the SPA
  domain/                 client-side contracts and formatting
  transport/              fetch wrappers for the backoffice API
  application/            TanStack Query keys and hooks
  presentation/           routes, shell, shared UI, and feature pages
test/                     Vitest suites
```

## Database migrations

Migrations live in `src/db/migrations.ts` and run automatically on server start.
To apply them without starting the server:

```bash
pnpm db:migrate
```
