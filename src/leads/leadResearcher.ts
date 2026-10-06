import { lookUpCompany } from "../agents/pappers/companyLookup.js";
import { AgentRunError } from "../agents/runAgent.js";
import type { AgentDefinition } from "../agents/types.js";
import type { BackofficeDatabase } from "../db/index.js";
import {
  findLeadResearchSubject,
  listLeadIdsByResearchStatus,
  updateLeadResearch,
} from "../db/leads.js";
import { LiteLlmError, type LiteLlmClient } from "../llm/liteLlm.js";

export interface LeadResearcherOptions {
  readonly liteLlm: LiteLlmClient;
  /** The Pappers agent. `undefined` marks every lookup as skipped. */
  readonly agent: AgentDefinition | undefined;
}

/**
 * Looks up the company of each new lead with the Pappers agent, in the
 * background.
 *
 * Lookups run one at a time, so a burst of enrollments cannot burst Pappers
 * credits or gateway spend. Progress lives in the lead row rather than in
 * memory, so a restart loses nothing: `resume` picks up whatever was queued or
 * cut short.
 */
export class LeadResearcher {
  readonly #db: BackofficeDatabase;
  readonly #liteLlm: LiteLlmClient;
  readonly #agent: AgentDefinition | undefined;
  readonly #queue: string[] = [];
  #draining: Promise<void> | undefined;

  constructor(db: BackofficeDatabase, options: LeadResearcherOptions) {
    this.#db = db;
    this.#liteLlm = options.liteLlm;
    this.#agent = options.agent;
  }

  /** Settings that must be set before lookups can run. */
  get missingConfig(): string[] {
    return [
      ...(this.#liteLlm.configured ? [] : ["VETINARI_BO_LITELLM_API_KEY"]),
      ...(this.#agent ? this.#agent.missingConfig : ["VETINARI_BO_PAPPERS_API_TOKEN"]),
    ];
  }

  /** Queue a lead's lookup. Does nothing unless the lead is waiting for one. */
  enqueue(leadId: string): void {
    if (!this.#queue.includes(leadId)) this.#queue.push(leadId);
    this.#draining ??= this.#drain();
  }

  /** Look a lead's company up again, replacing the previous result when done. */
  async retry(leadId: string): Promise<void> {
    await updateLeadResearch(this.#db, leadId, { status: "pending" });
    this.enqueue(leadId);
  }

  /**
   * Queue every lookup a restart interrupted. Once the agent is configured,
   * lookups skipped for lack of configuration are queued as well.
   */
  async resume(): Promise<void> {
    if (this.missingConfig.length === 0) {
      for (const id of await listLeadIdsByResearchStatus(this.#db, ["skipped"])) {
        await updateLeadResearch(this.#db, id, { status: "pending" });
      }
    }
    for (const id of await listLeadIdsByResearchStatus(this.#db, ["pending", "running"])) {
      this.enqueue(id);
    }
  }

  /** Resolves once the queue is empty. */
  async idle(): Promise<void> {
    while (this.#draining) await this.#draining;
  }

  async #drain(): Promise<void> {
    // Yield first, so `#draining` is assigned before the loop can finish.
    await Promise.resolve();
    try {
      for (let id = this.#queue.shift(); id !== undefined; id = this.#queue.shift()) {
        try {
          await this.#research(id);
        } catch (error) {
          // A database failure here must not take the queue down with it.
          console.error(`Company lookup for lead ${id} could not be recorded.`, error);
        }
      }
    } finally {
      // Cleared in the same turn as the empty-queue check, so an `enqueue`
      // can never land between the two and be left waiting.
      this.#draining = undefined;
    }
  }

  async #research(leadId: string): Promise<void> {
    const subject = await findLeadResearchSubject(this.#db, leadId);
    if (!subject || (subject.status !== "pending" && subject.status !== "running")) return;

    const missing = this.missingConfig;
    if (missing.length > 0 || !this.#agent) {
      await updateLeadResearch(this.#db, leadId, {
        status: "skipped",
        error: `Set ${missing.join(", ")} to look companies up automatically.`,
      });
      return;
    }

    await updateLeadResearch(this.#db, leadId, { status: "running" });
    try {
      const result = await lookUpCompany(this.#liteLlm, this.#agent, subject);
      await updateLeadResearch(
        this.#db,
        leadId,
        result.found
          ? { status: "found", profile: result.profile }
          : { status: "not_found", error: result.reason },
      );
    } catch (error) {
      if (!(error instanceof LiteLlmError || error instanceof AgentRunError)) {
        console.error(`Company lookup for lead ${leadId} failed.`, error);
      }
      await updateLeadResearch(this.#db, leadId, {
        status: "failed",
        error:
          error instanceof LiteLlmError || error instanceof AgentRunError
            ? error.message
            : "The company lookup failed unexpectedly.",
      });
    }
  }
}
