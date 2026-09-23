export { createBackofficeApp, API_BASE_PATH } from "./server/app.js";
export { createDatabase, resolveDatabaseFile, DEFAULT_DATABASE_FILE } from "./db/index.js";
export type { BackofficeDatabase, BackofficeSchema, WorkshopTable } from "./db/index.js";
export { migrateToLatest } from "./db/migrate.js";
export { createWorkshop, listWorkshops } from "./db/workshops.js";
export { workshopInputSchema } from "./contracts/workshop.js";
export type { Workshop, WorkshopInput } from "./contracts/workshop.js";
