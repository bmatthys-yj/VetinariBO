import { CalendarDays, CalendarPlus, LayoutDashboard, UserCheck, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useWorkshops } from "../../../application/hooks/useWorkshops";
import {
  formatWorkshopDate,
  nextWorkshop,
  totalEnrollments,
  totalSeats,
  upcomingWorkshops,
} from "../../../domain/workshop";
import { buttonVariants } from "../../shared/ui/Button";
import { PageHeader } from "../../shared/layout/PageHeader";
import { PageLayout } from "../../shared/layout/PageLayout";
import { MetricCard } from "./MetricCard";
import { WorkshopsCard } from "../workshops/WorkshopsCard";

export function DashboardPage() {
  const { workshops, isLoading, error } = useWorkshops();
  const upcoming = upcomingWorkshops(workshops);
  const next = nextWorkshop(workshops);

  return (
    <PageLayout>
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Backoffice"
        title="Dashboard"
        description="Clients, leads, workshops, and repositories at a glance."
        actions={
          <Link
            to="/workshops"
            className={buttonVariants({ variant: "outline", className: "h-9 gap-2 px-3" })}
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            <span>Add workshop</span>
          </Link>
        }
      />

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Backoffice statistics"
      >
        <MetricCard
          label="Workshops"
          value={workshops.length}
          detail="In the register"
          icon={<CalendarDays className="size-4" />}
        />
        <MetricCard
          label="Upcoming"
          value={upcoming.length}
          detail={next ? `Next on ${formatWorkshopDate(next.date)}` : "None scheduled"}
          icon={<CalendarPlus className="size-4" />}
        />
        <MetricCard
          label="Seats offered"
          value={totalSeats(upcoming)}
          detail="Across upcoming workshops"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label="Enrollments"
          value={totalEnrollments(workshops)}
          detail="Through the hosted forms"
          icon={<UserCheck className="size-4" />}
        />
      </section>

      <section aria-label="Workshops">
        <WorkshopsCard
          workshops={workshops}
          isLoading={isLoading}
          error={error}
          description="The workshops this backoffice keeps track of."
        />
      </section>
    </PageLayout>
  );
}
