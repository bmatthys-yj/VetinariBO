import type { Selectable } from "kysely";
import { randomUUID } from "node:crypto";
import type { EnrollmentInput } from "../contracts/enrollment.js";
import {
  companyProfileSchema,
  type CompanyProfile,
  type CompanyResearchStatus,
  type Lead,
  type LeadDetail,
  type LeadSummary,
} from "../contracts/lead.js";
import type { BackofficeDatabase } from "./index.js";
import type { LeadTable } from "./schema.js";

/** A stored profile that no longer parses is dropped rather than failing the read. */
function parseProfile(json: string | null): CompanyProfile | undefined {
  if (!json) return undefined;
  try {
    const parsed = companyProfileSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function toLead(row: Selectable<LeadTable>): Lead {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? undefined,
    company: row.company,
    position: row.position ?? undefined,
    companyResearchStatus: row.company_research_status as CompanyResearchStatus,
    companyResearchError: row.company_research_error ?? undefined,
    companyResearchedAt: row.company_researched_at ?? undefined,
    companyProfile: parseProfile(row.company_profile),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Company names compared loosely, so "ACME " and "Acme" are the same company. */
function sameCompany(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The lead an email address belongs to, or `null` when it is not a lead. */
export async function findLeadIdByEmail(
  db: BackofficeDatabase,
  email: string,
): Promise<string | null> {
  const row = await db
    .selectFrom("leads")
    .select("id")
    .where("email", "=", email.toLowerCase())
    .executeTakeFirst();
  return row?.id ?? null;
}

/**
 * Create or update the lead for someone enrolling on behalf of a company.
 *
 * People are matched by email, so a second enrollment joins the existing lead
 * and refreshes the details the person gave. A changed company invalidates the
 * previous lookup and queues a new one. Call it inside the enrollment
 * transaction so the enrollment and its lead are written together.
 */
export async function upsertLeadFromEnrollment(
  db: BackofficeDatabase,
  input: EnrollmentInput & { company: string },
  now: string,
): Promise<string> {
  const email = input.email.toLowerCase();
  const existing = await db
    .selectFrom("leads")
    .select(["id", "company", "phone", "position"])
    .where("email", "=", email)
    .executeTakeFirst();

  if (!existing) {
    const id = randomUUID();
    await db
      .insertInto("leads")
      .values({
        id,
        first_name: input.firstName,
        last_name: input.lastName,
        email,
        phone: input.phone ?? null,
        company: input.company,
        position: input.position ?? null,
        company_research_status: "pending",
        company_research_error: null,
        company_researched_at: null,
        company_profile: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    return id;
  }

  const companyChanged = !sameCompany(existing.company, input.company);
  await db
    .updateTable("leads")
    .set({
      first_name: input.firstName,
      last_name: input.lastName,
      // A skipped optional field keeps what an earlier enrollment gave.
      phone: input.phone ?? existing.phone,
      position: input.position ?? existing.position,
      company: input.company,
      updated_at: now,
      ...(companyChanged
        ? {
            company_research_status: "pending",
            company_research_run_id: null,
            company_research_error: null,
            company_researched_at: null,
            company_profile: null,
          }
        : {}),
    })
    .where("id", "=", existing.id)
    .execute();
  return existing.id;
}

/** Every lead, newest first, with how many workshops each enrolled for. */
export async function listLeads(db: BackofficeDatabase): Promise<LeadSummary[]> {
  const rows = await db
    .selectFrom("leads")
    .selectAll("leads")
    .select((eb) =>
      eb
        .selectFrom("enrollments")
        .whereRef("enrollments.lead_id", "=", "leads.id")
        .select(eb.fn.countAll<number>().as("count"))
        .as("workshop_count"),
    )
    .orderBy("leads.created_at", "desc")
    .execute();
  return rows.map(({ workshop_count, ...row }) => ({
    ...toLead(row),
    workshopCount: Number(workshop_count ?? 0),
  }));
}

/** One lead with the workshops it enrolled for, or `null` when it does not exist. */
export async function findLeadById(db: BackofficeDatabase, id: string): Promise<LeadDetail | null> {
  const row = await db.selectFrom("leads").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) return null;

  const workshops = await db
    .selectFrom("enrollments")
    .innerJoin("workshops", "workshops.id", "enrollments.workshop_id")
    .select([
      "enrollments.id as enrollment_id",
      "enrollments.created_at as enrolled_at",
      "workshops.id as workshop_id",
      "workshops.name as workshop_name",
      "workshops.date as workshop_date",
    ])
    .where("enrollments.lead_id", "=", id)
    .orderBy("workshops.date", "asc")
    .execute();

  return {
    ...toLead(row),
    workshops: workshops.map((workshop) => ({
      enrollmentId: workshop.enrollment_id,
      workshopId: workshop.workshop_id,
      workshopName: workshop.workshop_name,
      workshopDate: workshop.workshop_date,
      enrolledAt: workshop.enrolled_at,
    })),
  };
}

/** A claimed job, with the identity used to reject late results. */
export interface LeadResearchClaim {
  readonly id: string;
  readonly runId: string;
  readonly company: string;
  readonly email: string;
}

/** Start one lookup for a lead; completed rows only run again on an explicit retry. */
export async function claimLeadResearch(
  db: BackofficeDatabase,
  id: string,
  retry: boolean,
): Promise<LeadResearchClaim | "running" | "not_found" | "complete"> {
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .selectFrom("leads")
      .select(["id", "company", "email", "company_research_status"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return "not_found";
    if (row.company_research_status === "running") return "running";
    if (!retry && row.company_research_status !== "pending") return "complete";
    const runId = randomUUID();
    await trx
      .updateTable("leads")
      .set({
        company_research_status: "running",
        company_research_run_id: runId,
        company_research_error: null,
        company_profile: null,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .execute();
    return { id: row.id, company: row.company, email: row.email, runId };
  });
}

export type LeadResearchOutcome =
  | { readonly status: "found"; readonly profile: CompanyProfile }
  | { readonly status: "not_found" | "failed" | "skipped"; readonly error?: string };

/** A stale or deleted claim cannot write a result or undo a newer request. */
export async function finishLeadResearch(
  db: BackofficeDatabase,
  claim: LeadResearchClaim,
  outcome: LeadResearchOutcome,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .updateTable("leads")
    .set({
      company_research_status: outcome.status,
      company_research_run_id: null,
      updated_at: now,
      company_researched_at: now,
      company_profile: outcome.status === "found" ? JSON.stringify(outcome.profile) : null,
      company_research_error: "error" in outcome ? (outcome.error ?? null) : null,
    })
    .where("id", "=", claim.id)
    .where("company_research_run_id", "=", claim.runId)
    .where("company_research_status", "=", "running")
    .execute();
}

/**
 * Erase a lead and every enrollment it made, to service an erasure request.
 *
 * Removing only the lead would leave the same personal data on the workshops.
 */
export async function deleteLead(db: BackofficeDatabase, id: string): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    await trx.deleteFrom("enrollments").where("lead_id", "=", id).execute();
    const result = await trx.deleteFrom("leads").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  });
}
