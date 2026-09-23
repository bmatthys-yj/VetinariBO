import { randomUUID } from "node:crypto";
import type { Workshop, WorkshopInput } from "../contracts/workshop.js";
import type { BackofficeDatabase } from "./index.js";
import type { WorkshopTable } from "./schema.js";

/** Map a database row to the contract shared with the web client. */
function toWorkshop(row: WorkshopTable): Workshop {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    maxApplicants: row.max_applicants,
    subject: row.subject,
    url: row.url,
    locationName: row.location_name,
    locationAddress: row.location_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every workshop, soonest first. */
export async function listWorkshops(db: BackofficeDatabase): Promise<Workshop[]> {
  const rows = await db
    .selectFrom("workshops")
    .selectAll()
    .orderBy("date", "asc")
    .orderBy("name", "asc")
    .execute();
  return rows.map(toWorkshop);
}

/** Persist a new workshop and return it with its generated identity. */
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
    url: input.url,
    location_name: input.locationName,
    location_address: input.locationAddress,
    created_at: now,
    updated_at: now,
  };
  await db.insertInto("workshops").values(row).execute();
  return toWorkshop(row);
}
