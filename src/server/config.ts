/** Runtime configuration shared by both servers. */

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function readHost(value: string | undefined, fallback: string): string {
  const host = value?.trim();
  return host && host.length > 0 ? host : fallback;
}

/** Where `pnpm litellm:up` publishes the gateway. */
export const DEFAULT_LITELLM_BASE_URL = "http://localhost:4000";

/**
 * Default ports sit in the 3100 range because Vetinari, which runs alongside,
 * already uses 3000.
 */
export interface ServerConfig {
  /** Backoffice bind address. Loopback by default, so it is not reachable off-box. */
  readonly backofficeHost: string;
  readonly backofficePort: number;
  /** Public form bind address. */
  readonly publicHost: string;
  readonly publicPort: number;
  /** Origin the hosted enrollment form is reachable at, used to build links. */
  readonly publicBaseUrl: string;
  /** LiteLLM gateway the agents send model requests through. */
  readonly liteLlmBaseUrl: string;
  /** Virtual key for the gateway. Agents cannot run while this is unset. */
  readonly liteLlmApiKey: string | undefined;
  /** Default model deployment for the built-in agents. */
  readonly liteLlmModel: string | undefined;
  /** Pappers International API token, used by the Pappers agent. */
  readonly pappersApiToken: string | undefined;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const publicPort = readPort(env.VETINARI_BO_PUBLIC_PORT, 3101);
  return {
    backofficeHost: readHost(env.VETINARI_BO_HOST, "127.0.0.1"),
    backofficePort: readPort(env.VETINARI_BO_PORT, 3100),
    publicHost: readHost(env.VETINARI_BO_PUBLIC_HOST, "0.0.0.0"),
    publicPort,
    publicBaseUrl: readHost(
      env.VETINARI_BO_PUBLIC_BASE_URL,
      `http://localhost:${publicPort}`,
    ).replace(/\/+$/, ""),
    liteLlmBaseUrl: readHost(env.VETINARI_BO_LITELLM_BASE_URL, DEFAULT_LITELLM_BASE_URL),
    liteLlmApiKey: env.VETINARI_BO_LITELLM_API_KEY?.trim() || undefined,
    liteLlmModel: env.VETINARI_BO_LITELLM_MODEL?.trim() || undefined,
    pappersApiToken: env.VETINARI_BO_PAPPERS_API_TOKEN?.trim() || undefined,
  };
}

/** The address the hosted enrollment form for `slug` is served at. */
export function workshopPublicUrl(publicBaseUrl: string, slug: string): string {
  return `${publicBaseUrl}/w/${slug}`;
}
