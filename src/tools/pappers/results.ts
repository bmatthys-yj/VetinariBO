/** Drop `null` fields to reduce the data sent back to the model. */
export function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, compact(entry)]),
    );
  }
  return value;
}

/** Trim large company sections and cap the response sent to the model. */
export function trimCompany(company: unknown): unknown {
  if (!company || typeof company !== "object" || Array.isArray(company)) return compact(company);
  const trimmed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(company)) {
    if (Array.isArray(value) && value.length > 25) {
      trimmed[key] = value.slice(0, 25);
      trimmed[`${key}_total`] = value.length;
    } else {
      trimmed[key] = value;
    }
  }
  return compact(trimmed);
}

export function limitToolResult(value: unknown): unknown {
  const json = JSON.stringify(value);
  return json.length > 40_000 ? `${json.slice(0, 40_000)}… [truncated]` : value;
}
