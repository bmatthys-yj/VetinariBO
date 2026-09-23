import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Kysely } from "kysely";
import { NodeSqliteDialect } from "./nodeSqliteDialect.js";
import type { BackofficeSchema } from "./schema.js";

/** Location of the local SQLite file when the environment does not override it. */
export const DEFAULT_DATABASE_FILE = "./data/vetinari-bo.db";

/** The typed Kysely instance used across the backoffice. */
export type BackofficeDatabase = Kysely<BackofficeSchema>;

/** Resolve the absolute SQLite file path from the environment. */
export function resolveDatabaseFile(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.VETINARI_BO_DATABASE_FILE?.trim();
  return resolve(configured && configured.length > 0 ? configured : DEFAULT_DATABASE_FILE);
}

/** Open the local database, creating its directory when it does not exist. */
export function createDatabase(file: string = resolveDatabaseFile()): BackofficeDatabase {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  return new Kysely<BackofficeSchema>({ dialect: new NodeSqliteDialect(file) });
}

export type { BackofficeSchema, WorkshopTable } from "./schema.js";
