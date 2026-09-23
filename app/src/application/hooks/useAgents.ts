import { useMutation, useQuery } from "@tanstack/react-query";
import type { AgentRunResult } from "../../domain/contracts";
import { fetchAgent, fetchAgents, fetchGatewayStatus, runAgent } from "../../transport/agentsApi";
import { queryKeys } from "../queryKeys";

/** Read the built-in agents. */
export function useAgents() {
  const query = useQuery({ queryKey: queryKeys.agents, queryFn: fetchAgents });
  return { agents: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

/** Read one agent, including its instructions and tools. */
export function useAgent(agentId: string) {
  const query = useQuery({
    queryKey: queryKeys.agent(agentId),
    queryFn: () => fetchAgent(agentId),
  });
  return { agent: query.data ?? null, isLoading: query.isLoading, error: query.error };
}

/** Send one prompt to an agent. Runs are not stored, so nothing is invalidated. */
export function useRunAgent(agentId: string) {
  return useMutation<AgentRunResult, Error, string>({
    mutationFn: (input) => runAgent(agentId, input),
  });
}

/** Whether the LiteLLM gateway is configured and reachable, and its models. */
export function useGatewayStatus() {
  const query = useQuery({
    queryKey: queryKeys.gateway,
    queryFn: fetchGatewayStatus,
    // A gateway started after the page loaded should show up without a reload.
    refetchInterval: 30_000,
  });
  return { gateway: query.data ?? null, isLoading: query.isLoading, error: query.error };
}
