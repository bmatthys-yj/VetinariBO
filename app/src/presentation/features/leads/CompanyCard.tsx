import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useResearchLead } from "../../../application/hooks/useLeads";
import type { CompanyProfile, LeadDetail } from "../../../domain/contracts";
import { formatTimestamp, isResearchInProgress } from "../../../domain/lead";
import { formatWorkshopDate } from "../../../domain/workshop";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { ResearchStatusBadge } from "./ResearchStatusBadge";

/** Websites come from the model, so only plain http(s) links are made clickable. */
function safeHref(website: string): string | null {
  const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** What the Pappers agent found about the lead's company, and a way to look again. */
export function CompanyCard({ lead }: { lead: LeadDetail }) {
  const research = useResearchLead(lead.id);
  const inProgress = isResearchInProgress(lead.companyResearchStatus);

  return (
    <Card>
      <CardHeader
        title="Company"
        description="Company data from Pappers, summarized for your next call."
        actions={
          <div className="flex items-center gap-2">
            <ResearchStatusBadge status={lead.companyResearchStatus} />
            <Button
              type="button"
              variant="outline"
              className="h-8 gap-1.5 px-3"
              disabled={inProgress || research.isPending}
              onClick={() => research.mutate()}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span>
                {lead.companyResearchStatus === "failed" ? "Retry lookup" : "Look up again"}
              </span>
            </Button>
          </div>
        }
      />
      <div className="space-y-4 px-5 py-4">
        {research.error && (
          <p role="alert" className="text-sm text-destructive">
            {research.error.message}
          </p>
        )}
        <ResearchMessage lead={lead} />
        {lead.companyProfile && <ProfileDetails profile={lead.companyProfile} />}
        {lead.companyResearchedAt && !inProgress && (
          <p className="text-xs text-muted-foreground">
            Last looked up {formatTimestamp(lead.companyResearchedAt)}.
          </p>
        )}
      </div>
    </Card>
  );
}

function ResearchMessage({ lead }: { lead: LeadDetail }) {
  const company = <span className="font-medium text-foreground">{lead.company}</span>;
  switch (lead.companyResearchStatus) {
    case "pending":
      return (
        <p className="text-sm text-muted-foreground">
          {company} has not been looked up yet. Use Look up again to start.
        </p>
      );
    case "running":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>
            Looking up {company} in the company register. This usually takes under a minute.
          </span>
        </p>
      );
    case "found":
      return null;
    case "not_found":
      return (
        <p className="text-sm text-muted-foreground">
          No company matched {company} in the register.
          {lead.companyResearchError && ` ${lead.companyResearchError}`}
        </p>
      );
    case "failed":
      return (
        <p role="alert" className="text-sm text-destructive">
          The lookup failed: {lead.companyResearchError ?? "unknown error"}
        </p>
      );
    case "skipped":
      return (
        <p className="text-sm text-muted-foreground">
          Company research is not set up, so {company} was not looked up.
          {lead.companyResearchError && ` ${lead.companyResearchError}`}
        </p>
      );
  }
}

function ProfileDetails({ profile }: { profile: CompanyProfile }) {
  const website = profile.website ? safeHref(profile.website) : null;
  const rows: Array<[string, ReactNode]> = [
    ["Name", profile.name],
    [
      "Registration",
      profile.companyNumber &&
        [profile.companyNumber, profile.countryCode?.toUpperCase()].filter(Boolean).join(" · "),
    ],
    ["Business", profile.activity],
    ["Employees", profile.employees],
    ["Address", profile.address],
    ["Legal form", profile.legalForm],
    ["Status", profile.status],
    [
      "Founded",
      profile.foundedOn && /^\d{4}-\d{2}-\d{2}$/.test(profile.foundedOn)
        ? formatWorkshopDate(profile.foundedOn)
        : profile.foundedOn,
    ],
    [
      "Website",
      website ? (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          {profile.website}
        </a>
      ) : (
        profile.website
      ),
    ],
  ];

  return (
    <div className="space-y-4">
      {profile.summary && <p className="text-sm">{profile.summary}</p>}
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>
      {profile.matchNote && (
        <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why this match: </span>
          {profile.matchNote}
        </p>
      )}
    </div>
  );
}
