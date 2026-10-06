import { z } from "zod";

/**
 * Where the automatic company lookup for a lead stands.
 *
 * - `pending`: queued, not started yet.
 * - `running`: the Pappers agent is working on it.
 * - `found`: a company was matched; `company` holds its profile.
 * - `not_found`: the agent could not match the company in the register.
 * - `failed`: the run errored; `companyResearchError` says why.
 * - `skipped`: the agent is not configured, so nothing was attempted.
 */
export const COMPANY_RESEARCH_STATUSES = [
  "pending",
  "running",
  "found",
  "not_found",
  "failed",
  "skipped",
] as const;

export type CompanyResearchStatus = (typeof COMPANY_RESEARCH_STATUSES)[number];

const optionalString = (max: number) =>
  z.preprocess(
    (value) =>
      value === null || (typeof value === "string" && value.trim() === "") ? undefined : value,
    z.string().trim().max(max).optional(),
  );

/**
 * What the Pappers agent reports about a lead's company.
 *
 * The agent answers in JSON, and this schema is what makes that answer safe to
 * store: anything it cannot parse is treated as a failed lookup, not stored.
 */
export const companyProfileSchema = z.object({
  name: z.string().trim().min(1).max(300),
  companyNumber: optionalString(50),
  countryCode: optionalString(2),
  legalForm: optionalString(200),
  status: optionalString(100),
  address: optionalString(500),
  /** Headcount as the register states it: an exact number or a band, with its year. */
  employees: optionalString(100),
  /** What the company does, in plain words. */
  activity: optionalString(1_000),
  /** ISO calendar date the company was founded, when known. */
  foundedOn: optionalString(20),
  website: optionalString(500),
  /** A short paragraph a salesperson can read before a call. */
  summary: optionalString(2_000),
  /** Why the agent believes this is the lead's company. */
  matchNote: optionalString(1_000),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

/** A person who enrolled for a workshop on behalf of a company. */
export interface Lead {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone?: string;
  readonly company: string;
  readonly position?: string;
  readonly companyResearchStatus: CompanyResearchStatus;
  readonly companyResearchError?: string;
  readonly companyResearchedAt?: string;
  readonly companyProfile?: CompanyProfile;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A lead as the list shows it. */
export interface LeadSummary extends Lead {
  readonly workshopCount: number;
}

/** One workshop a lead enrolled for. */
export interface LeadWorkshop {
  readonly enrollmentId: string;
  readonly workshopId: string;
  readonly workshopName: string;
  /** ISO calendar date (`YYYY-MM-DD`). */
  readonly workshopDate: string;
  readonly enrolledAt: string;
}

/** A lead with every workshop it enrolled for, soonest-held first. */
export interface LeadDetail extends Lead {
  readonly workshops: readonly LeadWorkshop[];
}
