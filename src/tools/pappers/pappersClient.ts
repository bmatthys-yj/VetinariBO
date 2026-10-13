/**
 * A minimal client for the Pappers MCP server, reached through the LiteLLM
 * gateway's REST bridge for MCP tools. The gateway holds the Pappers
 * credentials, so this process only needs its LiteLLM key.
 *
 * Pappers bills credits per tool call (search even per result), so the client
 * makes exactly the calls it is asked for and never retries on its own.
 */

/** The MCP server name LiteLLM registers Pappers under, unless configured. */
export const DEFAULT_PAPPERS_MCP_SERVER = "Pappers_MCP";

/** A Pappers request that failed. The message never contains the gateway key. */
export class PappersError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PappersError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

export interface PappersGatewayConfig {
  /** LiteLLM origin. A trailing `/v1`, as the model provider accepts, is ignored. */
  readonly baseUrl: string;
  /** LiteLLM key allowed to use the Pappers MCP server. */
  readonly apiKey: string;
  /** MCP server id, name, or alias in LiteLLM. */
  readonly server?: string;
}

export class PappersClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly server: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PappersGatewayConfig, fetchImpl: typeof fetch = fetch) {
    const root = config.baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
    this.endpoint = `${root}/mcp-rest/tools/call`;
    this.apiKey = config.apiKey;
    this.server = config.server?.trim() || DEFAULT_PAPPERS_MCP_SERVER;
    this.fetchImpl = fetchImpl;
  }

  /**
   * The company Pappers resolves a name to, with its default record sections,
   * in one tool call (one credit). `null` when nothing matches.
   */
  resolveCompany(params: { name: string; signal?: AbortSignal }): Promise<unknown> {
    return this.callTool("entity-resolver", { company_name: params.name }, params.signal);
  }

  private async callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name, server_id: this.server, arguments: args }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PappersError("Could not reach the LiteLLM gateway for Pappers.");
    }

    const body = (await response.json().catch(() => null)) as {
      detail?: unknown;
      error?: unknown;
      isError?: unknown;
      content?: unknown;
    } | null;
    if (!response.ok) {
      throw new PappersError(
        this.redact(gatewayMessage(body)) ??
          `The LiteLLM gateway answered with status ${response.status}.`,
        response.status,
      );
    }

    const text = Array.isArray(body?.content)
      ? body.content
          .map((part: { type?: unknown; text?: unknown }) =>
            part?.type === "text" && typeof part.text === "string" ? part.text : "",
          )
          .join("")
      : undefined;
    if (text === undefined) throw new PappersError("The Pappers MCP server returned no content.");
    if (body?.isError === true) {
      throw new PappersError(this.redact(text.trim()) || "The Pappers MCP tool failed.");
    }
    let result: unknown;
    try {
      result = JSON.parse(text) as unknown;
    } catch {
      throw new PappersError("The Pappers MCP server returned invalid company data.");
    }
    // Pappers reports some failures, such as running out of credits, as a
    // successful tool call whose result is `{ "error": "..." }`.
    const error = (result as { error?: unknown } | null)?.error;
    if (typeof error === "string") throw new PappersError(this.redact(error) ?? error);
    return result;
  }

  private redact(message: string | null): string | null {
    return message && this.apiKey ? message.replaceAll(this.apiKey, "[redacted]") : message;
  }
}

/** The error text in a LiteLLM error body, which nests it differently per route. */
function gatewayMessage(body: { detail?: unknown; error?: unknown } | null): string | null {
  const candidates = [body?.detail, body?.error];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = candidate as { message?: unknown; error?: { message?: unknown } };
      if (typeof nested.message === "string") return nested.message;
      if (typeof nested.error?.message === "string") return nested.error.message;
    }
  }
  return null;
}
