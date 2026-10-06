import type { ReactNode } from "react";
import { ArrowLeft, CalendarDays, Contact, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useDeleteLead, useLead } from "../../../application/hooks/useLeads";
import { formatTimestamp, leadName } from "../../../domain/lead";
import { formatWorkshopDate, isUpcoming } from "../../../domain/workshop";
import { Badge } from "../../shared/ui/Badge";
import { Button, buttonVariants } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { EmptyState } from "../../shared/layout/EmptyState";
import { PageLayout } from "../../shared/layout/PageLayout";
import { CompanyCard } from "./CompanyCard";

export function LeadDetailPage() {
  const { leadId } = useParams({ from: "/leads/$leadId" });
  const { lead, isLoading, error } = useLead(leadId);
  const removeLead = useDeleteLead();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageLayout>
        <EmptyState>Loading lead…</EmptyState>
      </PageLayout>
    );
  }
  if (error || !lead) {
    return (
      <PageLayout>
        <EmptyState>{error ? `Could not load lead: ${error.message}` : "Not found."}</EmptyState>
      </PageLayout>
    );
  }

  const details: Array<[string, ReactNode]> = [
    [
      "Email",
      <a href={`mailto:${lead.email}`} className="underline-offset-4 hover:underline">
        {lead.email}
      </a>,
    ],
    [
      "Phone",
      lead.phone && (
        <a href={`tel:${lead.phone}`} className="underline-offset-4 hover:underline">
          {lead.phone}
        </a>
      ),
    ],
    ["Company", lead.company],
    ["Position", lead.position],
    ["Lead since", formatTimestamp(lead.createdAt)],
  ];

  return (
    <PageLayout>
      <Link
        to="/leads"
        className={buttonVariants({
          variant: "ghost",
          className: "-ml-2 h-8 gap-1.5 px-2 text-muted-foreground",
        })}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span>All leads</span>
      </Link>

      <section className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
            <Contact className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl leading-none tracking-tight">{leadName(lead)}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {[lead.position, lead.companyProfile?.name ?? lead.company]
                .filter(Boolean)
                .join(" at ")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 px-3 text-destructive"
          disabled={removeLead.isPending}
          onClick={() => {
            const confirmed = window.confirm(
              `Erase ${leadName(lead)}? This removes the lead and their enrollment for every workshop.`,
            );
            if (confirmed) {
              removeLead.mutate(lead.id, { onSuccess: () => navigate({ to: "/leads" }) });
            }
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          <span>Erase</span>
        </Button>
      </section>
      {removeLead.error && <p className="text-sm text-destructive">{removeLead.error.message}</p>}

      <Card>
        <CardHeader
          title="Contact details"
          description="As given on their most recent enrollment form."
        />
        <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-[10rem_1fr]">
          {details
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
        </dl>
      </Card>

      <CompanyCard lead={lead} />

      <Card>
        <CardHeader
          title="Workshops"
          description="Every workshop this person enrolled for."
          actions={<Badge variant="secondary">{lead.workshops.length}</Badge>}
        />
        {lead.workshops.length === 0 ? (
          <EmptyState>
            No enrollments left. They may have been removed from their workshops.
          </EmptyState>
        ) : (
          <div className="divide-y">
            {lead.workshops.map((workshop) => (
              <div
                key={workshop.enrollmentId}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    to="/workshops/$workshopId"
                    params={{ workshopId: workshop.workshopId }}
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {workshop.workshopName}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Enrolled {formatTimestamp(workshop.enrolledAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {formatWorkshopDate(workshop.workshopDate)}
                  </span>
                  {isUpcoming(workshop.workshopDate) ? (
                    <Badge variant="outline">Upcoming</Badge>
                  ) : (
                    <Badge variant="secondary">Took place</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
