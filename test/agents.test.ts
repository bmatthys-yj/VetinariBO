import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type BackofficeDatabase } from "../src/db/index.js";
import { migrateToLatest } from "../src/db/migrate.js";
import { createBuiltInAgents } from "../src/agents/registry.js";
import { MAX_AGENT_STEPS, toToolSpec } from "../src/agents/runAgent.js";
import { MAX_SECTION_ITEMS, trimCompany } from "../src/agents/pappers/pappersAgent.js";
import { LiteLlmClient, liteLlmApiRoot } from "../src/llm/liteLlm.js";
import { createBackofficeApp } from "../src/server/backoffice/app.js";

const PUBLIC_BASE_URL = "http://localhost:3101";
const PAPPERS_TOKEN = "pappers-secret-token";
const MODEL = "claude-opus-5";

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A stand-in for an HTTP service, so the tests never touch the network. */
function fakeService(respond: (url: string, callIndex: number) => Response) {
  const requests: RecordedRequest[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return respond(url, requests.length - 1);
  };
  return { requests, fetchImpl };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A chat completion that asks for one tool call. */
function toolCallReply(id: string, name: string, args: unknown): Response {
  return json({
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id, type: "function", function: { name, arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
  });
}

function textReply(content: string): Response {
  return json({ choices: [{ message: { role: "assistant", content } }] });
}

let directory: string;
let db: BackofficeDatabase;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "vetinari-bo-"));
  db = createDatabase(join(directory, "test.db"));
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
  rmSync(directory, { recursive: true, force: true });
});

interface AppSetup {
  gateway?: ReturnType<typeof fakeService>;
  pappers?: ReturnType<typeof fakeService>;
  /** `null` stands for an unset environment variable. */
  liteLlmKey?: string | null;
  model?: string | null;
  pappersToken?: string | null;
}

function appWith(setup: AppSetup = {}) {
  const gateway = setup.gateway ?? fakeService(() => json({}));
  const pappers = setup.pappers ?? fakeService(() => json({}));
  const liteLlm = new LiteLlmClient(
    {
      baseUrl: "http://gateway.test:4000",
      apiKey: setup.liteLlmKey === null ? undefined : (setup.liteLlmKey ?? "sk-test"),
    },
    gateway.fetchImpl,
  );
  const agents = createBuiltInAgents({
    model: setup.model === null ? undefined : (setup.model ?? MODEL),
    pappersApiToken:
      setup.pappersToken === null ? undefined : (setup.pappersToken ?? PAPPERS_TOKEN),
    fetch: pappers.fetchImpl,
  });
  return createBackofficeApp(db, { publicBaseUrl: PUBLIC_BASE_URL, liteLlm, agents });
}

async function post(app: ReturnType<typeof appWith>, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface RunBody {
  run: {
    output: string;
    model: string;
    toolCalls: Array<{ name: string; arguments: unknown; error?: string }>;
  };
}

describe("LiteLLM client", () => {
  it("normalizes the gateway origin to its /v1 root", () => {
    expect(liteLlmApiRoot("http://localhost:4000")).toBe("http://localhost:4000/v1");
    expect(liteLlmApiRoot("http://localhost:4000/")).toBe("http://localhost:4000/v1");
    expect(liteLlmApiRoot("http://localhost:4000/v1/")).toBe("http://localhost:4000/v1");
  });
});

describe("built-in agents API", () => {
  it("lists the Pappers agent with its tools", async () => {
    const { agents } = (await (await appWith().request("/api/agents")).json()) as {
      agents: Array<{ id: string; ready: boolean; model: string; tools: Array<{ name: string }> }>;
    };
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({ id: "pappers", ready: true, model: MODEL });
    expect(agents[0]?.tools.map((tool) => tool.name)).toEqual(["search_companies", "get_company"]);
  });

  it("reports the settings an agent is still missing", async () => {
    const app = appWith({ model: null, pappersToken: null });
    const { agent } = (await (await app.request("/api/agents/pappers")).json()) as {
      agent: { ready: boolean; model: string | null; missingConfig: string[] };
    };
    expect(agent).toMatchObject({
      ready: false,
      model: null,
      missingConfig: ["VETINARI_BO_LITELLM_MODEL", "VETINARI_BO_PAPPERS_API_TOKEN"],
    });
  });

  it("no longer accepts new agents", async () => {
    const response = await post(appWith(), "/api/agents", { name: "Anything" });
    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown agent", async () => {
    expect((await appWith().request("/api/agents/nope")).status).toBe(404);
    expect((await post(appWith(), "/api/agents/nope/runs", { input: "Hi" })).status).toBe(404);
  });
});

describe("running the Pappers agent", () => {
  it("searches, fetches the company, and answers", async () => {
    const gateway = fakeService(
      (_url, call) =>
        [
          toolCallReply("call_1", "search_companies", { countryCode: "be", query: "Proximus" }),
          toolCallReply("call_2", "get_company", {
            countryCode: "BE",
            companyNumber: "0202.239.951",
            fields: ["officers"],
          }),
          textReply("Proximus (0202.239.951) has 15 officers."),
        ][call]!,
    );
    const pappers = fakeService((url) =>
      url.includes("/search")
        ? json({ results: [{ company_number: "0202.239.951", name: "PROXIMUS" }], total: 1 })
        : json({ name: "PROXIMUS", trade_name: null, officers: [{ last_name: "Domb" }] }),
    );

    const response = await post(appWith({ gateway, pappers }), "/api/agents/pappers/runs", {
      input: "Who runs Proximus?",
    });
    expect(response.status).toBe(200);
    const { run } = (await response.json()) as RunBody;
    expect(run.output).toBe("Proximus (0202.239.951) has 15 officers.");
    expect(run.model).toBe(MODEL);
    expect(run.toolCalls.map((call) => call.name)).toEqual(["search_companies", "get_company"]);
    expect(run.toolCalls.every((call) => call.error === undefined)).toBe(true);

    const [search, company] = pappers.requests.map((request) => new URL(request.url));
    expect(search?.pathname).toBe("/v1/search");
    expect(search?.searchParams.get("country_code")).toBe("BE");
    expect(search?.searchParams.get("q")).toBe("Proximus");
    expect(search?.searchParams.get("api_token")).toBe(PAPPERS_TOKEN);
    expect(company?.pathname).toBe("/v1/company");
    // Dots are stripped: the API wants the bare registration number.
    expect(company?.searchParams.get("company_number")).toBe("0202239951");
    expect(company?.searchParams.get("fields")).toBe("officers");

    // The first request offers the tools; the last carries both tool results back.
    const first = gateway.requests[0]?.body as { model: string; tools: unknown[] };
    expect(first.model).toBe(MODEL);
    expect(first.tools).toHaveLength(2);
    const last = gateway.requests[2]?.body as {
      messages: Array<{ role: string; content: string }>;
    };
    const toolMessages = last.messages.filter((message) => message.role === "tool");
    expect(toolMessages).toHaveLength(2);
    // Null fields are dropped before the model sees the record.
    expect(toolMessages[1]?.content).not.toContain("trade_name");
  });

  it("feeds a Pappers error back to the model without leaking the token", async () => {
    const gateway = fakeService(
      (_url, call) =>
        [
          toolCallReply("call_1", "search_companies", { countryCode: "BE", query: "Acme" }),
          textReply("Pappers refused the request."),
        ][call]!,
    );
    const pappers = fakeService(() => json({ error: "Your api_token is invalid" }, 401));

    const response = await post(appWith({ gateway, pappers }), "/api/agents/pappers/runs", {
      input: "Find Acme",
    });
    const { run } = (await response.json()) as RunBody;
    expect(run.toolCalls[0]?.error).toBe("Your api_token is invalid");
    expect(run.output).toBe("Pappers refused the request.");
    const toolResult = (
      gateway.requests[1]?.body as { messages: Array<{ role: string; content: string }> }
    ).messages.find((message) => message.role === "tool");
    expect(toolResult?.content).toContain("Your api_token is invalid");
    expect(JSON.stringify(gateway.requests)).not.toContain(PAPPERS_TOKEN);
  });

  it("rejects invalid tool arguments before calling Pappers", async () => {
    const gateway = fakeService(
      (_url, call) =>
        [
          toolCallReply("call_1", "search_companies", { countryCode: "Belgium", query: "" }),
          textReply("I could not search."),
        ][call]!,
    );
    const pappers = fakeService(() => json({}));

    const response = await post(appWith({ gateway, pappers }), "/api/agents/pappers/runs", {
      input: "Find it",
    });
    const { run } = (await response.json()) as RunBody;
    expect(run.toolCalls[0]?.error).toMatch(/^Invalid arguments\./);
    expect(pappers.requests).toHaveLength(0);
  });

  it(`stops after ${MAX_AGENT_STEPS} model turns`, async () => {
    const gateway = fakeService((_url, call) =>
      toolCallReply(`call_${call}`, "search_companies", { countryCode: "BE", query: "Loop" }),
    );
    const pappers = fakeService(() => json({ results: [], total: 0 }));

    const response = await post(appWith({ gateway, pappers }), "/api/agents/pappers/runs", {
      input: "Loop forever",
    });
    expect(response.status).toBe(502);
    expect(gateway.requests).toHaveLength(MAX_AGENT_STEPS);
  });

  it("surfaces a gateway error as 502 with its message", async () => {
    const gateway = fakeService(() => json({ error: { message: "Invalid model name" } }, 400));
    const response = await post(appWith({ gateway }), "/api/agents/pappers/runs", { input: "Hi" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Invalid model name" });
  });

  it("refuses to run without a gateway key and never calls it", async () => {
    const gateway = fakeService(() => json({}));
    const response = await post(
      appWith({ gateway, liteLlmKey: null }),
      "/api/agents/pappers/runs",
      {
        input: "Hi",
      },
    );
    expect(response.status).toBe(503);
    expect(gateway.requests).toHaveLength(0);
  });

  it("refuses to run while the Pappers token is missing", async () => {
    const gateway = fakeService(() => json({}));
    const response = await post(
      appWith({ gateway, pappersToken: null }),
      "/api/agents/pappers/runs",
      { input: "Hi" },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Pappers company researcher needs VETINARI_BO_PAPPERS_API_TOKEN to be set.",
    });
    expect(gateway.requests).toHaveLength(0);
  });
});

describe("Pappers tool output", () => {
  it("caps long sections and drops null fields", () => {
    const publications = Array.from({ length: MAX_SECTION_ITEMS + 5 }, (_, index) => ({
      id: index,
      content: null,
    }));
    const trimmed = trimCompany({ name: "PROXIMUS", acronym: null, publications }) as {
      acronym?: unknown;
      publications: Array<Record<string, unknown>>;
      publications_total: number;
    };
    expect(trimmed.acronym).toBeUndefined();
    expect(trimmed.publications).toHaveLength(MAX_SECTION_ITEMS);
    expect(trimmed.publications_total).toBe(MAX_SECTION_ITEMS + 5);
    expect(trimmed.publications[0]).toEqual({ id: 0 });
  });

  it("describes each tool to the model as a JSON Schema function", () => {
    const [agent] = createBuiltInAgents({ model: MODEL, pappersApiToken: PAPPERS_TOKEN });
    const spec = toToolSpec(agent!.tools[1]!);
    expect(spec.function.name).toBe("get_company");
    expect(spec.function.parameters).toMatchObject({
      type: "object",
      required: ["countryCode", "companyNumber"],
    });
    expect(spec.function.parameters).not.toHaveProperty("$schema");
  });
});

describe("gateway status API", () => {
  it("lists the models the key may use", async () => {
    const gateway = fakeService(() => json({ data: [{ id: "gpt-4o-mini" }, { id: "claude" }] }));
    const response = await appWith({ gateway }).request("/api/gateway");
    expect(await response.json()).toEqual({
      gateway: {
        configured: true,
        reachable: true,
        baseUrl: "http://gateway.test:4000",
        models: ["claude", "gpt-4o-mini"],
      },
    });
  });

  it("reports an unreachable gateway instead of failing", async () => {
    const gateway = fakeService(() => {
      throw new TypeError("fetch failed");
    });
    const { gateway: status } = (await (
      await appWith({ gateway }).request("/api/gateway")
    ).json()) as { gateway: { reachable: boolean; error: string } };
    expect(status.reachable).toBe(false);
    expect(status.error).toContain("Could not reach the LiteLLM gateway");
  });

  it("reports an unconfigured gateway without calling it", async () => {
    const gateway = fakeService(() => json({}));
    const response = await appWith({ gateway, liteLlmKey: null }).request("/api/gateway");
    const body = (await response.json()) as { gateway: { configured: boolean } };
    expect(body.gateway.configured).toBe(false);
    expect(gateway.requests).toHaveLength(0);
  });
});
