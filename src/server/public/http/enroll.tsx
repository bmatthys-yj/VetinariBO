import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { EnrollmentRefusedError, enrollmentInputSchema } from "../../../contracts/enrollment.js";
import { createEnrollment } from "../../../db/enrollments.js";
import { findWorkshopBySlug } from "../../../db/workshops.js";
import type { WorkshopWithSeats } from "../../../db/workshops.js";
import type { BackofficeDatabase } from "../../../db/index.js";
import {
  EnrollPage,
  type EnrollErrors,
  type EnrollValues,
  type WorkshopView,
} from "../views/EnrollPage.js";
import { ClosedPage, NotFoundPage, ThanksPage } from "../views/StatusPages.js";
import { rateLimit } from "../rateLimit.js";

/** Largest form submission accepted, well above a filled-in enrollment form. */
const MAX_BODY_BYTES = 16 * 1024;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormatter.format(parsed);
}

/**
 * Project a workshop down to what an attendee may see.
 *
 * Built explicitly rather than by spreading the row, so a column added later
 * cannot leak onto the public page by default.
 */
function toWorkshopView(workshop: WorkshopWithSeats): WorkshopView {
  return {
    name: workshop.name,
    subject: workshop.subject,
    date: formatDate(workshop.date),
    locationName: workshop.locationName,
    locationAddress: workshop.locationAddress,
    seatsRemaining: workshop.seatsRemaining,
  };
}

function isPast(date: string): boolean {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return date < `${now.getFullYear()}-${month}-${day}`;
}

const REFUSAL_MESSAGES: Record<string, string> = {
  duplicate: "This email address is already enrolled for this workshop.",
  full: "The last seat was taken while you were filling this in.",
  closed: "Enrollment for this workshop has closed.",
};

export interface EnrollRouterOptions {
  /** Trust `x-forwarded-for` for rate limiting. Only behind a proxy you control. */
  readonly trustProxy?: boolean;
}

/** The entire public surface: view a workshop's form and submit it. */
export function createEnrollRouter(
  db: BackofficeDatabase,
  options: EnrollRouterOptions = {},
): Hono {
  const router = new Hono();

  router.get("/w/:slug", async (context) => {
    const workshop = await findWorkshopBySlug(db, context.req.param("slug"));
    if (!workshop) return context.html(<NotFoundPage />, 404);
    const view = toWorkshopView(workshop);
    if (isPast(workshop.date))
      return context.html(<ClosedPage workshop={view} reason="closed" />, 410);
    if (workshop.seatsRemaining <= 0)
      return context.html(<ClosedPage workshop={view} reason="full" />, 409);
    return context.html(<EnrollPage workshop={view} />);
  });

  router.get("/w/:slug/thanks", async (context) => {
    const workshop = await findWorkshopBySlug(db, context.req.param("slug"));
    if (!workshop) return context.html(<NotFoundPage />, 404);
    return context.html(<ThanksPage workshop={toWorkshopView(workshop)} />);
  });

  router.post(
    "/w/:slug",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (context) => context.text("Submission too large.", 413),
    }),
    rateLimit({ limit: 10, windowMs: 10 * 60 * 1000, trustProxy: options.trustProxy }),
    async (context) => {
      const slug = context.req.param("slug");
      const workshop = await findWorkshopBySlug(db, slug);
      if (!workshop) return context.html(<NotFoundPage />, 404);

      const view = toWorkshopView(workshop);
      const form = await context.req.parseBody();
      const field = (name: string) => (typeof form[name] === "string" ? form[name] : "");

      // A filled honeypot means a bot. Answer exactly as success would, so it
      // learns nothing, but store nothing.
      if (field("website").trim() !== "") return context.redirect(`/w/${slug}/thanks`, 303);

      const values: EnrollValues = {
        firstName: field("firstName"),
        lastName: field("lastName"),
        email: field("email"),
        phone: field("phone"),
        company: field("company"),
        position: field("position"),
        consent: field("consent"),
      };

      const errors: EnrollErrors = {};
      if (values.consent !== "yes") {
        errors.consent = "Please agree before enrolling.";
      }

      const parsed = enrollmentInputSchema.safeParse(values);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (key && !errors[key]) errors[key] = issue.message;
        }
      }

      if (Object.keys(errors).length > 0 || !parsed.success) {
        return context.html(<EnrollPage workshop={view} values={values} errors={errors} />, 400);
      }

      try {
        await createEnrollment(db, workshop.id, parsed.data);
      } catch (error) {
        if (error instanceof EnrollmentRefusedError) {
          if (error.reason === "full")
            return context.html(<ClosedPage workshop={view} reason="full" />, 409);
          if (error.reason === "closed")
            return context.html(<ClosedPage workshop={view} reason="closed" />, 410);
          return context.html(
            <EnrollPage
              workshop={view}
              values={values}
              formError={REFUSAL_MESSAGES[error.reason]}
            />,
            409,
          );
        }
        throw error;
      }

      // Redirect after POST, so refreshing the confirmation cannot resubmit.
      return context.redirect(`/w/${slug}/thanks`, 303);
    },
  );

  return router;
}
