import { serve } from "@hono/node-server";
import { createDatabase, resolveDatabaseFile } from "../db/index.js";
import { migrateToLatest } from "../db/migrate.js";
import { createBackofficeApp } from "./backoffice/app.js";
import { createPublicApp } from "./public/app.js";
import { readServerConfig } from "./config.js";
import { LiteLlmClient } from "../llm/liteLlm.js";
import { loadEnvFile } from "../env.js";
import { createBuiltInAgents } from "../agents/registry.js";
import { PAPPERS_AGENT_ID } from "../agents/pappers/pappersAgent.js";
import { LeadResearcher } from "../leads/leadResearcher.js";

loadEnvFile();

const config = readServerConfig();
const file = resolveDatabaseFile();
const db = createDatabase(file);
const liteLlm = new LiteLlmClient({
  baseUrl: config.liteLlmBaseUrl,
  apiKey: config.liteLlmApiKey,
});
const agents = createBuiltInAgents({
  model: config.liteLlmModel,
  pappersApiToken: config.pappersApiToken,
});

const researcher = new LeadResearcher(db, {
  liteLlm,
  agent: agents.find((agent) => agent.id === PAPPERS_AGENT_ID),
});

await migrateToLatest(db);
await researcher.resume();

// Two apps, two ports. The backoffice binds to loopback by default, so only the
// public form is reachable from the network.
serve(
  {
    fetch: createBackofficeApp(db, {
      publicBaseUrl: config.publicBaseUrl,
      liteLlm,
      agents,
      researcher,
    }).fetch,
    hostname: config.backofficeHost,
    port: config.backofficePort,
  },
  (info) => {
    console.log(`Backoffice  http://${config.backofficeHost}:${info.port}`);
    console.log(
      `LiteLLM     ${liteLlm.baseUrl}${liteLlm.configured ? "" : " (no API key; agents cannot run)"}`,
    );
  },
);

serve(
  {
    fetch: createPublicApp(db, {
      trustProxy: process.env.VETINARI_BO_TRUST_PROXY === "true",
      // A new or changed lead is queued for its company lookup; anyone else is skipped.
      onEnrolled: (enrollment) => {
        if (enrollment.leadId) researcher.enqueue(enrollment.leadId);
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
