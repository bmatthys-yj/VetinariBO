import type { PappersGatewayConfig } from "../tools/pappers/pappersClient.js";

/** Runtime configuration shared by both servers. */

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function readHost(value: string | undefined, fallback: string): string {
  const host = value?.trim();
  return host && host.length > 0 ? host : fallback;
}

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
  /**
   * LiteLLM gateway that serves the Pappers MCP server. The gateway holds the
   * Pappers credentials; missing values make company lookups fail.
   */
  readonly pappers: Partial<PappersGatewayConfig>;
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
    pappers: {
      baseUrl: env.LITELLM_BASE_URL?.trim(),
      apiKey: env.LITELLM_MASTER_KEY?.trim(),
      server: env.VETINARI_BO_PAPPERS_MCP_SERVER?.trim(),
    },
  };
}

/** The address the hosted enrollment form for `slug` is served at. */
export function workshopPublicUrl(publicBaseUrl: string, slug: string): string {
  return `${publicBaseUrl}/w/${slug}`;
}
