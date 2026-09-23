import { Bot } from "lucide-react";
import { useAgents } from "../../../application/hooks/useAgents";
import { PageHeader } from "../../shared/layout/PageHeader";
import { PageLayout } from "../../shared/layout/PageLayout";
import { AgentsCard } from "./AgentsCard";
import { GatewayCard } from "./GatewayCard";

export function AgentsPage() {
  const { agents, isLoading, error } = useAgents();

  return (
    <PageLayout>
      <PageHeader
        icon={Bot}
        eyebrow="Automation"
        title="Agents"
        description="Built-in agents that work on the backoffice, run through the LiteLLM gateway."
      />
      <GatewayCard />
      <AgentsCard agents={agents} isLoading={isLoading} error={error} />
    </PageLayout>
  );
}
