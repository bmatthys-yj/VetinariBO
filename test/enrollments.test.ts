import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type BackofficeDatabase } from "../src/db/index.js";
import { migrateToLatest } from "../src/db/migrate.js";
import { createEnrollment, listEnrollments } from "../src/db/enrollments.js";
import { createWorkshop } from "../src/db/workshops.js";
import { EnrollmentRefusedError } from "../src/contracts/enrollment.js";
import { createPublicApp } from "../src/server/public/app.js";
import type { Workshop } from "../src/contracts/workshop.js";

const BASE_WORKSHOP = {
  name: "Agentic AI Kickstart",
  date: "2099-10-14",
  maxApplicants: 2,
  subject: "Building agents with Vetinari",
  url: undefined,
  locationName: "De Hoorn",
  locationAddress: "Sluisstraat 79, 3000 Leuven",
};

const PERSON = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: undefined,
  company: undefined,
  position: undefined,
};

let directory: string;
let db: BackofficeDatabase;
let workshop: Workshop;

async function submit(slug: string, fields: Record<string, string>) {
  return createPublicApp(db).request(`/w/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

const VALID_FORM = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  consent: "yes",
};

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "vetinari-bo-"));
  db = createDatabase(join(directory, "test.db"));
  await migrateToLatest(db);
  workshop = await createWorkshop(db, BASE_WORKSHOP);
});

afterEach(async () => {
  await db.destroy();
  rmSync(directory, { recursive: true, force: true });
});

describe("enrollment repository", () => {
  it("stores every field and leaves optionals null", async () => {
    const created = await createEnrollment(db, workshop.id, PERSON);
    expect(created).toMatchObject({ firstName: "Ada", email: "ada@example.com" });
    expect(created.phone).toBeUndefined();
    expect(created.company).toBeUndefined();
    expect(created.consentedAt).toBeTruthy();
    expect(await listEnrollments(db, workshop.id)).toHaveLength(1);
  });

  it("keeps optional fields when they are given", async () => {
    const created = await createEnrollment(db, workshop.id, {
      ...PERSON,
      phone: "+32 470 00 00 00",
      company: "Acme",
      position: "CTO",
    });
    expect(created).toMatchObject({ phone: "+32 470 00 00 00", company: "Acme", position: "CTO" });
  });

  it("refuses a second enrollment for the same email", async () => {
    await createEnrollment(db, workshop.id, PERSON);
    await expect(createEnrollment(db, workshop.id, PERSON)).rejects.toThrow(EnrollmentRefusedError);
  });

  it("refuses once the workshop is full", async () => {
    await createEnrollment(db, workshop.id, { ...PERSON, email: "one@example.com" });
    await createEnrollment(db, workshop.id, { ...PERSON, email: "two@example.com" });
    await expect(
      createEnrollment(db, workshop.id, { ...PERSON, email: "three@example.com" }),
    ).rejects.toMatchObject({ reason: "full" });
  });

  it("refuses a workshop whose date has passed", async () => {
    const past = await createWorkshop(db, { ...BASE_WORKSHOP, date: "2020-01-01" });
    await expect(createEnrollment(db, past.id, PERSON)).rejects.toMatchObject({
      reason: "closed",
    });
  });
});

describe("public enrollment form", () => {
  it("serves the form for a valid slug", async () => {
    const response = await createPublicApp(db).request(`/w/${workshop.slug}`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Agentic AI Kickstart");
    expect(body).toContain('name="firstName"');
    expect(body).toContain('name="position"');
  });

  it("404s an unknown slug", async () => {
    const response = await createPublicApp(db).request("/w/does-not-exist");
    expect(response.status).toBe(404);
  });

  it("accepts a valid submission and redirects", async () => {
    const response = await submit(workshop.slug, VALID_FORM);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/w/${workshop.slug}/thanks`);
    expect(await listEnrollments(db, workshop.id)).toHaveLength(1);
  });

  it("rejects a submission without consent and keeps what was typed", async () => {
    const response = await submit(workshop.slug, { ...VALID_FORM, consent: "" });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("Please agree before enrolling.");
    expect(body).toContain('value="Ada"');
    expect(await listEnrollments(db, workshop.id)).toHaveLength(0);
  });

  it("reports which required field is missing", async () => {
    const response = await submit(workshop.slug, { ...VALID_FORM, email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Expected a valid email address");
    expect(await listEnrollments(db, workshop.id)).toHaveLength(0);
  });

  it("silently discards a honeypot submission", async () => {
    const response = await submit(workshop.slug, { ...VALID_FORM, website: "http://spam" });
    // Looks identical to success, so a bot learns nothing.
    expect(response.status).toBe(303);
    expect(await listEnrollments(db, workshop.id)).toHaveLength(0);
  });

  it("shows the fully booked page once the seats are gone", async () => {
    await submit(workshop.slug, { ...VALID_FORM, email: "one@example.com" });
    await submit(workshop.slug, { ...VALID_FORM, email: "two@example.com" });
    const response = await createPublicApp(db).request(`/w/${workshop.slug}`);
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("fully booked");
  });

  it("tells someone their email is already enrolled", async () => {
    await submit(workshop.slug, VALID_FORM);
    const response = await submit(workshop.slug, VALID_FORM);
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("already enrolled");
  });
});
