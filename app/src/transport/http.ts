/** Public path the backoffice server mounts its HTTP endpoints on. */
export const API_BASE_PATH = "/api";

interface ApiErrorBody {
  error?: string;
  issues?: Array<{ path: string; message: string }>;
}

/** An unsuccessful backoffice API response, including any validation issues. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: Array<{ path: string; message: string }>;

  constructor(status: number, message: string, issues: Array<{ path: string; message: string }>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

async function toApiError(url: string, response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // A non-JSON error body carries no extra detail worth surfacing.
  }
  const message = body.error ?? `Request to ${url} failed with status ${response.status}`;
  return new ApiError(response.status, message, body.issues ?? []);
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw await toApiError(url, response);
  return (await response.json()) as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await toApiError(url, response);
  return (await response.json()) as T;
}

export async function deleteJson(url: string): Promise<void> {
  const response = await fetch(url, { method: "DELETE", headers: { accept: "application/json" } });
  if (!response.ok) throw await toApiError(url, response);
}
