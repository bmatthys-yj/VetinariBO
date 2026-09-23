import { pathToFileURL } from "node:url";
import { Migrator } from "kysely";
import { createDatabase, resolveDatabaseFile, type BackofficeDatabase } from "./index.js";
import { migrationProvider } from "./migrations.js";

/** Apply every pending migration, reporting each result to the console. */
export async function migrateToLatest(db: BackofficeDatabase): Promise<void> {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    const outcome = result.status === "Success" ? "applied" : result.status.toLowerCase();
    console.log(`migration ${result.migrationName}: ${outcome}`);
  }
  if (error) throw error instanceof Error ? error : new Error(String(error));
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  const file = resolveDatabaseFile();
  const db = createDatabase(file);
  try {
    await migrateToLatest(db);
    console.log(`Database is up to date: ${file}`);
  } finally {
    await db.destroy();
  }
}
