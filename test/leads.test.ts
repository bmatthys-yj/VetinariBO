import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Migrator } from "kysely";
import { createDatabase, type BackofficeDatabase } from "../src/db/index.js";
import { migrateToLatest } from "../src/db/migrate.js";
import { migrationProvider } from "../src/db/migrations.js";
import { createEnrollment, listEnrollments } from "../src/db/enrollments.js";
import { deleteLead, findLeadById, listLeads } from "../src/db/leads.js";
import { createWorkshop } from "../src/db/workshops.js";
import { createPublicApp } from "../src/server/public/app.js";
import { createBackofficeApp } from "../src/server/backoffice/app.js";
import { createBuiltInAgents } from "../src/agents/registry.js";
import {
  companyLookupPrompt,
  employerDomain,
  parseLookupReply,
} from "../src/agents/pappers/companyLookup.js";
import { LeadResearcher } from "../src/leads/leadResearcher.js";
import { LiteLlmClient } from "../src/llm/liteLlm.js";
import type { Enrollment } from "../src/contracts/enrollment.js";
import type { Workshop } from "../src/contracts/workshop.js";

const WORKSHOP = {
  name: "Agentic AI Kickstart",
  date: "2099-10-14",
  maxApplicants: 20,
  subject: "Building agents with Vetinari",
  url: undefined,
  locationName: "De Hoorn",
  locationAddress: "Sluisstraat 79, 3000 Leuven",
};

const ADA = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "Ada@Analytical.be",
  phone: "+32 470 00 00 00",
  company: "Analytical Engines",
  position: "CTO",
};

const PROFILE = {
  name: "ANALYTICAL ENGINES NV",
  companyNumber: "0123.456.789",
  countryCode: "BE",
  address: "Sluisstraat 79, 3000 Leuven",
  employees: "42 (2024)",
  activity: "Software consultancy",
};

let directory: string;
let db: BackofficeDatabase;
let workshop: Workshop;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "vetinari-bo-"));
  db = createDatabase(join(directory, "test.db"));
  await migrateToLatest(db);
  workshop = await createWorkshop(db, WORKSHOP);
});

afterEach(async () => {
  await db.destroy();
  rmSync(directory, { recursive: true, force: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A gateway that answers each chat completion with the next reply in line. */
function fakeGateway(replies: Array<() => Response>) {
  const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    const reply = replies[requests.length - 1];
    if (!reply) throw new Error("Unexpected gateway call");
    return reply();
  };
  return { requests, fetchImpl };
}

function textReply(content: string) {
  return () => json({ choices: [{ message: { role: "assistant", content } }] });
}

function researcherWith(
  replies: Array<() => Response>,
  setup: { liteLlmKey?: string | null; pappersToken?: string | null } = {},
) {
  const gateway = fakeGateway(replies);
  const liteLlm = new LiteLlmClient(
    {
      baseUrl: "http://gateway.test:4000",
      apiKey: setup.liteLlmKey === null ? undefined : "sk-test",
    },
    gateway.fetchImpl,
  );
  const [agent] = createBuiltInAgents({
    model: "claude-opus-5",
    pappersApiToken: setup.pappersToken === null ? undefined : "pappers-token",
    fetch: async () => json({ results: [] }),
  });
  return { gateway, liteLlm, researcher: new LeadResearcher(db, { liteLlm, agent }) };
}

describe("leads from enrollments", () => {
  it("creates a lead when the person names a company", async () => {
    const enrollment = await createEnrollment(db, workshop.id, ADA);
    expect(enrollment.leadId).toBeDefined();

    const [lead] = await listLeads(db);
    expect(lead).toMatchObject({
      id: enrollment.leadId,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@analytical.be",
      phone: "+32 470 00 00 00",
      company: "Analytical Engines",
      position: "CTO",
      companyResearchStatus: "pending",
      workshopCount: 1,
    });
  });

  it("does not create a lead without a company", async () => {
    const enrollment = await createEnrollment(db, workshop.id, { ...ADA, company: undefined });
    expect(enrollment.leadId).toBeUndefined();
    expect(await listLeads(db)).toEqual([]);
  });

  it("collects every workshop the same email enrolls for", async () => {
    const second = await createWorkshop(db, { ...WORKSHOP, name: "Evals", date: "2099-11-02" });
    const third = await createWorkshop(db, { ...WORKSHOP, name: "RAG", date: "2099-12-01" });
    const first = await createEnrollment(db, workshop.id, ADA);
    await createEnrollment(db, second.id, { ...ADA, email: "ada@analytical.be", phone: undefined });
    // No company this time, but the known lead still collects the workshop.
    await createEnrollment(db, third.id, { ...ADA, company: undefined });

    const leads = await listLeads(db);
    expect(leads).toHaveLength(1);
    const lead = await findLeadById(db, first.leadId!);
    expect(lead?.workshops.map((entry) => entry.workshopName)).toEqual([
      "Agentic AI Kickstart",
      "Evals",
      "RAG",
    ]);
    // A skipped optional field keeps what the earlier enrollment gave.
    expect(lead?.phone).toBe("+32 470 00 00 00");
  });

  it("queues a new lookup when the person names another company", async () => {
    const second = await createWorkshop(db, { ...WORKSHOP, name: "Evals" });
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { researcher } = researcherWith([
      textReply(JSON.stringify({ found: true, profile: PROFILE })),
    ]);
    researcher.enqueue(leadId!);
    await researcher.idle();
    expect((await findLeadById(db, leadId!))?.companyResearchStatus).toBe("found");

    await createEnrollment(db, second.id, { ...ADA, company: "Difference Engines" });
    const lead = await findLeadById(db, leadId!);
    expect(lead).toMatchObject({ company: "Difference Engines", companyResearchStatus: "pending" });
    expect(lead?.companyProfile).toBeUndefined();
  });

  it("erases the lead together with its enrollments", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    expect(await deleteLead(db, leadId!)).toBe(true);
    expect(await listLeads(db)).toEqual([]);
    expect(await listEnrollments(db, workshop.id)).toEqual([]);
  });

  it("reports the new enrollment and its lead to the public app's hook", async () => {
    const seen: Enrollment[] = [];
    const app = createPublicApp(db, { onEnrolled: (enrollment) => seen.push(enrollment) });
    const response = await app.request(`/w/${workshop.slug}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@analytical.be",
        company: "Analytical Engines",
        consent: "yes",
      }).toString(),
    });
    expect(response.status).toBe(303);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.leadId).toBe((await listLeads(db))[0]?.id);
  });

  it("still confirms the enrollment when the hook throws", async () => {
    const app = createPublicApp(db, {
      onEnrolled: () => {
        throw new Error("queue unavailable");
      },
    });
    const response = await app.request(`/w/${workshop.slug}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@analytical.be",
        company: "Analytical Engines",
        consent: "yes",
      }).toString(),
    });
    expect(response.status).toBe(303);
    expect(await listEnrollments(db, workshop.id)).toHaveLength(1);
  });
});

describe("company lookup", () => {
  it("stores the profile the Pappers agent reports", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { gateway, researcher } = researcherWith([
      textReply("```json\n" + JSON.stringify({ found: true, profile: PROFILE }) + "\n```"),
    ]);
    researcher.enqueue(leadId!);
    await researcher.idle();

    const lead = await findLeadById(db, leadId!);
    expect(lead?.companyResearchStatus).toBe("found");
    expect(lead?.companyProfile).toMatchObject(PROFILE);
    expect(lead?.companyResearchedAt).toBeTruthy();

    // Only the company and the work domain leave the backoffice.
    const prompt = gateway.requests[0]?.messages.find((message) => message.role === "user");
    expect(prompt?.content).toContain('"Analytical Engines"');
    expect(prompt?.content).toContain("analytical.be");
    expect(prompt?.content).not.toContain("Lovelace");
    expect(prompt?.content).not.toContain("+32");
  });

  it("records a company the agent could not match", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { researcher } = researcherWith([
      textReply(JSON.stringify({ found: false, reason: "No company by that name." })),
    ]);
    researcher.enqueue(leadId!);
    await researcher.idle();
    expect(await findLeadById(db, leadId!)).toMatchObject({
      companyResearchStatus: "not_found",
      companyResearchError: "No company by that name.",
    });
  });

  it("fails the lookup on a reply that is not a profile", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { researcher } = researcherWith([textReply("It is a software company in Leuven.")]);
    researcher.enqueue(leadId!);
    await researcher.idle();
    expect(await findLeadById(db, leadId!)).toMatchObject({
      companyResearchStatus: "failed",
      companyResearchError: "The agent did not answer with a company profile.",
    });
  });

  it("fails the lookup when the gateway errors", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { researcher } = researcherWith([
      () => json({ error: { message: "Invalid model name" } }, 400),
    ]);
    researcher.enqueue(leadId!);
    await researcher.idle();
    expect(await findLeadById(db, leadId!)).toMatchObject({
      companyResearchStatus: "failed",
      companyResearchError: "Invalid model name",
    });
  });

  it("skips the lookup while the agent is not configured, and resumes once it is", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const unconfigured = researcherWith([], { pappersToken: null });
    unconfigured.researcher.enqueue(leadId!);
    await unconfigured.researcher.idle();
    expect(await findLeadById(db, leadId!)).toMatchObject({
      companyResearchStatus: "skipped",
      companyResearchError: "Set VETINARI_BO_PAPPERS_API_TOKEN to look companies up automatically.",
    });
    expect(unconfigured.gateway.requests).toHaveLength(0);

    const configured = researcherWith([
      textReply(JSON.stringify({ found: true, profile: PROFILE })),
    ]);
    await configured.researcher.resume();
    await configured.researcher.idle();
    expect((await findLeadById(db, leadId!))?.companyResearchStatus).toBe("found");
  });

  it("runs one lookup per lead, however often it is queued", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { gateway, researcher } = researcherWith([
      textReply(JSON.stringify({ found: true, profile: PROFILE })),
    ]);
    researcher.enqueue(leadId!);
    researcher.enqueue(leadId!);
    await researcher.idle();
    researcher.enqueue(leadId!);
    await researcher.idle();
    expect(gateway.requests).toHaveLength(1);
  });

  it("parses a reply wrapped in prose and drops empty fields", () => {
    const result = parseLookupReply(
      `Here it is: {"found": true, "profile": {"name": "ACME", "website": "", "employees": null}}`,
    );
    expect(result).toEqual({ found: true, profile: { name: "ACME" } });
  });

  it("keeps personal mailbox domains out of the prompt", () => {
    expect(employerDomain("ada@gmail.com")).toBeUndefined();
    expect(employerDomain("ada@analytical.be")).toBe("analytical.be");
    expect(companyLookupPrompt("Acme", undefined)).toContain("Work email domain: unknown");
  });
});

describe("leads API", () => {
  function appWith(researcher?: LeadResearcher) {
    return createBackofficeApp(db, { publicBaseUrl: "http://localhost:3101", researcher });
  }

  it("lists leads and shows one with its workshops", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const list = (await (await appWith().request("/api/leads")).json()) as {
      leads: Array<{ id: string; workshopCount: number }>;
    };
    expect(list.leads).toEqual([expect.objectContaining({ id: leadId, workshopCount: 1 })]);

    const detail = (await (await appWith().request(`/api/leads/${leadId}`)).json()) as {
      lead: { email: string; workshops: Array<{ workshopId: string; workshopDate: string }> };
    };
    expect(detail.lead.email).toBe("ada@analytical.be");
    expect(detail.lead.workshops).toEqual([
      expect.objectContaining({ workshopId: workshop.id, workshopDate: "2099-10-14" }),
    ]);
  });

  it("returns 404 for an unknown lead", async () => {
    expect((await appWith().request("/api/leads/nope")).status).toBe(404);
    expect((await appWith().request("/api/leads/nope", { method: "DELETE" })).status).toBe(404);
  });

  it("looks a company up again on request", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { researcher } = researcherWith([
      textReply(JSON.stringify({ found: false })),
      textReply(JSON.stringify({ found: true, profile: PROFILE })),
    ]);
    researcher.enqueue(leadId!);
    await researcher.idle();

    const response = await appWith(researcher).request(`/api/leads/${leadId}/research`, {
      method: "POST",
    });
    expect(response.status).toBe(202);
    await researcher.idle();
    expect((await findLeadById(db, leadId!))?.companyProfile?.name).toBe(PROFILE.name);
  });

  it("refuses to look up while the agent is not configured", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const { researcher } = researcherWith([], { liteLlmKey: null });
    const response = await appWith(researcher).request(`/api/leads/${leadId}/research`, {
      method: "POST",
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Set VETINARI_BO_LITELLM_API_KEY to look companies up.",
    });
  });

  it("erases a lead", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    const response = await appWith().request(`/api/leads/${leadId}`, { method: "DELETE" });
    expect(response.status).toBe(204);
    expect(await listLeads(db)).toEqual([]);
  });
});

describe("lead migration", () => {
  it("backfills leads from enrollments that named a company", async () => {
    const file = join(directory, "legacy.db");
    const legacy = createDatabase(file);
    try {
      const migrator = new Migrator({ db: legacy, provider: migrationProvider });
      await migrator.migrateTo("0006_drop_agents");
      const legacyWorkshop = await createWorkshop(legacy, WORKSHOP);
      const later = await createWorkshop(legacy, { ...WORKSHOP, name: "Evals" });
      const row = {
        workshop_id: legacyWorkshop.id,
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@analytical.be",
        phone: null,
        company: "Analytical Engines",
        position: null,
        consented_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      };
      await legacy
        .insertInto("enrollments")
        .values([
          { ...row, id: "e1" },
          { ...row, id: "e2", workshop_id: later.id, position: "CTO", created_at: "2026-02-01" },
          { ...row, id: "e3", email: "grace@example.com", company: null },
        ] as never)
        .execute();

      await migrateToLatest(legacy);

      const leads = await listLeads(legacy);
      expect(leads).toHaveLength(1);
      // The most recent enrollment's details win.
      expect(leads[0]).toMatchObject({
        position: "CTO",
        workshopCount: 2,
        companyResearchStatus: "pending",
      });
    } finally {
      await legacy.destroy();
    }
  });
});
