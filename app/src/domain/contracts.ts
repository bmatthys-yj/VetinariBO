/** A workshop served by the backoffice API. */
export interface Workshop {
  id: string;
  name: string;
  /** ISO calendar date (`YYYY-MM-DD`). */
  date: string;
  maxApplicants: number;
  subject: string;
  /** Optional external page, such as a marketing or landing page. */
  url?: string;
  locationName: string;
  locationAddress: string;
  /** Path segment the hosted enrollment form is served under. */
  slug: string;
  /** Address of the hosted enrollment form, derived by the server. */
  publicUrl: string;
  enrollmentCount: number;
  seatsRemaining: number;
  createdAt: string;
  updatedAt: string;
}

/** The fields required to create a workshop. */
export type WorkshopInput = Omit<
  Workshop,
  "id" | "slug" | "publicUrl" | "enrollmentCount" | "seatsRemaining" | "createdAt" | "updatedAt"
>;

/** One person signed up for a workshop through the hosted form. */
export interface Enrollment {
  id: string;
  workshopId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  consentedAt: string;
  createdAt: string;
}
