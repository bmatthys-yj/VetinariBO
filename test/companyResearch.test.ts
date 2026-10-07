import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type BackofficeDatabase } from "../src/db/index.js";
import { migrateToLatest } from "../src/db/migrate.js";
import { createEnrollment } from "../src/db/enrollments.js";
import { createWorkshop } from "../src/db/workshops.js";
import { deleteLead, findLeadById } from "../src/db/leads.js";
import { createLeadResearch } from "../src/server/leadResearch.js";
import { createBackofficeApp } from "../src/server/backoffice/app.js";
import { createPublicApp } from "../src/server/public/app.js";
import { employerDomain } from "../src/leads/companyResearch.js";
import { fakeAgentModel, type FakeModelReply } from "./fakeAgentModel.js";
import { createLiteLlmModel } from "@quinus-yj/vetinari-provider-litellm";

const person = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@acme.be",
  phone: "+32 470 00 00 00",
  company: "Acme",
};
const record = { name: "ACME NV", company_number: "0123456789", country_code: "BE", workforce: 42 };
const profile = {
  name: "ACME NV",
  companyNumber: "0123456789",
  countryCode: "BE",
  employees: "42",
  summary: "A software company.",
};
const reply: FakeModelReply = { type: "text", text: JSON.stringify({ found: true, profile }) };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let directory: string;
let db: BackofficeDatabase;
let workshop: Awaited<ReturnType<typeof createWorkshop>>;
let services: ReturnType<typeof createLeadResearch>[];
let release: (() => void) | undefined;

beforeEach(async () => {
  services = [];
  release = undefined;
  directory = mkdtempSync(join(tmpdir(), "bo-workflow-"));
  db = createDatabase(join(directory, "test.db"));
  await migrateToLatest(db);
  workshop = await createWorkshop(db, {
    name: "Research",
    date: "2099-01-01",
    maxApplicants: 20,
    subject: "Research",
    locationName: "Here",
    locationAddress: "Here",
  });
});
afterEach(async () => {
  release?.();
  await Promise.all(services.map((service) => service.close()));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await db.destroy();
  rmSync(directory, { recursive: true, force: true });
});

async function enroll() {
  return (await createEnrollment(db, workshop.id, person)).leadId!;
}
function research(replies: Parameters<typeof fakeAgentModel>[0] = reply, fetchImpl?: typeof fetch) {
  const gateway = fakeAgentModel(replies);
  const urls: URL[] = [];
  const service = createLeadResearch(db, {
    pappersApiToken: "pappers-secret",
    model: gateway.model,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      urls.push(url);
      return fetchImpl
        ? fetchImpl(input, init)
        : json(url.pathname.endsWith("/search") ? { results: [record] } : record);
    },
  });
  services.push(service);
  return { service, gateway, urls };
}
function app(service: ReturnType<typeof createLeadResearch>) {
  return createBackofficeApp(db, {
    publicBaseUrl: "http://localhost:3101",
    researchCompany: service.request,
  });
}
async function finished(id: string) {
  await vi.waitFor(async () =>
    expect((await findLeadById(db, id))?.companyResearchStatus).not.toBe("running"),
  );
  return findLeadById(db, id);
}

it("fetches company data before a single structured agent step, without attendee details", async () => {
  const id = await enroll();
  const { service, gateway, urls } = research();
  expect(await service.request(id, false)).toEqual({ status: "accepted" });
  await service.close();
  expect(await findLeadById(db, id)).toMatchObject({
    companyResearchStatus: "found",
    companyProfile: profile,
  });
  expect(urls.map((url) => url.pathname)).toEqual(["/v1/search", "/v1/company"]);
  expect(urls[0]?.searchParams.get("country_code")).toBe("BE");
  expect(urls[1]?.searchParams.get("fields")).toBeNull();
  expect(gateway.requests).toHaveLength(1);
  const prompt = JSON.stringify(gateway.requests[0]?.prompt);
  expect(prompt).toContain("workforce");
  expect(prompt).toContain("acme.be");
  for (const privateValue of [
    person.firstName,
    person.lastName,
    person.email,
    person.phone,
    "pappers-secret",
  ])
    expect(prompt).not.toContain(privateValue);
});

it("sends the profile schema to a LiteLLM model that only supports JSON mode", async () => {
  const id = await enroll();
  const requests: Array<{ messages: unknown; response_format?: unknown }> = [];
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    const chunks = [
      {
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: reply instanceof Error ? "" : reply.text },
            finish_reason: null,
          },
        ],
      },
      {
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    ];
    return new Response(
      chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
      {
        headers: { "content-type": "text/event-stream" },
      },
    );
  });
  const service = createLeadResearch(db, {
    pappersApiToken: "test",
    model: createLiteLlmModel({
      baseUrl: "https://gateway.test/v1",
      masterKey: "test",
      model: "model-default",
    }).languageModel,
    fetch: async (input) =>
      json(String(input).includes("/search?") ? { results: [record] } : record),
  });
  services.push(service);
  await service.request(id);
  await service.close();
  expect(requests).toHaveLength(1);
  expect(requests[0]?.response_format).toBeUndefined();
  for (const field of ["found", "profile", "companyNumber", "summary", "matchNote"]) {
    expect(JSON.stringify(requests[0]?.messages)).toContain(field);
  }
  expect(await findLeadById(db, id)).toMatchObject({
    companyResearchStatus: "found",
    companyProfile: profile,
  });
});

it("fetches only financials when the base record has no workforce", async () => {
  const id = await enroll();
  const { service, gateway, urls } = research(reply, async (input) => {
    const url = new URL(String(input));
    return json(
      url.pathname.endsWith("/search")
        ? { results: [record] }
        : {
            ...record,
            workforce: null,
            ...(url.searchParams.has("fields")
              ? { financials: [{ year: 2024, employees: 42 }] }
              : {}),
          },
    );
  });
  await service.request(id);
  await service.close();
  expect((await findLeadById(db, id))?.companyResearchStatus).toBe("found");
  expect(urls).toHaveLength(3);
  expect(urls[2]?.searchParams.get("fields")).toBe("financials");
  expect(JSON.stringify(gateway.requests[0]?.prompt)).toContain("financials");
});

it("finishes an empty search as not found without calling the model", async () => {
  const id = await enroll();
  const { service, gateway, urls } = research([], async () => json({ results: [] }));
  await service.request(id);
  await service.close();
  expect(await findLeadById(db, id)).toMatchObject({ companyResearchStatus: "not_found" });
  expect(urls).toHaveLength(1);
  expect(gateway.requests).toHaveLength(0);
});

it("shows ambiguous matches as a failed lookup instead of choosing a company", async () => {
  const id = await enroll();
  const { service, gateway } = research([], async () =>
    json({ results: [record, { ...record, company_number: "other" }] }),
  );
  await service.request(id);
  await service.close();
  expect(await findLeadById(db, id)).toMatchObject({
    companyResearchStatus: "failed",
    companyResearchError: expect.stringContaining("Several companies"),
  });
  expect(gateway.requests).toHaveLength(0);
});

it("prefers a unique exact name over other search results", async () => {
  const id = await enroll();
  const { service, urls } = research(reply, async (input) =>
    json(
      new URL(String(input)).pathname.endsWith("/search")
        ? { results: [record, { name: "Acme Catering", company_number: "other" }] }
        : record,
    ),
  );
  await service.request(id);
  await service.close();
  expect((await findLeadById(db, id))?.companyResearchStatus).toBe("found");
  expect(urls[1]?.searchParams.get("company_number")).toBe(record.company_number);
});

it("stores an API failure and allows a manual retry through the UI endpoint", async () => {
  const id = await enroll();
  let failing = true;
  const { service, gateway, urls } = research(reply, async (input) =>
    failing
      ? json({ error: "Invalid pappers-secret token" }, 401)
      : json(new URL(String(input)).pathname.endsWith("/search") ? { results: [record] } : record),
  );
  await service.request(id, false);
  expect(await finished(id)).toMatchObject({
    companyResearchStatus: "failed",
    companyResearchError: "Invalid [redacted] token",
  });
  expect(await service.request(id, false)).toEqual({ status: "complete" });
  expect(urls).toHaveLength(1);
  expect(gateway.requests).toHaveLength(0);
  failing = false;
  const response = await app(service).request(`/api/leads/${id}/research`, { method: "POST" });
  expect(response.status).toBe(202);
  expect(await finished(id)).toMatchObject({
    companyResearchStatus: "found",
    companyProfile: profile,
  });
});

it.each(["not JSON", JSON.stringify({ found: true, profile: {} })])(
  "fails safely on invalid structured output: %s",
  async (text) => {
    const id = await enroll();
    const { service } = research({ type: "text", text });
    await service.request(id);
    await service.close();
    const lead = await findLeadById(db, id);
    expect(lead?.companyResearchStatus).toBe("failed");
    expect(lead?.companyProfile).toBeUndefined();
    expect(lead?.companyResearchError).toBeTruthy();
  },
);

it("redacts gateway credentials from a failed workflow", async () => {
  vi.stubEnv("LITELLM_MASTER_KEY", "gateway-secret");
  const id = await enroll();
  const { service } = research(new Error("Gateway rejected gateway-secret"));
  await service.request(id);
  await service.close();
  expect(await findLeadById(db, id)).toMatchObject({
    companyResearchStatus: "failed",
    companyResearchError: expect.stringContaining("[redacted]"),
  });
});

it("does not duplicate a running lookup on repeated requests", async () => {
  const id = await enroll();
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { service, gateway } = research(async () => {
    await waiting;
    return reply;
  });
  await service.request(id);
  expect((await app(service).request(`/api/leads/${id}/research`, { method: "POST" })).status).toBe(
    409,
  );
  release!();
  await service.close();
  expect(gateway.requests).toHaveLength(1);
});

it("rejects late results after the company changes or the lead is deleted", async () => {
  const id = await enroll();
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { service } = research(async () => {
    await waiting;
    return reply;
  });
  await service.request(id);
  const another = await createWorkshop(db, { ...workshop, name: "Another" });
  await createEnrollment(db, another.id, { ...person, company: "Another company" });
  release!();
  await service.close();
  expect(await findLeadById(db, id)).toMatchObject({
    company: "Another company",
    companyResearchStatus: "pending",
  });
  expect((await findLeadById(db, id))?.companyProfile).toBeUndefined();
  const next = research();
  await next.service.request(id);
  await deleteLead(db, id);
  await next.service.close();
  expect(await findLeadById(db, id)).toBeNull();
});

it("starts from enrollment without waiting for research and does not retry on later enrollments", async () => {
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { service, gateway } = research(async () => {
    await waiting;
    return reply;
  });
  const publicApp = createPublicApp(db, {
    onEnrolled: (enrollment) => {
      if (enrollment.leadId) void service.request(enrollment.leadId, false);
    },
  });
  const response = await publicApp.request(`/w/${workshop.slug}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...person, consent: "yes" }).toString(),
  });
  expect(response.status).toBe(303);
  release!();
  await vi.waitFor(() => expect(gateway.requests).toHaveLength(1));
  const id = (await db.selectFrom("leads").select("id").executeTakeFirstOrThrow()).id;
  await finished(id);
  expect(await service.request(id, false)).toEqual({ status: "complete" });
});

it("leaves pending rows alone at startup and reports missing configuration as a failure", async () => {
  const id = await enroll();
  const fetchImpl = vi.fn<typeof fetch>();
  const service = createLeadResearch(db, { fetch: fetchImpl, model: fakeAgentModel([]).model });
  services.push(service);
  expect((await findLeadById(db, id))?.companyResearchStatus).toBe("pending");
  await service.request(id);
  await service.close();
  expect(await findLeadById(db, id)).toMatchObject({
    companyResearchStatus: "failed",
    companyResearchError: expect.stringContaining("VETINARI_BO_PAPPERS_API_TOKEN"),
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("omits personal mail domains and uses a foreign work domain for the API country", async () => {
  expect(employerDomain("ada@gmail.com")).toBeUndefined();
  expect(employerDomain("ada@mail.com")).toBeUndefined();
  const id = (await createEnrollment(db, workshop.id, { ...person, email: "ada@acme.fr" })).leadId!;
  const { service, urls } = research();
  await service.request(id);
  await service.close();
  expect(urls[0]?.searchParams.get("country_code")).toBe("FR");
});
