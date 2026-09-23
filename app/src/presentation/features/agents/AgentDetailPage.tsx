import { useState, type FormEvent } from "react";
import { ArrowLeft, Bot, CircleAlert, Loader2, Play, Wrench } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import type { AgentToolCall } from "../../../domain/contracts";
import { useAgent, useRunAgent } from "../../../application/hooks/useAgents";
import { Badge } from "../../shared/ui/Badge";
import { Button, buttonVariants } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { EmptyState } from "../../shared/layout/EmptyState";
import { PageLayout } from "../../shared/layout/PageLayout";
import { Label } from "../../shared/ui/Label";
import { Textarea } from "../../shared/ui/Textarea";

export function AgentDetailPage() {
  const { agentId } = useParams({ from: "/agents/$agentId" });
  const { agent, isLoading, error } = useAgent(agentId);
  const run = useRunAgent(agentId);
  const [input, setInput] = useState("");

  if (isLoading) {
    return (
      <PageLayout>
        <EmptyState>Loading agent…</EmptyState>
      </PageLayout>
    );
  }
  if (error || !agent) {
    return (
      <PageLayout>
        <EmptyState>{error ? `Could not load agent: ${error.message}` : "Not found."}</EmptyState>
      </PageLayout>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run.mutate(input);
  }

  return (
    <PageLayout>
      <Link
        to="/agents"
        className={buttonVariants({
          variant: "ghost",
          className: "-ml-2 h-8 gap-1.5 px-2 text-muted-foreground",
        })}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span>All agents</span>
      </Link>

      <section className="flex items-start gap-3">
        <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-serif text-3xl leading-none tracking-tight">{agent.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{agent.description}</p>
          {agent.model && (
            <Badge variant="outline" className="mt-3 font-mono font-normal">
              {agent.model}
            </Badge>
          )}
        </div>
      </section>

      {!agent.ready && (
        <Card className="border-destructive/50">
          <div className="flex items-start gap-3 px-5 py-4">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">This agent cannot run yet.</p>
              <p className="mt-1 text-muted-foreground">
                Set{" "}
                {agent.missingConfig.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ", "}
                    <code className="font-mono text-foreground">{name}</code>
                  </span>
                ))}{" "}
                in <code className="font-mono text-foreground">.env</code> and restart the
                backoffice.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Run"
          description="Ask a question. The agent calls its tools, then answers. Runs are not stored."
        />
        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="agent-run-input">Prompt</Label>
            <Textarea
              id="agent-run-input"
              required
              rows={4}
              placeholder="Who are the directors of Proximus, and when did it last file its accounts?"
              value={input}
              disabled={!agent.ready}
              onChange={(event) => setInput(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            className="h-9 gap-2 px-4"
            disabled={!agent.ready || run.isPending || input.trim() === ""}
          >
            {run.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            <span>{run.isPending ? "Working…" : "Run agent"}</span>
          </Button>
          {run.error && <p className="text-sm text-destructive">{run.error.message}</p>}
          {run.data && !run.isPending && (
            <div className="space-y-3">
              {run.data.toolCalls.length > 0 && <ToolCallList calls={run.data.toolCalls} />}
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Reply
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{run.data.output}</p>
              </div>
            </div>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader title="Tools" description="What the agent can call while it works." />
        <div className="divide-y">
          {agent.tools.map((tool) => (
            <div key={tool.name} className="px-5 py-3">
              <p className="font-mono text-sm font-medium">{tool.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{tool.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Instructions" description="Sent as the system message on every run." />
        <p className="whitespace-pre-wrap px-5 py-4 text-sm">{agent.systemPrompt}</p>
      </Card>
    </PageLayout>
  );
}

/** The tools a run called, in order, so a reply can be traced back to its sources. */
function ToolCallList({ calls }: { calls: AgentToolCall[] }) {
  return (
    <ol className="space-y-1.5" aria-label="Tool calls">
      {calls.map((call, index) => (
        <li key={index} className="flex items-start gap-2 text-sm">
          <Wrench
            className={`mt-0.5 size-3.5 shrink-0 ${call.error ? "text-destructive" : "text-muted-foreground"}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <span className="font-mono font-medium">{call.name}</span>{" "}
            <span className="break-all font-mono text-xs text-muted-foreground">
              {JSON.stringify(call.arguments)}
            </span>
            {call.error && <p className="text-xs text-destructive">{call.error}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
