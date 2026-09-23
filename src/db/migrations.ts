import { sql, type Migration, type MigrationProvider } from "kysely";

const createWorkshops: Migration = {
  async up(db) {
    await db.schema
      .createTable("workshops")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("date", "text", (column) => column.notNull())
      .addColumn("max_applicants", "integer", (column) =>
        column.notNull().check(sql`max_applicants > 0`),
      )
      .addColumn("subject", "text", (column) => column.notNull())
      .addColumn("url", "text", (column) => column.notNull())
      .addColumn("location_name", "text", (column) => column.notNull())
      .addColumn("location_address", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("updated_at", "text", (column) => column.notNull())
      .execute();
    await db.schema.createIndex("workshops_date_index").on("workshops").column("date").execute();
  },
  async down(db) {
    await db.schema.dropIndex("workshops_date_index").execute();
    await db.schema.dropTable("workshops").execute();
  },
};

/** Ordered migration set. Names sort lexicographically, so keep the numeric prefix. */
export const MIGRATIONS: Record<string, Migration> = {
  "0001_create_workshops": createWorkshops,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return MIGRATIONS;
  },
};
