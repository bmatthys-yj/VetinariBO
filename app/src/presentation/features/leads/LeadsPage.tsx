import { Contact } from "lucide-react";
import { useLeads } from "../../../application/hooks/useLeads";
import { PageHeader } from "../../shared/layout/PageHeader";
import { PageLayout } from "../../shared/layout/PageLayout";
import { LeadsCard } from "./LeadsCard";

export function LeadsPage() {
  const { leads, isLoading, error } = useLeads();

  return (
    <PageLayout>
      <PageHeader
        icon={Contact}
        eyebrow="Pipeline"
        title="Leads"
        description="Workshop attendees and their companies, with company profiles from Pappers."
      />
      <LeadsCard leads={leads} isLoading={isLoading} error={error} />
    </PageLayout>
  );
}
