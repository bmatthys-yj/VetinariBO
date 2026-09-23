/** A workshop served by the backoffice API. */
export interface Workshop {
  id: string;
  name: string;
  /** ISO calendar date (`YYYY-MM-DD`). */
  date: string;
  maxApplicants: number;
  subject: string;
  /** Public page hosting the workshop. */
  url: string;
  locationName: string;
  locationAddress: string;
  createdAt: string;
  updatedAt: string;
}

/** The fields required to create a workshop. */
export type WorkshopInput = Omit<Workshop, "id" | "createdAt" | "updatedAt">;
