import { Building2, CalendarDays } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LeadSummary } from "../../../domain/contracts";
import { leadCompanyName, leadName } from "../../../domain/lead";
import { Badge } from "../../shared/ui/Badge";
import { buttonVariants } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { EmptyState } from "../../shared/layout/EmptyState";
import { ResearchStatusBadge } from "./ResearchStatusBadge";

export interface LeadsCardProps {
  leads: LeadSummary[];
  isLoading: boolean;
  error: Error | null;
}

/** Every lead, newest first. */
export function LeadsCard({ error, isLoading, leads }: LeadsCardProps) {
  return (
    <Card>
      <CardHeader
        title="Leads"
        description="People who enrolled for a workshop and named their company."
        actions={<Badge variant="secondary">{leads.length}</Badge>}
      />
      {isLoading ? (
        <EmptyState>Loading leads…</EmptyState>
      ) : error ? (
        <EmptyState>{`Could not load leads: ${error.message}`}</EmptyState>
      ) : leads.length === 0 ? (
        <EmptyState>
          No leads yet. Anyone who names their company on an enrollment form shows up here.
        </EmptyState>
      ) : (
        <div className="divide-y">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to="/leads/$leadId"
                  params={{ leadId: lead.id }}
                  className="truncate font-medium underline-offset-4 hover:underline"
                >
                  {leadName(lead)}
                </Link>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{lead.email}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {[lead.position, leadCompanyName(lead)].filter(Boolean).join(" · ")}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-3 text-sm sm:ml-4">
                <ResearchStatusBadge status={lead.companyResearchStatus} />
                <span className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  {lead.workshopCount} {lead.workshopCount === 1 ? "workshop" : "workshops"}
                </span>
                <Link
                  to="/leads/$leadId"
                  params={{ leadId: lead.id }}
                  className={buttonVariants({ variant: "outline", className: "h-8 shrink-0 px-3" })}
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
