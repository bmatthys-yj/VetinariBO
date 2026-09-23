import { Hono } from "hono";
import { deleteEnrollment, listEnrollments } from "../../../db/enrollments.js";
import { findWorkshopById } from "../../../db/workshops.js";
import type { Enrollment } from "../../../contracts/enrollment.js";
import type { BackofficeDatabase } from "../../../db/index.js";

const CSV_COLUMNS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "position",
  "created_at",
] as const;

/** Quote a value for CSV, guarding against spreadsheet formula injection. */
function csvCell(value: string | undefined): string {
  const text = value ?? "";
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(enrollments: Enrollment[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = enrollments.map((enrollment) =>
    [
      enrollment.firstName,
      enrollment.lastName,
      enrollment.email,
      enrollment.phone,
      enrollment.company,
      enrollment.position,
      enrollment.createdAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...rows].join("\r\n");
}

/** Backoffice-only views of who enrolled. Never mounted on the public app. */
export function createEnrollmentsRouter(db: BackofficeDatabase): Hono {
  const router = new Hono();

  router.get("/workshops/:workshopId/enrollments", async (context) => {
    const workshopId = context.req.param("workshopId");
    const workshop = await findWorkshopById(db, workshopId);
    if (!workshop) return context.json({ error: "Workshop not found." }, 404);
    return context.json({ enrollments: await listEnrollments(db, workshopId) });
  });

  router.get("/workshops/:workshopId/enrollments.csv", async (context) => {
    const workshopId = context.req.param("workshopId");
    const workshop = await findWorkshopById(db, workshopId);
    if (!workshop) return context.text("Workshop not found.", 404);
    const csv = toCsv(await listEnrollments(db, workshopId));
    return context.body(csv, 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${workshop.slug}-enrollments.csv"`,
    });
  });

  // Servicing an erasure request.
  router.delete("/workshops/:workshopId/enrollments/:enrollmentId", async (context) => {
    const removed = await deleteEnrollment(
      db,
      context.req.param("workshopId"),
      context.req.param("enrollmentId"),
    );
    if (!removed) return context.json({ error: "Enrollment not found." }, 404);
    return context.body(null, 204);
  });

  return router;
}
