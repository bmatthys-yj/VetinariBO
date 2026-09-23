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
  /** Public page hosting the workshop. */
  url: z.url("Expected a valid URL").max(2048),
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
  readonly createdAt: string;
  readonly updatedAt: string;
}
