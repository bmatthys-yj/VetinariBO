import { Hono } from "hono";
import { createEnrollRouter } from "./http/enroll.js";
import { readAsset, resolveAssetsDir } from "../shared/spa/assets.js";
import type { BackofficeDatabase } from "../../db/index.js";

export interface PublicAppOptions {
  /** Trust `x-forwarded-for` for rate limiting. Only behind a proxy you control. */
  readonly trustProxy?: boolean;
}

/**
 * Compose the public enrollment application.
 *
 * This is the whole surface an attendee can reach. It deliberately imports
 * nothing from `../backoffice`, so there is no shared mount point through which
 * an admin route could be exposed, and nothing here reads or returns enrollee
 * data belonging to anyone else.
 */
export function createPublicApp(db: BackofficeDatabase, options: PublicAppOptions = {}): Hono {
  const app = new Hono();
  const assetsDir = resolveAssetsDir("public");

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.get("/assets/:file", (context) => {
    const asset = readAsset(assetsDir, `/assets/${context.req.param("file")}`);
    if (!asset) return context.text("Not found", 404);
    return context.body(new Uint8Array(asset.body), 200, {
      "content-type": `${asset.contentType}; charset=utf-8`,
      "cache-control": "public, max-age=3600",
    });
  });

  app.route("/", createEnrollRouter(db, options));

  return app;
}
