import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { workshopInputSchema } from "../../contracts/workshop.js";
import { createWorkshop, listWorkshops } from "../../db/workshops.js";
import type { BackofficeDatabase } from "../../db/index.js";

/** REST routes for the workshop register, mounted under the API base path. */
export function createWorkshopsRouter(db: BackofficeDatabase): Hono {
  const router = new Hono();

  router.get("/workshops", async (context) => {
    return context.json({ workshops: await listWorkshops(db) });
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
      const workshop = await createWorkshop(db, context.req.valid("json"));
      return context.json({ workshop }, 201);
    },
  );

  return router;
}
