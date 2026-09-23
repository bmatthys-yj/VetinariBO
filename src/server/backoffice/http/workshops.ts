import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { workshopInputSchema, type WorkshopSummary } from "../../../contracts/workshop.js";
import { createWorkshop, findWorkshopById, listWorkshops } from "../../../db/workshops.js";
import type { WorkshopWithSeats } from "../../../db/workshops.js";
import { workshopPublicUrl } from "../../config.js";
import type { BackofficeDatabase } from "../../../db/index.js";

/** Add the derived public link the backoffice shows and copies. */
function toSummary(workshop: WorkshopWithSeats, publicBaseUrl: string): WorkshopSummary {
  return { ...workshop, publicUrl: workshopPublicUrl(publicBaseUrl, workshop.slug) };
}

/** REST routes for the workshop register, mounted under the API base path. */
export function createWorkshopsRouter(db: BackofficeDatabase, publicBaseUrl: string): Hono {
  const router = new Hono();

  router.get("/workshops", async (context) => {
    const workshops = await listWorkshops(db);
    return context.json({ workshops: workshops.map((w) => toSummary(w, publicBaseUrl)) });
  });

  router.get("/workshops/:workshopId", async (context) => {
    const workshop = await findWorkshopById(db, context.req.param("workshopId"));
    if (!workshop) return context.json({ error: "Workshop not found." }, 404);
    return context.json({ workshop: toSummary(workshop, publicBaseUrl) });
  });

  router.post(
    "/workshops",
    zValidator("json", workshopInputSchema, (result, context) => {
      if (result.success) return;
      return context.json(
        {
          error: "The workshop is not valid.",
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }),
    async (context) => {
      const created = await createWorkshop(db, context.req.valid("json"));
      // Echo back the seat fields so the client gets the same shape as a list read.
      const workshop = await findWorkshopById(db, created.id);
      return context.json({ workshop: workshop ? toSummary(workshop, publicBaseUrl) : null }, 201);
    },
  );

  return router;
}
