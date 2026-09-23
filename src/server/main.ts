import { serve } from "@hono/node-server";
import { createDatabase, resolveDatabaseFile } from "../db/index.js";
import { migrateToLatest } from "../db/migrate.js";
import { createBackofficeApp } from "./backoffice/app.js";
import { createPublicApp } from "./public/app.js";
import { readServerConfig } from "./config.js";

const config = readServerConfig();
const file = resolveDatabaseFile();
const db = createDatabase(file);

await migrateToLatest(db);

// Two apps, two ports. The backoffice binds to loopback by default, so only the
// public form is reachable from the network.
serve(
  {
    fetch: createBackofficeApp(db, { publicBaseUrl: config.publicBaseUrl }).fetch,
    hostname: config.backofficeHost,
    port: config.backofficePort,
  },
  (info) => {
    console.log(`Backoffice  http://${config.backofficeHost}:${info.port}`);
  },
);

serve(
  {
    fetch: createPublicApp(db, { trustProxy: process.env.VETINARI_BO_TRUST_PROXY === "true" })
      .fetch,
    hostname: config.publicHost,
    port: config.publicPort,
  },
  (info) => {
    console.log(`Public form ${config.publicBaseUrl} (bound to ${config.publicHost}:${info.port})`);
    console.log(`Database    ${file}`);
  },
);
