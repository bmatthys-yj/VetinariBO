import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type BackofficeDatabase } from "../src/db/index.js";
import { migrateToLatest } from "../src/db/migrate.js";
import { createWorkshop, listWorkshops } from "../src/db/workshops.js";
import { createBackofficeApp } from "../src/server/backoffice/app.js";

const VALID_INPUT = {
  name: "Agentic AI Kickstart",
  date: "2026-10-14",
  maxApplicants: 20,
  subject: "Building agents with Vetinari",
  url: "https://example.com/workshops/kickstart",
  locationName: "De Hoorn",
  locationAddress: "Sluisstraat 79, 3000 Leuven",
};

const PUBLIC_BASE_URL = "http://localhost:3101";

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

describe("workshop repository", () => {
  it("starts empty", async () => {
    expect(await listWorkshops(db)).toEqual([]);
  });

  it("round-trips every workshop field", async () => {
    const created = await createWorkshop(db, VALID_INPUT);
    expect(created).toMatchObject(VALID_INPUT);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    // The slug exists on insert, so the hosted form is live immediately.
    expect(created.slug).toMatch(/^agentic-ai-kickstart-[a-z2-9]{6}$/);

    const [stored] = await listWorkshops(db);
    // A list read adds the seat counters a bare insert does not carry.
    expect(stored).toMatchObject(created);
    expect(stored).toMatchObject({ enrollmentCount: 0, seatsRemaining: VALID_INPUT.maxApplicants });
  });

  it("orders workshops by date", async () => {
    await createWorkshop(db, { ...VALID_INPUT, name: "Later", date: "2026-12-01" });
    await createWorkshop(db, { ...VALID_INPUT, name: "Sooner", date: "2026-01-05" });
    expect((await listWorkshops(db)).map((workshop) => workshop.name)).toEqual(["Sooner", "Later"]);
  });
});

describe("workshops API", () => {
  it("lists an empty register", async () => {
    const app = createBackofficeApp(db, { publicBaseUrl: PUBLIC_BASE_URL });
    const response = await app.request("/api/workshops");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workshops: [] });
  });

  it("creates a workshop and then lists it", async () => {
    const app = createBackofficeApp(db, { publicBaseUrl: PUBLIC_BASE_URL });
    const created = await app.request("/api/workshops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_INPUT),
    });
    expect(created.status).toBe(201);
    const { workshop } = (await created.json()) as { workshop: { name: string } };
    expect(workshop.name).toBe(VALID_INPUT.name);

    const listed = await app.request("/api/workshops");
    const { workshops } = (await listed.json()) as { workshops: unknown[] };
    expect(workshops).toHaveLength(1);
  });

  it("rejects an invalid workshop with field-level issues", async () => {
    const app = createBackofficeApp(db, { publicBaseUrl: PUBLIC_BASE_URL });
    const response = await app.request("/api/workshops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...VALID_INPUT, url: "not-a-url", maxApplicants: 0 }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { issues: Array<{ path: string }> };
    expect(body.issues.map((issue) => issue.path).sort()).toEqual(["maxApplicants", "url"]);
  });
});
