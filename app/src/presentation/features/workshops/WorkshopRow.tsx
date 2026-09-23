import { MapPin, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Workshop } from "../../../domain/contracts";
import { formatWorkshopDate } from "../../../domain/workshop";
import { buttonVariants } from "../../shared/ui/Button";
import { PublicFormLink } from "./PublicFormLink";

export function WorkshopRow({ workshop }: { workshop: Workshop }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          to="/workshops/$workshopId"
          params={{ workshopId: workshop.id }}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {workshop.name}
        </Link>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{workshop.subject}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {workshop.locationName} — {workshop.locationAddress}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-3 text-sm sm:ml-4 sm:text-right">
        <div>
          <p className="font-medium tabular-nums">{formatWorkshopDate(workshop.date)}</p>
          <p className="text-xs text-muted-foreground">date</p>
        </div>
        <div>
          <p className="flex items-center justify-end gap-1.5 font-medium tabular-nums">
            <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {workshop.enrollmentCount} / {workshop.maxApplicants}
          </p>
          <p className="text-xs text-muted-foreground">enrolled</p>
        </div>
        <PublicFormLink url={workshop.publicUrl} compact />
        <Link
          to="/workshops/$workshopId"
          params={{ workshopId: workshop.id }}
          className={buttonVariants({ variant: "outline", className: "h-8 shrink-0 px-3" })}
        >
          Details
        </Link>
      </div>
    </div>
  );
}
