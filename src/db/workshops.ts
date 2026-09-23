import { randomUUID } from "node:crypto";
import type { Workshop, WorkshopInput } from "../contracts/workshop.js";
import type { BackofficeDatabase } from "./index.js";
import type { WorkshopTable } from "./schema.js";
import { generateWorkshopSlug } from "./slug.js";

/** A workshop plus how many seats it has taken and left. */
export interface WorkshopWithSeats extends Workshop {
  readonly enrollmentCount: number;
  readonly seatsRemaining: number;
}

/** Map a database row to the contract shared with the web client. */
function toWorkshop(row: WorkshopTable): Workshop {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    maxApplicants: row.max_applicants,
    subject: row.subject,
    url: row.url ?? undefined,
    locationName: row.location_name,
    locationAddress: row.location_address,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function withSeats(row: WorkshopTable, enrollmentCount: number): WorkshopWithSeats {
  return {
    ...toWorkshop(row),
    enrollmentCount,
    seatsRemaining: Math.max(0, row.max_applicants - enrollmentCount),
  };
}

/** Every workshop, soonest first, each with its enrollment count. */
export async function listWorkshops(db: BackofficeDatabase): Promise<WorkshopWithSeats[]> {
  const rows = await db
    .selectFrom("workshops")
    .selectAll()
    .orderBy("date", "asc")
    .orderBy("name", "asc")
    .execute();
  const counts = await countEnrollmentsByWorkshop(db);
  return rows.map((row) => withSeats(row, counts.get(row.id) ?? 0));
}

/** One workshop by id, or `null` when it does not exist. */
export async function findWorkshopById(
  db: BackofficeDatabase,
  id: string,
): Promise<WorkshopWithSeats | null> {
  const row = await db.selectFrom("workshops").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) return null;
  return withSeats(row, await countEnrollments(db, row.id));
}

/** One workshop by the slug its hosted form is served under. */
export async function findWorkshopBySlug(
  db: BackofficeDatabase,
  slug: string,
): Promise<WorkshopWithSeats | null> {
  const row = await db
    .selectFrom("workshops")
    .selectAll()
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (!row) return null;
  return withSeats(row, await countEnrollments(db, row.id));
}

async function countEnrollments(db: BackofficeDatabase, workshopId: string): Promise<number> {
  const row = await db
    .selectFrom("enrollments")
    .where("workshop_id", "=", workshopId)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

async function countEnrollmentsByWorkshop(db: BackofficeDatabase): Promise<Map<string, number>> {
  const rows = await db
    .selectFrom("enrollments")
    .groupBy("workshop_id")
    .select((eb) => ["workshop_id", eb.fn.countAll<number>().as("count")])
    .execute();
  return new Map(rows.map((row) => [row.workshop_id, Number(row.count)]));
}

/**
 * Persist a new workshop.
 *
 * The slug is generated here, so the hosted enrollment form is reachable the
 * moment the row exists — there is no separate publish step.
 */
export async function createWorkshop(
  db: BackofficeDatabase,
  input: WorkshopInput,
): Promise<Workshop> {
  const now = new Date().toISOString();
  const row: WorkshopTable = {
    id: randomUUID(),
    name: input.name,
    date: input.date,
    max_applicants: input.maxApplicants,
    subject: input.subject,
    url: input.url ?? null,
    location_name: input.locationName,
    location_address: input.locationAddress,
    slug: generateWorkshopSlug(input.name),
    created_at: now,
    updated_at: now,
  };
  await db.insertInto("workshops").values(row).execute();
  return toWorkshop(row);
}
