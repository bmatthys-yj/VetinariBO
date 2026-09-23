import { Bot } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Agent } from "../../../domain/contracts";
import { Badge } from "../../shared/ui/Badge";
import { buttonVariants } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { EmptyState } from "../../shared/layout/EmptyState";

export interface AgentsCardProps {
  agents: Agent[];
  isLoading: boolean;
  error: Error | null;
}

/** The agent list: every agent built into the backoffice. */
export function AgentsCard({ agents, error, isLoading }: AgentsCardProps) {
  return (
    <Card>
      <CardHeader
        title="Agents"
        description="The agents that ship with the backoffice."
        actions={<Badge variant="secondary">{agents.length}</Badge>}
      />
      {isLoading ? (
        <EmptyState>Loading agents…</EmptyState>
      ) : error ? (
        <EmptyState>{`Could not load agents: ${error.message}`}</EmptyState>
      ) : agents.length === 0 ? (
        <EmptyState>No agents are built in.</EmptyState>
      ) : (
        <div className="divide-y">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-secondary p-2 text-secondary-foreground">
                  <Bot className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <Link
                    to="/agents/$agentId"
                    params={{ agentId: agent.id }}
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {agent.name}
                  </Link>
                  {agent.description && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 sm:ml-4">
                {agent.ready ? (
                  <Badge variant="outline" className="font-mono font-normal">
                    {agent.model}
                  </Badge>
                ) : (
                  <Badge variant="destructive">Needs setup</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {agent.tools.length} {agent.tools.length === 1 ? "tool" : "tools"}
                </span>
                <Link
                  to="/agents/$agentId"
                  params={{ agentId: agent.id }}
                  className={buttonVariants({ variant: "outline", className: "h-8 shrink-0 px-3" })}
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
