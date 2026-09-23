import { sql, type Migration, type MigrationProvider } from "kysely";
import { generateWorkshopSlug } from "./slug.js";

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

/**
 * Give every workshop the slug its hosted enrollment form is served under.
 *
 * SQLite cannot add a `UNIQUE` column in place, so the column is added
 * nullable, backfilled, and only then covered by a unique index.
 */
const addWorkshopSlug: Migration = {
  async up(db) {
    await db.schema.alterTable("workshops").addColumn("slug", "text").execute();

    const rows = await db.selectFrom("workshops").select(["id", "name"]).execute();
    for (const row of rows) {
      await db
        .updateTable("workshops")
        .set({ slug: generateWorkshopSlug(row.name as string) })
        .where("id", "=", row.id)
        .execute();
    }

    await db.schema
      .createIndex("workshops_slug_unique")
      .unique()
      .on("workshops")
      .column("slug")
      .execute();
  },
  async down(db) {
    await db.schema.dropIndex("workshops_slug_unique").execute();
    await db.schema.alterTable("workshops").dropColumn("slug").execute();
  },
};

/**
 * Make `url` optional now that the enrollment form is hosted from `slug`.
 *
 * SQLite cannot drop a `NOT NULL` constraint, so this is the documented
 * rebuild: create the replacement table, copy, drop, rename, recreate indexes.
 * It runs before `enrollments` exists so no foreign key ever points at the
 * dropped table.
 */
const makeWorkshopUrlOptional: Migration = {
  async up(db) {
    await db.schema
      .createTable("workshops_new")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("date", "text", (column) => column.notNull())
      .addColumn("max_applicants", "integer", (column) =>
        column.notNull().check(sql`max_applicants > 0`),
      )
      .addColumn("subject", "text", (column) => column.notNull())
      .addColumn("url", "text")
      .addColumn("location_name", "text", (column) => column.notNull())
      .addColumn("location_address", "text", (column) => column.notNull())
      .addColumn("slug", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("updated_at", "text", (column) => column.notNull())
      .execute();

    await sql`
      insert into workshops_new
        (id, name, date, max_applicants, subject, url, location_name,
         location_address, slug, created_at, updated_at)
      select
        id, name, date, max_applicants, subject, nullif(url, ''), location_name,
        location_address, slug, created_at, updated_at
      from workshops
    `.execute(db);

    await db.schema.dropTable("workshops").execute();
    await sql`alter table workshops_new rename to workshops`.execute(db);

    await db.schema.createIndex("workshops_date_index").on("workshops").column("date").execute();
    await db.schema
      .createIndex("workshops_slug_unique")
      .unique()
      .on("workshops")
      .column("slug")
      .execute();
  },
  async down() {
    throw new Error("Restoring the NOT NULL constraint on workshops.url is not supported.");
  },
};

const createEnrollments: Migration = {
  async up(db) {
    await db.schema
      .createTable("enrollments")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("workshop_id", "text", (column) =>
        column.notNull().references("workshops.id").onDelete("cascade"),
      )
      .addColumn("first_name", "text", (column) => column.notNull())
      .addColumn("last_name", "text", (column) => column.notNull())
      .addColumn("email", "text", (column) => column.notNull())
      .addColumn("phone", "text")
      .addColumn("company", "text")
      .addColumn("position", "text")
      .addColumn("consented_at", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex("enrollments_workshop_id_index")
      .on("enrollments")
      .column("workshop_id")
      .execute();

    // One person cannot take two seats in the same workshop.
    await db.schema
      .createIndex("enrollments_workshop_email_unique")
      .unique()
      .on("enrollments")
      .columns(["workshop_id", "email"])
      .execute();
  },
  async down(db) {
    await db.schema.dropTable("enrollments").execute();
  },
};

const createAgents: Migration = {
  async up(db) {
    await db.schema
      .createTable("agents")
      .addColumn("id", "text", (column) => column.primaryKey())
      .addColumn("name", "text", (column) => column.notNull())
      .addColumn("description", "text")
      .addColumn("model", "text", (column) => column.notNull())
      .addColumn("system_prompt", "text", (column) => column.notNull())
      .addColumn("created_at", "text", (column) => column.notNull())
      .addColumn("updated_at", "text", (column) => column.notNull())
      .execute();
  },
  async down(db) {
    await db.schema.dropTable("agents").execute();
  },
};

/**
 * Agents are defined in code now (see `src/agents`), so the table that held
 * hand-added agents goes. `0005` stays as applied history.
 */
const dropAgents: Migration = {
  async up(db) {
    await db.schema.dropTable("agents").ifExists().execute();
  },
  async down(db) {
    await createAgents.up(db);
  },
};

/** Ordered migration set. Names sort lexicographically, so keep the numeric prefix. */
export const MIGRATIONS: Record<string, Migration> = {
  "0001_create_workshops": createWorkshops,
  "0002_add_workshop_slug": addWorkshopSlug,
  "0003_make_workshop_url_optional": makeWorkshopUrlOptional,
  "0004_create_enrollments": createEnrollments,
  "0005_create_agents": createAgents,
  "0006_drop_agents": dropAgents,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return MIGRATIONS;
  },
};
