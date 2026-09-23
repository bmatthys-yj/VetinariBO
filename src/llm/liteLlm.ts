/**
 * A minimal client for LiteLLM's OpenAI-compatible API.
 *
 * It uses plain `fetch` rather than an SDK: the backoffice needs two endpoints,
 * and injecting `fetch` keeps the tests free of network access.
 */

export interface LiteLlmConfig {
  /** Gateway origin, with or without the trailing `/v1`. */
  readonly baseUrl: string;
  /** Virtual key created in the LiteLLM dashboard. `undefined` disables calls. */
  readonly apiKey: string | undefined;
}

/** A tool call the model asked for, in the OpenAI wire format. */
export interface ToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
}

/** One chat message, in the OpenAI wire format LiteLLM speaks. */
export type ChatMessage =
  | { readonly role: "system" | "user"; readonly content: string }
  | {
      readonly role: "assistant";
      readonly content: string | null;
      readonly tool_calls?: readonly ToolCall[];
    }
  | { readonly role: "tool"; readonly tool_call_id: string; readonly content: string };

/** A function the model may call, described by a JSON Schema. */
export interface ToolSpec {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

/** The assistant's turn: text, tool calls, or both. */
export interface AssistantMessage {
  readonly role: "assistant";
  readonly content: string | null;
  readonly tool_calls?: readonly ToolCall[];
}

/** A gateway request that failed, with a message safe to show in the backoffice. */
export class LiteLlmError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LiteLlmError";
    this.status = status;
  }
}

/** Normalize a gateway origin to its OpenAI-compatible `/v1` root. */
export function liteLlmApiRoot(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

const REQUEST_TIMEOUT_MS = 120_000;

export class LiteLlmClient {
  readonly baseUrl: string;
  private readonly apiRoot: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(config: LiteLlmConfig, fetchImpl: typeof fetch = fetch) {
    this.baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    this.apiRoot = liteLlmApiRoot(config.baseUrl);
    this.apiKey = config.apiKey;
    this.fetchImpl = fetchImpl;
  }

  /** Whether a key is set, so requests can be attempted at all. */
  get configured(): boolean {
    return this.apiKey !== undefined;
  }

  /** Model deployment names the key may use. */
  async listModels(): Promise<string[]> {
    const body = await this.request<{ data?: Array<{ id?: unknown }> }>("/models", {
      method: "GET",
    });
    return (body.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string")
      .sort();
  }

  /** Send one chat completion and return the assistant's message. */
  async chat(
    model: string,
    messages: readonly ChatMessage[],
    tools: readonly ToolSpec[] = [],
  ): Promise<AssistantMessage> {
    const body = await this.request<{ choices?: Array<{ message?: Partial<AssistantMessage> }> }>(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(tools.length > 0 ? { model, messages, tools } : { model, messages }),
      },
    );
    const message = body.choices?.[0]?.message;
    if (!message) throw new LiteLlmError("The gateway returned a completion without a message.");
    const toolCalls = message.tool_calls ?? [];
    return {
      role: "assistant",
      content: typeof message.content === "string" ? message.content : null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new LiteLlmError("No LiteLLM API key is configured (VETINARI_BO_LITELLM_API_KEY).");
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiRoot}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new LiteLlmError(`Could not reach the LiteLLM gateway at ${this.baseUrl}.`, undefined, {
        cause,
      });
    }

    if (!response.ok) {
      throw new LiteLlmError(await errorMessage(response), response.status);
    }
    return (await response.json()) as T;
  }
}

/** Pull LiteLLM's error message out of a failed response, if it sent one. */
async function errorMessage(response: Response): Promise<string> {
  const fallback = `The LiteLLM gateway answered with status ${response.status}.`;
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | string };
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    return typeof message === "string" && message.length > 0 ? message : fallback;
  } catch {
    return fallback;
  }
}
