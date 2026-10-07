/**
 * A minimal client for the Pappers International REST API.
 *
 * Pappers bills credits per request, so the client makes exactly the requests
 * it is asked for and never retries on its own.
 */

export const PAPPERS_API_ROOT = "https://api.pappers.in/v1";

/** A Pappers request that failed. The message never contains the API token. */
export class PappersError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PappersError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

export class PappersClient {
  private readonly apiToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiToken: string, fetchImpl: typeof fetch = fetch) {
    this.apiToken = apiToken;
    this.fetchImpl = fetchImpl;
  }

  /** Companies matching a name or number in one country. */
  searchCompanies(params: {
    countryCode: string;
    query: string;
    page?: number;
    perPage?: number;
    signal?: AbortSignal;
  }): Promise<unknown> {
    return this.get(
      "/search",
      {
        country_code: params.countryCode,
        q: params.query,
        page: String(params.page ?? 1),
        per_page: String(params.perPage ?? 10),
      },
      params.signal,
    );
  }

  /** One company by its registration number, with the requested sections. */
  getCompany(params: {
    countryCode: string;
    companyNumber: string;
    fields?: readonly "financials"[];
    signal?: AbortSignal;
  }): Promise<unknown> {
    return this.get(
      "/company",
      {
        country_code: params.countryCode,
        company_number: params.companyNumber,
        ...(params.fields && params.fields.length > 0 ? { fields: params.fields.join(",") } : {}),
      },
      params.signal,
    );
  }

  private async get(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    // Pappers takes the token as a query parameter, so the URL is a secret:
    // it must never end up in an error message or a log line.
    const url = `${PAPPERS_API_ROOT}${path}?${new URLSearchParams({
      ...params,
      api_token: this.apiToken,
    })}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new PappersError("Could not reach the Pappers API.");
    }

    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    if (!response.ok) {
      const message =
        typeof body?.error === "string" ? body.error.replaceAll(this.apiToken, "[redacted]") : null;
      throw new PappersError(
        message ?? `The Pappers API answered with status ${response.status}.`,
        response.status,
      );
    }
    if (!body || typeof body !== "object")
      throw new PappersError("The Pappers API returned invalid company data.");
    return body;
  }
}
