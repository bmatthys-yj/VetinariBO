import { z } from "zod";

/** Calendar date the workshop is held on, stored as `YYYY-MM-DD`. */
const workshopDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO calendar date (YYYY-MM-DD)")
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    "Expected a real calendar date",
  );

/**
 * A text field that is absent rather than empty.
 *
 * HTML forms and JSON clients both send `""` for a skipped field, which would
 * otherwise be stored as an empty string instead of `NULL`.
 */
export function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );
}

/**
 * The client-supplied shape of a workshop.
 *
 * The location is kept as two plain fields rather than its own table: the
 * backoffice only needs to show where a workshop happens, and a separate venue
 * entity would add joins without adding behavior today.
 */
export const workshopInputSchema = z.object({
  /** Public title of the workshop. */
  name: z.string().trim().min(1, "Name is required").max(200),
  /** Day the workshop is held. */
  date: workshopDateSchema,
  /** Upper bound on accepted applicants. */
  maxApplicants: z.coerce.number().int().positive("Expected at least one applicant").max(10_000),
  /** Topic the workshop covers. */
  subject: z.string().trim().min(1, "Subject is required").max(200),
  /**
   * Optional external page for the workshop, such as a marketing or landing
   * page. The enrollment form we host ourselves is addressed by `slug` instead.
   */
  url: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.url("Expected a valid URL").max(2048).optional(),
  ),
  /** Human-readable name of the venue. */
  locationName: z.string().trim().min(1, "Location name is required").max(200),
  /** Street address of the venue. */
  locationAddress: z.string().trim().min(1, "Location address is required").max(500),
});

/** A workshop as submitted by a client, before persistence metadata is added. */
export type WorkshopInput = z.infer<typeof workshopInputSchema>;

/** A persisted workshop. */
export interface Workshop extends WorkshopInput {
  readonly id: string;
  /** Unguessable path segment the hosted enrollment form is served under. */
  readonly slug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A workshop as the backoffice API returns it.
 *
 * `publicUrl` is derived from configuration at the edge rather than stored, so
 * changing the public hostname is a config edit and not a data migration.
 */
export interface WorkshopSummary extends Workshop {
  readonly publicUrl: string;
  readonly enrollmentCount: number;
  readonly seatsRemaining: number;
}
