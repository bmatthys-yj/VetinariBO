import { parseArgs } from "node:util";
import { workshopInputSchema } from "../contracts/workshop.js";
import { createDatabase, resolveDatabaseFile } from "../db/index.js";
import { migrateToLatest } from "../db/migrate.js";
import { createWorkshop } from "../db/workshops.js";

const USAGE = `Add one workshop to the local backoffice database.

Usage:
  pnpm db:add-workshop \\
    --name "Agentic AI Kickstart" \\
    --date 2026-10-14 \\
    --max-applicants 20 \\
    --subject "Building agents with Vetinari" \\
    --url https://example.com/workshops/kickstart \\
    --location-name "De Hoorn" \\
    --location-address "Sluisstraat 79, 3000 Leuven"
`;

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    date: { type: "string" },
    "max-applicants": { type: "string" },
    subject: { type: "string" },
    url: { type: "string" },
    "location-name": { type: "string" },
    "location-address": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

const parsed = workshopInputSchema.safeParse({
  name: values.name,
  date: values.date,
  maxApplicants: values["max-applicants"],
  subject: values.subject,
  url: values.url,
  locationName: values["location-name"],
  locationAddress: values["location-address"],
});

/** Render a schema field name as the command-line flag that sets it. */
function toFlag(path: PropertyKey[]): string {
  return `--${String(path[0]).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

if (!parsed.success) {
  console.error("The workshop is not valid:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${toFlag(issue.path as PropertyKey[])}: ${issue.message}`);
  }
  console.error(`\n${USAGE}`);
  process.exit(1);
}

const db = createDatabase(resolveDatabaseFile());
try {
  await migrateToLatest(db);
  const workshop = await createWorkshop(db, parsed.data);
  console.log(`Added workshop ${workshop.name} (${workshop.id}) on ${workshop.date}.`);
} finally {
  await db.destroy();
}
