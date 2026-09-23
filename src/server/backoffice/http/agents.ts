import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  agentRunInputSchema,
  type Agent,
  type AgentRunResult,
  type GatewayStatus,
} from "../../../contracts/agent.js";
import { AgentRunError, runAgent } from "../../../agents/runAgent.js";
import type { AgentDefinition } from "../../../agents/types.js";
import { LiteLlmError, type LiteLlmClient } from "../../../llm/liteLlm.js";

/** The read-only view of a built-in agent. */
function toAgentView(agent: AgentDefinition): Agent {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    model: agent.model ?? null,
    systemPrompt: agent.systemPrompt,
    tools: agent.tools.map((tool) => ({ name: tool.name, description: tool.description })),
    ready: agent.missingConfig.length === 0,
    missingConfig: agent.missingConfig,
  };
}

/** The built-in agents, and running one through the LiteLLM gateway. */
export function createAgentsRouter(
  agents: readonly AgentDefinition[],
  liteLlm: LiteLlmClient,
): Hono {
  const router = new Hono();
  const byId = new Map(agents.map((agent) => [agent.id, agent]));

  router.get("/agents", (context) => {
    return context.json({ agents: agents.map(toAgentView) });
  });

  router.get("/agents/:agentId", (context) => {
    const agent = byId.get(context.req.param("agentId"));
    if (!agent) return context.json({ error: "Agent not found." }, 404);
    return context.json({ agent: toAgentView(agent) });
  });

  router.post(
    "/agents/:agentId/runs",
    zValidator("json", agentRunInputSchema, (result, context) => {
      if (result.success) return;
      return context.json(
        {
          error: "The prompt is not valid.",
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }),
    async (context) => {
      const agent = byId.get(context.req.param("agentId"));
      if (!agent) return context.json({ error: "Agent not found." }, 404);
      if (!liteLlm.configured) {
        return context.json({ error: "The LiteLLM gateway is not configured." }, 503);
      }
      if (agent.missingConfig.length > 0 || !agent.model) {
        return context.json(
          { error: `${agent.name} needs ${agent.missingConfig.join(", ")} to be set.` },
          503,
        );
      }

      try {
        const outcome = await runAgent(liteLlm, agent, context.req.valid("json").input);
        const run: AgentRunResult = { agentId: agent.id, model: agent.model, ...outcome };
        return context.json({ run });
      } catch (error) {
        if (error instanceof LiteLlmError || error instanceof AgentRunError) {
          return context.json({ error: error.message }, 502);
        }
        throw error;
      }
    },
  );

  router.get("/gateway", async (context) => {
    const base = { configured: liteLlm.configured, baseUrl: liteLlm.baseUrl };
    let status: GatewayStatus;
    if (!liteLlm.configured) {
      status = { ...base, reachable: false, models: [] };
    } else {
      try {
        status = { ...base, reachable: true, models: await liteLlm.listModels() };
      } catch (error) {
        if (!(error instanceof LiteLlmError)) throw error;
        status = { ...base, reachable: false, models: [], error: error.message };
      }
    }
    return context.json({ gateway: status });
  });

  return router;
}
