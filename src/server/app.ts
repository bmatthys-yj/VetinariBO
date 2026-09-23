import { Hono } from "hono";
import { createWorkshopsRouter } from "./http/workshops.js";
import { createSpaRouter } from "./spa/router.js";
import type { BackofficeDatabase } from "../db/index.js";

/** Public path the SPA uses for backoffice HTTP endpoints. */
export const API_BASE_PATH = "/api";

/** Compose the backoffice HTTP application. */
export function createBackofficeApp(db: BackofficeDatabase): Hono {
  const app = new Hono();
  app.get("/health", (context) => context.json({ status: "ok" }));
  app.route(API_BASE_PATH, createWorkshopsRouter(db));
  app.route("/", createSpaRouter());
  return app;
}
