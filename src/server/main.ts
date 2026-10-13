import { serve } from "@hono/node-server";
import { createDatabase, resolveDatabaseFile } from "../db/index.js";
import { migrateToLatest } from "../db/migrate.js";
import { createBackofficeApp } from "./backoffice/app.js";
import { createPublicApp } from "./public/app.js";
import { readServerConfig } from "./config.js";
import { loadEnvFile } from "../env.js";
import { createLeadResearch } from "./leadResearch.js";

loadEnvFile();

const config = readServerConfig();
const file = resolveDatabaseFile();
const db = createDatabase(file);
await migrateToLatest(db);
const research = createLeadResearch(db, config);

// Two apps, two ports. The backoffice binds to loopback by default, so only the
// public form is reachable from the network.
const backofficeServer = serve(
  {
    fetch: createBackofficeApp(db, {
      publicBaseUrl: config.publicBaseUrl,
      researchCompany: research.request,
    }).fetch,
    hostname: config.backofficeHost,
    port: config.backofficePort,
  },
  (info) => {
    console.log(`Backoffice  http://${config.backofficeHost}:${info.port}`);
  },
);

const publicServer = serve(
  {
    fetch: createPublicApp(db, {
      trustProxy: process.env.VETINARI_BO_TRUST_PROXY === "true",
      // Enrollment has committed; start its company workflow without delaying the redirect.
      onEnrolled: (enrollment) => {
        if (enrollment.leadId)
          void research.request(enrollment.leadId, false).catch(() => {
            console.error("Could not start the company lookup.");
          });
      },
    }).fetch,
    hostname: config.publicHost,
    port: config.publicPort,
  },
  (info) => {
    console.log(`Public form ${config.publicBaseUrl} (bound to ${config.publicHost}:${info.port})`);
    console.log(`Database    ${file}`);
  },
);

// Stop HTTP admission first, then release research before closing its database.
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  const serversClosed = Promise.all(
    [backofficeServer, publicServer].map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
  await Promise.all([research.close(), serversClosed]);
  await db.destroy();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown().catch((error) => {
      console.error("Server shutdown failed.", error);
      process.exitCode = 1;
    });
  });
}
