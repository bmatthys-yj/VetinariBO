import { createPappersAgent } from "./pappers/pappersAgent.js";
import { PappersClient } from "./pappers/pappersClient.js";
import type { AgentDefinition } from "./types.js";

export interface BuiltInAgentsConfig {
  /** Default LiteLLM model for the built-in agents. */
  readonly model: string | undefined;
  readonly pappersApiToken: string | undefined;
  /** Injected in tests so no request leaves the process. */
  readonly fetch?: typeof fetch;
}

/** Every agent the backoffice ships with. Add new agents here. */
export function createBuiltInAgents(config: BuiltInAgentsConfig): AgentDefinition[] {
  return [
    createPappersAgent({
      model: config.model,
      client: config.pappersApiToken
        ? new PappersClient(config.pappersApiToken, config.fetch)
        : undefined,
    }),
  ];
}
