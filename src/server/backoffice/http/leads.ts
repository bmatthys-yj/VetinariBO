import { Hono } from "hono";
import { deleteLead, findLeadById, listLeads } from "../../../db/leads.js";
import type { BackofficeDatabase } from "../../../db/index.js";
import type { createLeadResearch } from "../../leadResearch.js";

/** Leads created from enrollments, and their company lookups. */
export function createLeadsRouter(
  db: BackofficeDatabase,
  researchCompany?: ReturnType<typeof createLeadResearch>["request"],
): Hono {
  const router = new Hono();

  router.get("/leads", async (context) => {
    return context.json({ leads: await listLeads(db) });
  });

  router.get("/leads/:leadId", async (context) => {
    const lead = await findLeadById(db, context.req.param("leadId"));
    if (!lead) return context.json({ error: "Lead not found." }, 404);
    return context.json({ lead });
  });

  // Look the company up again, such as after a failure or once the agent is configured.
  router.post("/leads/:leadId/research", async (context) => {
    const leadId = context.req.param("leadId");
    const lead = await findLeadById(db, leadId);
    if (!lead) return context.json({ error: "Lead not found." }, 404);
    if (!researchCompany) {
      return context.json({ error: "Company lookups are not enabled on this server." }, 503);
    }
    const result = await researchCompany(leadId);
    if (result.status === "unavailable") return context.json({ error: result.reason }, 503);
    if (result.status === "not_found") return context.json({ error: "Lead not found." }, 404);
    if (result.status === "running") {
      return context.json({ error: "The company is already being looked up." }, 409);
    }

    return context.json({ lead: await findLeadById(db, leadId) }, 202);
  });

  // Servicing an erasure request: the lead and every enrollment it made.
  router.delete("/leads/:leadId", async (context) => {
    const removed = await deleteLead(db, context.req.param("leadId"));
    if (!removed) return context.json({ error: "Lead not found." }, 404);
    return context.body(null, 204);
  });

  return router;
}
