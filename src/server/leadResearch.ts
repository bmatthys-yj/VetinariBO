import { getErrorFromUnknown } from "@mastra/core/error";
import { Mastra } from "@mastra/core/mastra";
import { withWorkflowAttribution } from "@quinus-yj/vetinari-runtime";
import type { BackofficeDatabase } from "../db/index.js";
import { claimLeadResearch, finishLeadResearch } from "../db/leads.js";
import { employerDomain } from "../leads/companyResearch.js";
import {
  createCompanyResearchWorkflow,
  companyResearchOutputSchema,
} from "../workflows/companyResearch.js";

/** Start native workflow runs and save their outcome for the lead page. */
export function createLeadResearch(
  db: BackofficeDatabase,
  config: Parameters<typeof createCompanyResearchWorkflow>[0],
) {
  const workflow = createCompanyResearchWorkflow(config);
  const mastra = new Mastra({ workflows: { companyResearch: workflow }, logger: false });
  const active = new Set<Promise<void>>();
  let closed = false;

  async function request(leadId: string, retry = true) {
    if (closed)
      return { status: "unavailable" as const, reason: "Company lookups are shutting down." };
    const claim = await claimLeadResearch(db, leadId, retry);
    if (typeof claim === "string") return { status: claim };
    const task = (async () => {
      try {
        const run = await mastra.getWorkflow("companyResearch").createRun({ runId: claim.runId });
        const outcome = await withWorkflowAttribution(
          {
            clientId: "vetinari-bo",
            workflowId: workflow.id,
            workflowRunId: run.runId,
          },
          () =>
            run.start({
              inputData: { company: claim.company, domain: employerDomain(claim.email) },
            }),
        );
        if (outcome.status !== "success") {
          throw outcome.status === "failed"
            ? outcome.error
            : new Error("Company lookup did not finish.");
        }
        const result = companyResearchOutputSchema.parse(outcome.result);
        await finishLeadResearch(
          db,
          claim,
          result.found
            ? { status: "found", profile: result.profile }
            : { status: "not_found", error: result.reason },
        );
      } catch (error) {
        let message = getErrorFromUnknown(error, {
          fallbackMessage: "Company lookup failed. Please retry.",
        }).message;
        for (const secret of [config.pappersApiToken, process.env.LITELLM_MASTER_KEY]) {
          if (secret)
            message = message
              .replaceAll(secret, "[redacted]")
              .replaceAll(encodeURIComponent(secret), "[redacted]");
        }
        await finishLeadResearch(db, claim, { status: "failed", error: message.slice(0, 1_000) });
      }
    })();
    active.add(task);
    void task
      .finally(() => active.delete(task))
      .catch(() => {
        console.error("Could not save the company lookup result.");
      });
    return { status: "accepted" as const };
  }

  return {
    request,
    async close() {
      closed = true;
      await Promise.allSettled(active);
    },
  };
}
