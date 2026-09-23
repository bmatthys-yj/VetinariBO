import { z } from "zod";
import { optionalText } from "./workshop.js";

/** What a person fills in on the hosted enrollment form. */
export const enrollmentInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.email("Expected a valid email address").max(320),
  phone: optionalText(50),
  company: optionalText(200),
  position: optionalText(200),
});

/** An enrollment as submitted, before persistence metadata is added. */
export type EnrollmentInput = z.infer<typeof enrollmentInputSchema>;

/** A persisted enrollment. */
export interface Enrollment extends EnrollmentInput {
  readonly id: string;
  readonly workshopId: string;
  /** When the person ticked the consent box, kept as proof of consent. */
  readonly consentedAt: string;
  readonly createdAt: string;
}

/** Why an enrollment was refused, so each surface can phrase it itself. */
export type EnrollmentRefusal = "full" | "closed" | "duplicate";

/** Thrown when a workshop cannot accept the enrollment. */
export class EnrollmentRefusedError extends Error {
  readonly reason: EnrollmentRefusal;

  constructor(reason: EnrollmentRefusal) {
    super(`Enrollment refused: ${reason}`);
    this.name = "EnrollmentRefusedError";
    this.reason = reason;
  }
}
