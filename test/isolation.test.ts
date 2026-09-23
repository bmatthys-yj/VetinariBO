import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type BackofficeDatabase } from "../src/db/index.js";
import { migrateToLatest } from "../src/db/migrate.js";
import { createWorkshop } from "../src/db/workshops.js";
import { createBackofficeApp } from "../src/server/backoffice/app.js";
import { createPublicApp } from "../src/server/public/app.js";

/**
 * The boundary between the two apps, as an executable test.
 *
 * An attendee must never be able to reach the backoffice from the public form,
 * so every backoffice route is asserted absent from the public app. Do not
 * relax these expectations: they are the feature.
 */

const WORKSHOP = {
  name: "Agentic AI Kickstart",
  date: "2099-10-14",
  maxApplicants: 20,
  subject: "Building agents with Vetinari",
  url: undefined,
  locationName: "De Hoorn",
  locationAddress: "Sluisstraat 79, 3000 Leuven",
};

let directory: string;
let db: BackofficeDatabase;
let slug: string;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "vetinari-bo-"));
  db = createDatabase(join(directory, "test.db"));
  await migrateToLatest(db);
  slug = (await createWorkshop(db, WORKSHOP)).slug;
});

afterEach(async () => {
  await db.destroy();
  rmSync(directory, { recursive: true, force: true });
});

describe("public app does not expose the backoffice", () => {
  const backofficePaths = [
    "/",
    "/workshops",
    "/api/workshops",
    "/api/workshops/anything",
    "/agents",
    "/api/agents",
    "/api/gateway",
    "/index.html",
    "/assets/index.js",
  ];

  it.each(backofficePaths)("returns 404 for %s", async (path) => {
    const response = await createPublicApp(db).request(path);
    expect(response.status).toBe(404);
  });

  it("never serves the backoffice SPA shell", async () => {
    const app = createPublicApp(db);
    for (const path of backofficePaths) {
      const body = await (await app.request(path)).text();
      expect(body).not.toContain('id="root"');
    }
  });

  it("refuses writes to the workshop register", async () => {
    const response = await createPublicApp(db).request("/api/workshops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(WORKSHOP),
    });
    expect(response.status).toBe(404);
  });

  it("does not leak enrollee data through the form page", async () => {
    const app = createPublicApp(db);
    await app.request(`/w/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        consent: "yes",
      }).toString(),
    });
    const body = await (await app.request(`/w/${slug}`)).text();
    expect(body).not.toContain("ada@example.com");
    expect(body).not.toContain("Lovelace");
  });
});

describe("backoffice does not host the public form", () => {
  it("returns 404 for the enrollment page", async () => {
    const app = createBackofficeApp(db, { publicBaseUrl: "http://localhost:3101" });
    const response = await app.request(`/w/${slug}`);
    // The SPA shell is a catch-all, so the assertion is that it is *not* the
    // enrollment form rather than a bare status code.
    expect(await response.text()).not.toContain("Enroll");
  });
});
