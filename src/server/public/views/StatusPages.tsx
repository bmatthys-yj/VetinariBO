import { Layout, WorkshopHeader } from "./Layout.js";
import type { WorkshopView } from "./EnrollPage.js";

export function ThanksPage({ workshop }: { workshop: WorkshopView }) {
  return (
    <Layout title={`You are enrolled — ${workshop.name}`}>
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm md:p-8">
        <WorkshopHeader {...workshop} />
        <div class="rounded-md border border-primary/40 bg-primary/10 px-4 py-3">
          <p class="font-medium">You are enrolled.</p>
          <p class="mt-1 text-sm text-muted-foreground">
            We have your details. The organiser will be in touch before the workshop.
          </p>
        </div>
      </div>
    </Layout>
  );
}

/** Shown when a workshop can no longer take anyone, whether full or past. */
export function ClosedPage({
  workshop,
  reason,
}: {
  workshop: WorkshopView;
  reason: "full" | "closed";
}) {
  const heading = reason === "full" ? "This workshop is fully booked." : "Enrollment has closed.";
  const detail =
    reason === "full"
      ? "Every seat has been taken. Contact the organiser to ask about a waiting list."
      : "This workshop has already taken place.";
  return (
    <Layout title={`${heading} — ${workshop.name}`}>
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm md:p-8">
        <WorkshopHeader {...workshop} />
        <div class="rounded-md border bg-muted/40 px-4 py-3">
          <p class="font-medium">{heading}</p>
          <p class="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
    </Layout>
  );
}

/**
 * The only 404 the public app renders.
 *
 * It says nothing about what else this server might host, and looks the same
 * for a mistyped slug as for any other unmatched path.
 */
export function NotFoundPage() {
  return (
    <Layout title="Not found">
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm md:p-8">
        <h1 class="font-serif text-2xl tracking-tight">Not found</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          This enrollment link is not valid. Check the link you were given, or ask the organiser for
          a new one.
        </p>
      </div>
    </Layout>
  );
}
