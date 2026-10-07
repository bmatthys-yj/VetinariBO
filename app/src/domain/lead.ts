import type { CompanyResearchStatus, Lead } from "./contracts";

/** A lead's full name. */
export function leadName(lead: Pick<Lead, "firstName" | "lastName">): string {
  return `${lead.firstName} ${lead.lastName}`;
}

/** Whether the company lookup is still going, so the page should keep polling. */
export function isResearchInProgress(status: CompanyResearchStatus): boolean {
  return status === "running";
}

/** The company name to show: the register's once found, otherwise what was typed. */
export function leadCompanyName(lead: Lead): string {
  return lead.companyProfile?.name ?? lead.company;
}

export const RESEARCH_STATUS_LABELS: Record<CompanyResearchStatus, string> = {
  pending: "Not started",
  running: "Looking up…",
  found: "Found",
  not_found: "Not found",
  failed: "Failed",
  skipped: "Needs setup",
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Render an ISO timestamp for display, falling back to the raw value. */
export function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? timestamp : timestampFormatter.format(parsed);
}
