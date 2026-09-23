import type { z } from "zod";

/** A function an agent can call, with its arguments validated by a zod schema. */
export interface AgentTool<Args extends z.ZodType = z.ZodType> {
  readonly name: string;
  /** Tells the model when and how to use the tool. */
  readonly description: string;
  readonly parameters: Args;
  /** The returned value is sent back to the model as JSON. */
  run(args: z.output<Args>): Promise<unknown>;
}

/**
 * An agent built into the backoffice.
 *
 * Agents are code, not data: their instructions and tools change together, so
 * they are versioned with the repository rather than edited at runtime.
 */
export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** LiteLLM model deployment name, or `undefined` when none is configured. */
  readonly model: string | undefined;
  readonly systemPrompt: string;
  readonly tools: readonly AgentTool[];
  /** Environment variables that must be set before the agent can run. */
  readonly missingConfig: readonly string[];
}
