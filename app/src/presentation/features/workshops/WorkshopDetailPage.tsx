import { ArrowLeft, CalendarDays, Download, MapPin, Trash2, Users } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { useEnrollments, useDeleteEnrollment } from "../../../application/hooks/useEnrollments";
import { useWorkshop } from "../../../application/hooks/useWorkshops";
import { formatWorkshopDate } from "../../../domain/workshop";
import { enrollmentsCsvUrl } from "../../../transport/workshopsApi";
import { Badge } from "../../shared/ui/Badge";
import { Button, buttonVariants } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { EmptyState } from "../../shared/layout/EmptyState";
import { PageLayout } from "../../shared/layout/PageLayout";
import { PublicFormLink } from "./PublicFormLink";

export function WorkshopDetailPage() {
  const { workshopId } = useParams({ from: "/workshops/$workshopId" });
  const { workshop, isLoading, error } = useWorkshop(workshopId);
  const { enrollments, isLoading: loadingEnrollments } = useEnrollments(workshopId);
  const removeEnrollment = useDeleteEnrollment(workshopId);

  if (isLoading) {
    return (
      <PageLayout>
        <EmptyState>Loading workshop…</EmptyState>
      </PageLayout>
    );
  }
  if (error || !workshop) {
    return (
      <PageLayout>
        <EmptyState>
          {error ? `Could not load workshop: ${error.message}` : "Not found."}
        </EmptyState>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Link
        to="/workshops"
        className={buttonVariants({
          variant: "ghost",
          className: "-ml-2 h-8 gap-1.5 px-2 text-muted-foreground",
        })}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span>All workshops</span>
      </Link>

      <section className="flex items-start gap-3">
        <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-none tracking-tight">{workshop.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{workshop.subject}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              {formatWorkshopDate(workshop.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
              {workshop.locationName}
              <span className="text-muted-foreground">— {workshop.locationAddress}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              {workshop.enrollmentCount} / {workshop.maxApplicants} enrolled
            </span>
          </div>
          {workshop.url && (
            <a
              href={workshop.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              External page ↗
            </a>
          )}
        </div>
      </section>

      <PublicFormLink url={workshop.publicUrl} />

      <Card>
        <CardHeader
          title="Enrollments"
          description="Everyone who signed up through the hosted form."
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{workshop.enrollmentCount}</Badge>
              {enrollments.length > 0 && (
                <a
                  href={enrollmentsCsvUrl(workshopId)}
                  className={buttonVariants({ variant: "outline", className: "h-8 gap-1.5 px-3" })}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>CSV</span>
                </a>
              )}
            </div>
          }
        />
        {loadingEnrollments ? (
          <EmptyState>Loading enrollments…</EmptyState>
        ) : enrollments.length === 0 ? (
          <EmptyState>Nobody has enrolled yet. Share the form link above.</EmptyState>
        ) : (
          <div className="divide-y">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {enrollment.firstName} {enrollment.lastName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {enrollment.email}
                    {enrollment.phone && ` · ${enrollment.phone}`}
                  </p>
                  {(enrollment.company || enrollment.position) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[enrollment.position, enrollment.company].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5 px-3 text-destructive"
                  disabled={removeEnrollment.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${enrollment.firstName} ${enrollment.lastName}?`)) {
                      removeEnrollment.mutate(enrollment.id);
                    }
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
