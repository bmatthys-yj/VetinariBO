import { Loader2 } from "lucide-react";
import type { CompanyResearchStatus } from "../../../domain/contracts";
import { isResearchInProgress, RESEARCH_STATUS_LABELS } from "../../../domain/lead";
import { Badge, type BadgeProps } from "../../shared/ui/Badge";

const VARIANTS: Record<CompanyResearchStatus, BadgeProps["variant"]> = {
  pending: "outline",
  running: "outline",
  found: "secondary",
  not_found: "outline",
  failed: "destructive",
  skipped: "destructive",
};

/** Where the Pappers lookup of a lead's company stands. */
export function ResearchStatusBadge({ status }: { status: CompanyResearchStatus }) {
  return (
    <Badge variant={VARIANTS[status]} className="gap-1.5 font-normal">
      {isResearchInProgress(status) && (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      )}
      {RESEARCH_STATUS_LABELS[status]}
    </Badge>
  );
}
