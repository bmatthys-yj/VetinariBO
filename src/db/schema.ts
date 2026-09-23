/**
 * The `workshops` table.
 *
 * Columns use snake_case to stay idiomatic for SQL, and the repository in
 * `workshops.ts` is the single place that maps them to the camelCase
 * `Workshop` contract shared with the web client.
 */
export interface WorkshopTable {
  id: string;
  name: string;
  /** ISO calendar date (`YYYY-MM-DD`). */
  date: string;
  max_applicants: number;
  subject: string;
  /** Public page hosting the workshop. */
  url: string;
  location_name: string;
  location_address: string;
  created_at: string;
  updated_at: string;
}

/** The Kysely table registry for the backoffice database. */
export interface BackofficeSchema {
  workshops: WorkshopTable;
}
