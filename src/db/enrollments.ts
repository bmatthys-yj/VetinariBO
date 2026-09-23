import { randomUUID } from "node:crypto";
import {
  EnrollmentRefusedError,
  type Enrollment,
  type EnrollmentInput,
} from "../contracts/enrollment.js";
import type { BackofficeDatabase } from "./index.js";
import type { EnrollmentTable } from "./schema.js";

function toEnrollment(row: EnrollmentTable): Enrollment {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? undefined,
    company: row.company ?? undefined,
    position: row.position ?? undefined,
    consentedAt: row.consented_at,
    createdAt: row.created_at,
  };
}

/** Today as `YYYY-MM-DD`, to compare against a workshop's date column. */
function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Everyone signed up for a workshop, earliest first. */
export async function listEnrollments(
  db: BackofficeDatabase,
  workshopId: string,
): Promise<Enrollment[]> {
  const rows = await db
    .selectFrom("enrollments")
    .selectAll()
    .where("workshop_id", "=", workshopId)
    .orderBy("created_at", "asc")
    .execute();
  return rows.map(toEnrollment);
}

/**
 * Enroll someone, refusing when the workshop is full, past, or already holds
 * this email address.
 *
 * The seat count and the insert run in one transaction so two submissions
 * arriving together cannot both take the last seat.
 */
export async function createEnrollment(
  db: BackofficeDatabase,
  workshopId: string,
  input: EnrollmentInput,
): Promise<Enrollment> {
  const now = new Date().toISOString();
  const row: EnrollmentTable = {
    id: randomUUID(),
    workshop_id: workshopId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    company: input.company ?? null,
    position: input.position ?? null,
    consented_at: now,
    created_at: now,
  };

  return db.transaction().execute(async (trx) => {
    const workshop = await trx
      .selectFrom("workshops")
      .select(["max_applicants", "date"])
      .where("id", "=", workshopId)
      .executeTakeFirst();
    if (!workshop) throw new EnrollmentRefusedError("closed");
    if (workshop.date < today()) throw new EnrollmentRefusedError("closed");

    const taken = await trx
      .selectFrom("enrollments")
      .where("workshop_id", "=", workshopId)
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst();
    if (Number(taken?.count ?? 0) >= workshop.max_applicants) {
      throw new EnrollmentRefusedError("full");
    }

    const existing = await trx
      .selectFrom("enrollments")
      .select("id")
      .where("workshop_id", "=", workshopId)
      .where("email", "=", row.email)
      .executeTakeFirst();
    if (existing) throw new EnrollmentRefusedError("duplicate");

    await trx.insertInto("enrollments").values(row).execute();
    return toEnrollment(row);
  });
}

/** Remove one enrollment, used to service erasure requests. */
export async function deleteEnrollment(
  db: BackofficeDatabase,
  workshopId: string,
  enrollmentId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("enrollments")
    .where("id", "=", enrollmentId)
    .where("workshop_id", "=", workshopId)
    .executeTakeFirst();
  return Number(result.numDeletedRows ?? 0) > 0;
}
