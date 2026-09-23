/**
 * The `workshops` table.
 *
 * Columns use snake_case to stay idiomatic for SQL, and the repositories in
 * `workshops.ts` and `enrollments.ts` are the single place that map them to the
 * camelCase contracts shared with the web client.
 */
export interface WorkshopTable {
  id: string;
  name: string;
  /** ISO calendar date (`YYYY-MM-DD`). */
  date: string;
  max_applicants: number;
  subject: string;
  /** Optional external page, such as a marketing or landing page. */
  url: string | null;
  location_name: string;
  location_address: string;
  /** Unguessable path segment the hosted enrollment form is served under. */
  slug: string;
  created_at: string;
  updated_at: string;
}

/** One person signed up for a workshop through the hosted form. */
export interface EnrollmentTable {
  id: string;
  workshop_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  /** Proof of consent, recorded when the form was submitted. */
  consented_at: string;
  created_at: string;
}

/** The Kysely table registry for the backoffice database. */
export interface BackofficeSchema {
  workshops: WorkshopTable;
  enrollments: EnrollmentTable;
}
