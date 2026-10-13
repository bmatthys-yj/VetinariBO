import { Hono } from "hono";
import { createWorkshopsRouter } from "./http/workshops.js";
import { createEnrollmentsRouter } from "./http/enrollments.js";
import { createLeadsRouter } from "./http/leads.js";
import type { createLeadResearch } from "../leadResearch.js";
import { createSpaRouter } from "../shared/spa/router.js";
import { resolveAssetsDir } from "../shared/spa/assets.js";
import type { BackofficeDatabase } from "../../db/index.js";

/** Public path the SPA uses for backoffice HTTP endpoints. */
export const API_BASE_PATH = "/api";

export interface BackofficeAppOptions {
  /** Origin the hosted enrollment form is reachable at, used to build links. */
  readonly publicBaseUrl: string;
  /** Looks up each lead's company. Without it, lookups cannot be retried. */
  readonly researchCompany?: ReturnType<typeof createLeadResearch>["request"];
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
  app.route(API_BASE_PATH, createLeadsRouter(db, options.researchCompany));
  app.route("/", createSpaRouter(resolveAssetsDir("app")));
  return app;
}
