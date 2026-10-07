import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { createLeadResearch } from "../src/server/leadResearch.js";
import type { Enrollment } from "../src/contracts/enrollment.js";
import type { Workshop } from "../src/contracts/workshop.js";
import { fakeAgentModel, type FakeModelReply } from "./fakeAgentModel.js";

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
let researchers: ReturnType<typeof createLeadResearch>[];

beforeEach(async () => {
  researchers = [];
  directory = mkdtempSync(join(tmpdir(), "vetinari-bo-"));
  db = createDatabase(join(directory, "test.db"));
  await migrateToLatest(db);
  workshop = await createWorkshop(db, WORKSHOP);
});

afterEach(async () => {
  await Promise.all(researchers.map((researcher) => researcher.close()));
  await db.destroy();
  rmSync(directory, { recursive: true, force: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textReply(text: string): FakeModelReply {
  return { type: "text", text };
}

async function researcherWith(replies: FakeModelReply[]) {
  const gateway = fakeAgentModel(replies);
  const researcher = createLeadResearch(db, {
    pappersApiToken: "pappers-token",
    model: gateway.model,
    fetch: async (input) =>
      json(
        new URL(String(input)).pathname.endsWith("/search")
          ? { results: [{ name: "ANALYTICAL ENGINES NV", company_number: "0123.456.789" }] }
          : { name: "ANALYTICAL ENGINES NV", company_number: "0123.456.789", workforce: 42 },
      ),
  });
  researchers.push(researcher);
  return { gateway, researcher };
}

async function finished(leadId: string) {
  await vi.waitFor(async () => {
    expect((await findLeadById(db, leadId))?.companyResearchStatus).not.toBe("running");
  });
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
    const { researcher } = await researcherWith([
      textReply(JSON.stringify({ found: true, profile: PROFILE })),
    ]);
    await researcher.request(leadId!, false);
    await finished(leadId!);
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

describe("leads API", () => {
  function appWith(researcher?: ReturnType<typeof createLeadResearch>) {
    return createBackofficeApp(db, {
      publicBaseUrl: "http://localhost:3101",
      researchCompany: researcher?.request,
    });
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
    const { researcher } = await researcherWith([
      textReply(JSON.stringify({ found: false, reason: "No plausible match." })),
      textReply(JSON.stringify({ found: true, profile: PROFILE })),
    ]);
    await researcher.request(leadId!, false);
    await finished(leadId!);

    const response = await appWith(researcher).request(`/api/leads/${leadId}/research`, {
      method: "POST",
    });
    expect(response.status).toBe(202);
    await finished(leadId!);
    expect((await findLeadById(db, leadId!))?.companyProfile?.name).toBe(PROFILE.name);
  });

  it("refuses a manual lookup when company research is not enabled", async () => {
    const { leadId } = await createEnrollment(db, workshop.id, ADA);
    expect(
      (await appWith().request(`/api/leads/${leadId}/research`, { method: "POST" })).status,
    ).toBe(503);
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
