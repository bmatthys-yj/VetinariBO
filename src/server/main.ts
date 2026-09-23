import { serve } from "@hono/node-server";
import { createDatabase, resolveDatabaseFile } from "../db/index.js";
import { migrateToLatest } from "../db/migrate.js";
import { createBackofficeApp } from "./app.js";

const DEFAULT_PORT = 3000;

const configuredPort = Number(process.env.VETINARI_BO_PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;
const file = resolveDatabaseFile();
const db = createDatabase(file);

await migrateToLatest(db);

serve({ fetch: createBackofficeApp(db).fetch, port }, (info) => {
  console.log(`VetinariBO listening on http://localhost:${info.port}`);
  console.log(`Database: ${file}`);
});
