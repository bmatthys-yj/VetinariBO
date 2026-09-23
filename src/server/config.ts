/** Runtime configuration shared by both servers. */

function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function readHost(value: string | undefined, fallback: string): string {
  const host = value?.trim();
  return host && host.length > 0 ? host : fallback;
}

export interface ServerConfig {
  /** Backoffice bind address. Loopback by default, so it is not reachable off-box. */
  readonly backofficeHost: string;
  readonly backofficePort: number;
  /** Public form bind address. */
  readonly publicHost: string;
  readonly publicPort: number;
  /** Origin the hosted enrollment form is reachable at, used to build links. */
  readonly publicBaseUrl: string;
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const publicPort = readPort(env.VETINARI_BO_PUBLIC_PORT, 3001);
  return {
    backofficeHost: readHost(env.VETINARI_BO_HOST, "127.0.0.1"),
    backofficePort: readPort(env.VETINARI_BO_PORT, 3000),
    publicHost: readHost(env.VETINARI_BO_PUBLIC_HOST, "0.0.0.0"),
    publicPort,
    publicBaseUrl: readHost(
      env.VETINARI_BO_PUBLIC_BASE_URL,
      `http://localhost:${publicPort}`,
    ).replace(/\/+$/, ""),
  };
}

/** The address the hosted enrollment form for `slug` is served at. */
export function workshopPublicUrl(publicBaseUrl: string, slug: string): string {
  return `${publicBaseUrl}/w/${slug}`;
}
