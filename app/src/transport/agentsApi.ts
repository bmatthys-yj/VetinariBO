import type { Agent, AgentRunResult, GatewayStatus } from "../domain/contracts";
import { API_BASE_PATH, getJson, postJson } from "./http";

export async function fetchAgents(): Promise<Agent[]> {
  const body = await getJson<{ agents: Agent[] }>(`${API_BASE_PATH}/agents`);
  return body.agents;
}

export async function fetchAgent(agentId: string): Promise<Agent> {
  const body = await getJson<{ agent: Agent }>(`${API_BASE_PATH}/agents/${agentId}`);
  return body.agent;
}

export async function runAgent(agentId: string, input: string): Promise<AgentRunResult> {
  const body = await postJson<{ run: AgentRunResult }>(`${API_BASE_PATH}/agents/${agentId}/runs`, {
    input,
  });
  return body.run;
}

export async function fetchGatewayStatus(): Promise<GatewayStatus> {
  const body = await getJson<{ gateway: GatewayStatus }>(`${API_BASE_PATH}/gateway`);
  return body.gateway;
}
