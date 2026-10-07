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
| Workflow | Pappers lookup followed by a company profile agent                |
| LLM      | Vetinari's LiteLLM gateway                                        |

The database differs from Vetinari on purpose: Vetinari runs PostgreSQL in Docker,
while the backoffice only needs one local file. The query layer is still Kysely, so
the same migration and query style applies and a later move to PostgreSQL is a
dialect swap rather than a rewrite.

## Getting started

Use Node.js 22.13.0 or later and pnpm 12.4.2.

VetinariBO installs its agent runtime from GitHub Packages. GitHub Packages
requires authentication for npm installs, including public packages. Configure
a classic GitHub token with `read:packages` in your user `~/.npmrc` (or the
matching CI secret) before installing:

```ini
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_TOKEN}
```

Keep the token in your user or CI configuration; the repository `.npmrc` only
routes the `@quinus-yj` scope to GitHub Packages.

```bash
pnpm install
pnpm build          # compile the servers, the SPA, and the public stylesheet
pnpm start
```

Two servers come up:

|                 | Address                 | For                                                      |
| --------------- | ----------------------- | -------------------------------------------------------- |
| Backoffice      | `http://127.0.0.1:3100` | You. Bound to loopback, so unreachable from the network. |
| Enrollment form | `http://localhost:3101` | Attendees. The only surface meant to be exposed.         |

The ports sit in the 3100 range so the backoffice can run alongside Vetinari,
which uses `:3000` for its server and `:5174` for its Agent Console dev server.

`pnpm start` runs pending migrations before listening, so the first run creates
`data/vetinari-bo.db` on its own.

### Development

Run the API and the Vite dev server side by side:

```bash
pnpm dev:server     # Hono API on :3100
pnpm dev            # Vite dev server on :5175, proxying /api to :3100
```

### Checks

```bash
pnpm check          # format:check, lint, typecheck, test
```

## Configuration

Copy `.env.example` to `.env` to override the defaults. The server, `pnpm db:migrate`,
and `pnpm db:add-workshop` load it on start; a variable exported in your shell
still wins over the file. The tests never read it.

| Variable                        | Default                 | Purpose                                           |
| ------------------------------- | ----------------------- | ------------------------------------------------- |
| `VETINARI_BO_DATABASE_FILE`     | `./data/vetinari-bo.db` | Path to the local SQLite file                     |
| `VETINARI_BO_PORT`              | `3100`                  | Backoffice port                                   |
| `VETINARI_BO_HOST`              | `127.0.0.1`             | Backoffice bind address                           |
| `VETINARI_BO_PUBLIC_PORT`       | `3101`                  | Enrollment form port                              |
| `VETINARI_BO_PUBLIC_HOST`       | `0.0.0.0`               | Enrollment form bind address                      |
| `VETINARI_BO_PUBLIC_BASE_URL`   | `http://localhost:3101` | Origin used to build form links                   |
| `VETINARI_BO_TRUST_PROXY`       | `false`                 | Trust `x-forwarded-for` when rate limiting        |
| `VETINARI_BO_PROXY`             | `http://localhost:3100` | Vite dev proxy target; follows `VETINARI_BO_PORT` |
| `LITELLM_BASE_URL`              | `http://localhost:4000` | LiteLLM gateway the agents run through            |
| `LITELLM_MASTER_KEY`            | _(unset)_               | Virtual key from the LiteLLM dashboard            |
| `LITELLM_MODEL`                 | _(unset)_               | Provider-owned deployment alias                   |
| `VETINARI_BO_PAPPERS_API_TOKEN` | _(unset)_               | Pappers International API token                   |
| `LITELLM_UI_MASTER_KEY`         | _(unset)_               | Admin UI password for `pnpm litellm:up`           |
| `LITELLM_PORT`                  | `4000`                  | Host port for `pnpm litellm:up`                   |

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
proof. Someone who names their company becomes a [lead](#leads) and is kept
after the workshop, and their company is looked up in public registers; the
notice says both. To service an erasure request, use **Erase** on the lead
detail page, which removes the lead and every enrollment it made. Someone who
named no company is removed from the workshop detail page.

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
curl -X POST http://localhost:3100/api/workshops \
  -H 'content-type: application/json' \
  -d '{"name":"Agentic AI Kickstart","date":"2026-10-14","maxApplicants":20,
       "subject":"Building agents with Vetinari",
       "url":"https://example.com/workshops/kickstart",
       "locationName":"De Hoorn","locationAddress":"Sluisstraat 79, 3000 Leuven"}'
```

## Leads

Anyone who names their company on an enrollment form becomes a lead. The
**Leads** section in the sidebar lists them; a lead's page shows what they filled
in, the workshops they enrolled for (marked upcoming or taken place), and what
the company research workflow found about their company.

- **One lead per person.** Leads are matched by email address, so enrolling for
  a second workshop joins the existing lead and refreshes the details given. A
  known lead who leaves the company field empty next time still collects the
  workshop; someone who never names a company never becomes a lead.
- **Created with the enrollment.** The lead is written in the same transaction
  as the enrollment, so there is no enrollment without its lead or the reverse.
- **Company research starts after enrollment.** The server starts a native
  workflow without delaying the attendee's redirect: fetch company data from
  Pappers, then ask an agent to summarize that record as a structured profile.
- **Only company information leaves the backoffice.** The workflow receives the
  company name and a work email domain. Personal mailbox domains such as
  `gmail.com`, attendee names, phone numbers, and full email addresses are omitted.
- **Failures are visible and retried manually.** The lead page shows the error
  and a **Retry lookup** button. Failed and unmatched lookups are not retried on
  later enrollments. **Look up again** also refreshes a completed profile.
- **Changing company starts over.** A changed company clears the previous
  profile and starts a new workflow after enrollment. Each run has an ID, so an
  old result cannot overwrite a changed company or a deleted lead.

## Lead company research

`src/workflows/companyResearch.ts` defines one native Mastra workflow with two
steps, using Vetinari's `createAgent` and LiteLLM provider directly:

1. **Lookup company.** Call the [Pappers REST API](https://www.pappers.in/api/documentation)
   to search by company name, prefer a unique exact match (ignoring accents,
   punctuation and common legal suffixes), then fetch that company's record.
   A sole search result is passed to the agent to assess. Ambiguous results fail
   with an error rather than selecting an arbitrary company. An empty search
   returns `not_found` without a model call.
2. **Summarize company.** Give the fetched record to a tool-free agent with
   native `structuredOutput` and the existing Zod profile schema. Mastra's
   `jsonPromptInjection: "auto"` includes the schema in the prompt when the
   gateway model does not advertise native schema support. It describes
   the company's business, headcount, address and identity in the expected
   format, or reports that the supplied record does not plausibly match.
   Invalid output fails the workflow; there is no prose-to-JSON parser.

The lookup defaults to Belgium. A work domain ending in `.fr`, `.de`, `.es`,
`.it`, `.nl`, `.ch`, `.lu`, `.no` or `.uk` selects that covered country's register.
Every HTTP request has a 30-second timeout. The agent has a two-minute time
budget and one model turn, with automatic retries disabled. If the base record
has no workforce figure or range, the lookup fetches only the `financials`
section. Large sections are capped before they reach the model.

`src/server/leadResearch.ts` connects workflow execution to the database and HTTP
routes. `request(leadId)` starts a fresh run for a manual lookup;
`request(leadId, false)` starts research after enrollment only when its status is
`pending`. A duplicate request for a running lead returns `409`; accepted runs
return `202`. The lead page polls while a run is active and displays the saved
profile or error when it completes. Missing credentials are recorded as failed
lookups so the server and enrollment form remain usable.

There is no queue scanner, automatic retry, persisted workflow snapshot, or
restart recovery. Existing pending rows can be started manually from the lead
page. An interrupted running lookup is not recovered after a process crash.
During a normal shutdown, the server stops admitting requests and waits for
active runs before closing the database.

The existing `company_research_run_id` column protects against late results. It
stays internal and is omitted from client and public responses. Historical
`skipped` statuses remain readable; new configuration errors use `failed`.

Configure `LITELLM_BASE_URL`, `LITELLM_MASTER_KEY`, `LITELLM_MODEL`, and
`VETINARI_BO_PAPPERS_API_TOKEN` in `.env`. Model requests use Vetinari's shared
LiteLLM gateway. The Pappers token is sent as a query parameter, as its API
requires, and credentials are redacted from errors saved for the UI.

The public app receives an `onEnrolled` callback from `src/server/main.ts`; it
imports neither the workflow nor any backoffice code.

### Share Vetinari's gateway

The backoffice and Vetinari run side by side and share Vetinari's gateway on
`localhost:4000`, which is already the default `LITELLM_BASE_URL`.
Start it from the Vetinari repository (`pnpm litellm:up` there), then in its
dashboard at <http://localhost:4000/ui/>:

1. Make sure a provider and a model deployment exist, such as `gpt-4o-mini`.
2. Create a virtual key for the backoffice only, so its spend is tracked and it
   can be revoked without touching Vetinari's key.
3. Set that key as `LITELLM_MASTER_KEY` in `.env` and restart.

Set `LITELLM_MODEL` to one of the gateway's deployment names.

### A separate gateway

`infra/litellm` can run a gateway for the backoffice alone, with its own
Postgres. If Vetinari's gateway already holds port 4000, choose another port
in `.env`:

```bash
LITELLM_PORT=4001
LITELLM_BASE_URL=http://localhost:4001
LITELLM_UI_MASTER_KEY=<choose-a-local-secret>
```

```bash
pnpm litellm:up         # start the gateway
pnpm litellm:health     # check gateway status and liveness
pnpm litellm:logs       # follow gateway logs
pnpm litellm:down       # stop it; keep dashboard data
```

Open `http://localhost:4001/ui/` and sign in as `admin` with
`LITELLM_UI_MASTER_KEY`. Create a model deployment and an application virtual
key, then set `LITELLM_MODEL` and `LITELLM_MASTER_KEY` for the workflow.

## HTTP API

Backoffice (`127.0.0.1:3100`):

| Method   | Path                                           | Purpose                                                 |
| -------- | ---------------------------------------------- | ------------------------------------------------------- |
| `GET`    | `/health`                                      | Liveness probe                                          |
| `GET`    | `/api/workshops`                               | List workshops, soonest first                           |
| `GET`    | `/api/workshops/:id`                           | One workshop, with its form link and seat counts        |
| `POST`   | `/api/workshops`                               | Create a workshop; `400` carries field-level issues     |
| `GET`    | `/api/workshops/:id/enrollments`               | Who enrolled                                            |
| `GET`    | `/api/workshops/:id/enrollments.csv`           | Enrollments as CSV                                      |
| `DELETE` | `/api/workshops/:id/enrollments/:enrollmentId` | Remove one enrollee                                     |
| `GET`    | `/api/leads`                                   | List leads, newest first, with their workshop count     |
| `GET`    | `/api/leads/:id`                               | One lead, with its company profile and workshops        |
| `POST`   | `/api/leads/:id/research`                      | Start a workflow; `202` accepted, `409` already running |
| `DELETE` | `/api/leads/:id`                               | Erase a lead and all of its enrollments                 |

Any other path serves the SPA shell.

Public enrollment form (`:3101`) — the entire surface an attendee can reach:

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
  workflows/              native company lookup and profile workflow
  tools/pappers/          Pappers REST client and response size limits
  leads/                  employer domain filtering
  server/
    config.ts             ports, bind addresses, and the public base URL
    shared/spa/           static asset serving, used by both apps
    backoffice/           the private app: workshops, enrollments, and leads
    public/               the public app: the hosted enrollment form only
    main.ts               starts both servers
  scripts/                command-line entry points
app/src/                  the backoffice SPA
  domain/                 client-side contracts and formatting
  transport/              fetch wrappers for the backoffice API
  application/            TanStack Query keys and hooks
  presentation/           routes, shell, shared UI, and feature pages
public-web/styles.css     Tailwind entry for the server-rendered form
infra/litellm/            optional local LiteLLM gateway with Postgres
test/                     Vitest suites, including the isolation boundary
```

## Database migrations

Migrations live in `src/db/migrations.ts` and run automatically on server start.
To apply them without starting the server:

```bash
pnpm db:migrate
```
