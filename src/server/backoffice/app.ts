import { Hono } from "hono";
import { createWorkshopsRouter } from "./http/workshops.js";
import { createEnrollmentsRouter } from "./http/enrollments.js";
import { createAgentsRouter } from "./http/agents.js";
import { LiteLlmClient } from "../../llm/liteLlm.js";
import type { AgentDefinition } from "../../agents/types.js";
import { DEFAULT_LITELLM_BASE_URL } from "../config.js";
import { createSpaRouter } from "../shared/spa/router.js";
import { resolveAssetsDir } from "../shared/spa/assets.js";
import type { BackofficeDatabase } from "../../db/index.js";

/** Public path the SPA uses for backoffice HTTP endpoints. */
export const API_BASE_PATH = "/api";

export interface BackofficeAppOptions {
  /** Origin the hosted enrollment form is reachable at, used to build links. */
  readonly publicBaseUrl: string;
  /** Gateway the agents run through. Defaults to an unconfigured local gateway. */
  readonly liteLlm?: LiteLlmClient;
  /** Built-in agents to serve. Defaults to none. */
  readonly agents?: readonly AgentDefinition[];
}

/**
 * Compose the backoffice HTTP application.
 *
 * This app is never exposed publicly; the enrollment form is served by the
 * separate app in `../public`, which shares no routing with this one.
 */
export function createBackofficeApp(db: BackofficeDatabase, options: BackofficeAppOptions): Hono {
  const app = new Hono();
  app.get("/health", (context) => context.json({ status: "ok" }));
  app.route(API_BASE_PATH, createWorkshopsRouter(db, options.publicBaseUrl));
  app.route(API_BASE_PATH, createEnrollmentsRouter(db));
  const liteLlm =
    options.liteLlm ?? new LiteLlmClient({ baseUrl: DEFAULT_LITELLM_BASE_URL, apiKey: undefined });
  app.route(API_BASE_PATH, createAgentsRouter(options.agents ?? [], liteLlm));
  app.route("/", createSpaRouter(resolveAssetsDir("app")));
  return app;
}
