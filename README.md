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
| Server   | Hono 4 on `@hono/node-server`, two apps on two ports              |
| Database | SQLite through Node's built-in `node:sqlite`, queried with Kysely |

The database differs from Vetinari on purpose: Vetinari runs PostgreSQL in Docker,
while the backoffice only needs one local file. The query layer is still Kysely, so
the same migration and query style applies and a later move to PostgreSQL is a
dialect swap rather than a rewrite.

## Getting started

```bash
pnpm install
pnpm build          # compile the servers, the SPA, and the public stylesheet
pnpm start
```

Two servers come up:

|                 | Address                 | For                                                      |
| --------------- | ----------------------- | -------------------------------------------------------- |
| Backoffice      | `http://127.0.0.1:3000` | You. Bound to loopback, so unreachable from the network. |
| Enrollment form | `http://localhost:3001` | Attendees. The only surface meant to be exposed.         |

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

| Variable                      | Default                 | Purpose                                    |
| ----------------------------- | ----------------------- | ------------------------------------------ |
| `VETINARI_BO_DATABASE_FILE`   | `./data/vetinari-bo.db` | Path to the local SQLite file              |
| `VETINARI_BO_PORT`            | `3000`                  | Backoffice port                            |
| `VETINARI_BO_HOST`            | `127.0.0.1`             | Backoffice bind address                    |
| `VETINARI_BO_PUBLIC_PORT`     | `3001`                  | Enrollment form port                       |
| `VETINARI_BO_PUBLIC_HOST`     | `0.0.0.0`               | Enrollment form bind address               |
| `VETINARI_BO_PUBLIC_BASE_URL` | `http://localhost:3001` | Origin used to build form links            |
| `VETINARI_BO_TRUST_PROXY`     | `false`                 | Trust `x-forwarded-for` when rate limiting |
| `VETINARI_BO_PROXY`           | `http://localhost:3000` | API target for the Vite dev server         |

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

## The enrollment form

Every workshop gets a public sign-up page, served by a **separate application on
a separate port** from the backoffice. An attendee can reach the form and
nothing else.

### It is live the moment a workshop exists

There is no publish step, no build, and no background job. The slug is generated
when the workshop row is written, and `GET /w/:slug` reads the workshop at
request time — so the form is reachable the instant you press save. The
backoffice shows the link immediately after creation, on the workshop detail
page, and in each list row.

The slug carries a random suffix (`agentic-ai-kickstart-7f3k`), so a new
workshop is **unlisted**: nobody can find or enumerate it, and it is reachable
only by someone you send the link to. That is what makes publishing on save
safe without a draft state.

Treat the link as shareable-but-unguessable, not as an access control — anyone
holding it can enroll.

### What it collects

| Field                                          | Required |
| ---------------------------------------------- | -------- |
| First name, last name, email address           | yes      |
| Phone number, company, position in the company | no       |
| Consent to store the details                   | yes      |

The form is plain server-rendered HTML and submits as a normal form POST, so it
works with JavaScript disabled and stays light on a phone. Submitting redirects
to a confirmation page, so refreshing cannot enroll twice.

Enrollment is refused when the workshop is full, when its date has passed, or
when the email address is already enrolled. The seat check and the insert run in
one transaction, so two people cannot both take the last seat.

### How the two are kept apart

- The public app is composed independently in `src/server/public/app.ts` and
  imports nothing from `src/server/backoffice/`, so there is no shared mount
  point through which an admin route could be exposed.
- The backoffice binds to `127.0.0.1`, so it is not reachable from the network.
- The public app never returns enrollee data. What it shows about a workshop is
  an explicit projection, so a column added later cannot leak by default.
- `test/isolation.test.ts` asserts the public app 404s on every backoffice
  route. Treat that test as the feature, not as scaffolding.

### Privacy

Enrollments hold personal data, so the form carries a consent checkbox and a
short notice explaining what is stored and why, and records `consented_at` as
proof. Details are kept until the workshop has taken place. To service an
erasure request, remove the person from the workshop detail page.

Abuse protection on the public endpoint: per-IP rate limiting, a honeypot field,
and a request size cap. The rate limiter is in-memory, so it resets on restart
and would not survive running several instances.

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

Backoffice (`127.0.0.1:3000`):

| Method   | Path                                           | Purpose                                             |
| -------- | ---------------------------------------------- | --------------------------------------------------- |
| `GET`    | `/health`                                      | Liveness probe                                      |
| `GET`    | `/api/workshops`                               | List workshops, soonest first                       |
| `GET`    | `/api/workshops/:id`                           | One workshop, with its form link and seat counts    |
| `POST`   | `/api/workshops`                               | Create a workshop; `400` carries field-level issues |
| `GET`    | `/api/workshops/:id/enrollments`               | Who enrolled                                        |
| `GET`    | `/api/workshops/:id/enrollments.csv`           | Enrollments as CSV                                  |
| `DELETE` | `/api/workshops/:id/enrollments/:enrollmentId` | Remove one enrollee                                 |

Any other path serves the SPA shell.

Public enrollment form (`:3001`) — the entire surface an attendee can reach:

| Method | Path              | Purpose                                      |
| ------ | ----------------- | -------------------------------------------- |
| `GET`  | `/health`         | Liveness probe                               |
| `GET`  | `/w/:slug`        | The enrollment form, or a full / closed page |
| `POST` | `/w/:slug`        | Submit an enrollment, then redirect          |
| `GET`  | `/w/:slug/thanks` | Confirmation                                 |
| `GET`  | `/assets/*`       | The form's stylesheet                        |

Everything else is a 404.

## Layout

```text
src/                      servers and database
  contracts/              zod schemas shared by the API, the form, and the CLI
  db/                     Kysely setup, node:sqlite dialect, migrations, repositories
  server/
    config.ts             ports, bind addresses, and the public base URL
    shared/spa/           static asset serving, used by both apps
    backoffice/           the private app: workshops and enrollment management
    public/               the public app: the hosted enrollment form only
    main.ts               starts both servers
  scripts/                command-line entry points
app/src/                  the backoffice SPA
  domain/                 client-side contracts and formatting
  transport/              fetch wrappers for the backoffice API
  application/            TanStack Query keys and hooks
  presentation/           routes, shell, shared UI, and feature pages
public-web/styles.css     Tailwind entry for the server-rendered form
test/                     Vitest suites, including the isolation boundary
```

## Database migrations

Migrations live in `src/db/migrations.ts` and run automatically on server start.
To apply them without starting the server:

```bash
pnpm db:migrate
```
