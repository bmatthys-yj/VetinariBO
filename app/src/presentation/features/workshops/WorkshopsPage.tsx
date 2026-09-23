import { CalendarDays } from "lucide-react";
import { useWorkshops } from "../../../application/hooks/useWorkshops";
import { PageHeader } from "../../shared/layout/PageHeader";
import { PageLayout } from "../../shared/layout/PageLayout";
import { WorkshopForm } from "./WorkshopForm";
import { WorkshopsCard } from "./WorkshopsCard";

export function WorkshopsPage() {
  const { workshops, isLoading, error } = useWorkshops();

  return (
    <PageLayout>
      <PageHeader
        icon={CalendarDays}
        eyebrow="Register"
        title="Workshops"
        description="Every workshop the backoffice tracks, with the venue that hosts it."
      />
      <WorkshopForm />
      <WorkshopsCard workshops={workshops} isLoading={isLoading} error={error} />
    </PageLayout>
  );
}
