import type { ReactNode } from "react";
import type { Workshop } from "../../../domain/contracts";
import { Badge } from "../../shared/ui/Badge";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { EmptyState } from "../../shared/layout/EmptyState";
import { WorkshopRow } from "./WorkshopRow";

export interface WorkshopsCardProps {
  workshops: Workshop[];
  isLoading: boolean;
  error: Error | null;
  title?: string;
  description?: string;
  emptyMessage?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * The workshop container view.
 *
 * It renders whatever the register holds, so it shows the empty state until a
 * workshop is added through the API or `pnpm db:add-workshop`.
 */
export function WorkshopsCard({
  actions,
  className,
  description = "Every workshop in the backoffice register.",
  emptyMessage = "No workshops yet. Add one to see it listed here.",
  error,
  isLoading,
  title = "Workshops",
  workshops,
}: WorkshopsCardProps) {
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        actions={actions ?? <Badge variant="secondary">{workshops.length}</Badge>}
      />
      {isLoading ? (
        <EmptyState>Loading workshops…</EmptyState>
      ) : error ? (
        <EmptyState>{`Could not load workshops: ${error.message}`}</EmptyState>
      ) : workshops.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="divide-y">
          {workshops.map((workshop) => (
            <WorkshopRow key={workshop.id} workshop={workshop} />
          ))}
        </div>
      )}
    </Card>
  );
}
