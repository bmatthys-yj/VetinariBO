import { z } from "zod";

/**
 * A built-in agent as the backoffice API returns it.
 *
 * Agents are defined in code (`src/agents`), so this is a read-only view: the
 * instructions and tools ship with the repository.
 */
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** LiteLLM model deployment name, or `null` when none is configured. */
  readonly model: string | null;
  readonly systemPrompt: string;
  readonly tools: ReadonlyArray<{ readonly name: string; readonly description: string }>;
  /** `false` while any of `missingConfig` is unset. */
  readonly ready: boolean;
  /** Environment variables the agent still needs. */
  readonly missingConfig: readonly string[];
}

/** One prompt sent to an agent from the backoffice. */
export const agentRunInputSchema = z.object({
  input: z.string().trim().min(1, "A prompt is required").max(20_000),
});

export type AgentRunInput = z.infer<typeof agentRunInputSchema>;

/** A tool the agent called during a run, and why it failed if it did. */
export interface AgentToolCall {
  readonly name: string;
  readonly arguments: unknown;
  readonly error?: string;
}

/** The agent's reply to a run. Runs are not stored. */
export interface AgentRunResult {
  readonly agentId: string;
  readonly model: string;
  readonly output: string;
  readonly toolCalls: readonly AgentToolCall[];
}

/** Whether the backoffice can reach the LiteLLM gateway, and what it serves. */
export interface GatewayStatus {
  /** `false` when no API key is configured, so no request was attempted. */
  readonly configured: boolean;
  readonly reachable: boolean;
  readonly baseUrl: string;
  readonly models: string[];
  readonly error?: string;
}
