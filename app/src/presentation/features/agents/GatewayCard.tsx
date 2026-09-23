import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { useGatewayStatus } from "../../../application/hooks/useAgents";
import { Badge } from "../../shared/ui/Badge";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";

/** Whether the agents can run: the LiteLLM gateway's configuration and reachability. */
export function GatewayCard() {
  const { gateway, isLoading, error } = useGatewayStatus();

  let icon = <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />;
  let label = "Checking…";
  let detail: string | null = null;

  if (error) {
    icon = <CircleAlert className="size-4 text-destructive" aria-hidden="true" />;
    label = "Status unavailable";
    detail = error.message;
  } else if (gateway && !gateway.configured) {
    icon = <CircleAlert className="size-4 text-muted-foreground" aria-hidden="true" />;
    label = "Not configured";
    detail = "Set VETINARI_BO_LITELLM_API_KEY to a virtual key from the LiteLLM dashboard.";
  } else if (gateway && !gateway.reachable) {
    icon = <CircleAlert className="size-4 text-destructive" aria-hidden="true" />;
    label = "Unreachable";
    detail = gateway.error ?? "Start it with pnpm litellm:up.";
  } else if (gateway) {
    icon = <CircleCheck className="size-4 text-primary" aria-hidden="true" />;
    label = "Connected";
    detail =
      gateway.models.length === 0
        ? "No models yet. Add a deployment in the LiteLLM dashboard."
        : null;
  }

  return (
    <Card>
      <CardHeader
        title="LiteLLM gateway"
        description={gateway?.baseUrl ?? "Every agent sends its model requests through it."}
        actions={
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {icon}
            {isLoading ? "Checking…" : label}
          </span>
        }
      />
      {(detail || (gateway && gateway.models.length > 0)) && (
        <div className="space-y-3 px-5 py-4">
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
          {gateway && gateway.models.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Available models">
              {gateway.models.map((model) => (
                <Badge key={model} variant="outline" className="font-mono font-normal">
                  {model}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
