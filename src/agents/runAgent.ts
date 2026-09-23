import { z } from "zod";
import type { AgentToolCall } from "../contracts/agent.js";
import type { ChatMessage, LiteLlmClient, ToolCall, ToolSpec } from "../llm/liteLlm.js";
import type { AgentDefinition, AgentTool } from "./types.js";

/** Model turns allowed per run, so a looping model cannot run up the bill. */
export const MAX_AGENT_STEPS = 8;

/** Tool results are cut to this many characters before the model sees them. */
const MAX_TOOL_RESULT_CHARS = 40_000;

/** A run that could not finish, with a message safe to show in the backoffice. */
export class AgentRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRunError";
  }
}

export interface AgentRunOutcome {
  readonly output: string;
  readonly toolCalls: AgentToolCall[];
}

/** Describe a tool to the model as an OpenAI function with a JSON Schema. */
export function toToolSpec(tool: AgentTool): ToolSpec {
  const { $schema: _ignored, ...parameters } = z.toJSONSchema(tool.parameters, { io: "input" });
  return {
    type: "function",
    function: { name: tool.name, description: tool.description, parameters },
  };
}

/**
 * Run an agent on one prompt: ask the model, execute the tools it calls, feed
 * the results back, and repeat until it answers in text.
 *
 * A failing tool does not fail the run. Its error goes back to the model,
 * which can retry with other arguments or explain what it could not find.
 */
export async function runAgent(
  liteLlm: LiteLlmClient,
  agent: AgentDefinition,
  input: string,
): Promise<AgentRunOutcome> {
  if (!agent.model) throw new AgentRunError(`${agent.name} has no model configured.`);

  const tools = new Map(agent.tools.map((tool) => [tool.name, tool]));
  const toolSpecs = agent.tools.map(toToolSpec);
  const messages: ChatMessage[] = [
    { role: "system", content: agent.systemPrompt },
    { role: "user", content: input },
  ];
  const toolCalls: AgentToolCall[] = [];

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const reply = await liteLlm.chat(agent.model, messages, toolSpecs);
    messages.push(reply);

    if (!reply.tool_calls || reply.tool_calls.length === 0) {
      return { output: reply.content ?? "", toolCalls };
    }

    for (const call of reply.tool_calls) {
      const { record, result } = await executeToolCall(tools, call);
      toolCalls.push(record);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  throw new AgentRunError(
    `${agent.name} did not finish within ${MAX_AGENT_STEPS} steps. Try a narrower question.`,
  );
}

async function executeToolCall(
  tools: ReadonlyMap<string, AgentTool>,
  call: ToolCall,
): Promise<{ record: AgentToolCall; result: string }> {
  const name = call.function.name;
  const fail = (error: string, args: unknown) => ({
    record: { name, arguments: args, error },
    result: JSON.stringify({ error }),
  });

  let rawArgs: unknown;
  try {
    rawArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return fail("The arguments were not valid JSON.", call.function.arguments);
  }

  const tool = tools.get(name);
  if (!tool) return fail(`There is no tool named ${name}.`, rawArgs);

  const parsed = tool.parameters.safeParse(rawArgs);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return fail(`Invalid arguments. ${issues.join("; ")}`, rawArgs);
  }

  try {
    const result = JSON.stringify(await tool.run(parsed.data));
    return {
      record: { name, arguments: rawArgs },
      result:
        result.length > MAX_TOOL_RESULT_CHARS
          ? `${result.slice(0, MAX_TOOL_RESULT_CHARS)}… [truncated]`
          : result,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The tool failed.", rawArgs);
  }
}
