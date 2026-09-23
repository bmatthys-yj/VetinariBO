import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load `.env` into `process.env`, if the file exists.
 *
 * Uses Node's built-in parser, so there is no dotenv dependency. Variables
 * already set in the environment win over the file, so a value exported in the
 * shell still overrides `.env`. Only entry points call this; the tests never
 * read a developer's local `.env`.
 */
export function loadEnvFile(file: string = resolve(".env")): boolean {
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}
