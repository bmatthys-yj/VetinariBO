import type { Child } from "hono/jsx";

/**
 * The shell every public page renders into.
 *
 * The theme toggle is deliberately absent: an attendee gets whichever theme
 * their system asks for, with no stored preference and no client-side script.
 */
export function Layout({ title, children }: { title: string; children: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="color-scheme" content="light dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex" />
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/styles.css" />
      </head>
      <body class="bg-muted/30">
        <main class="mx-auto min-h-full w-full max-w-2xl px-4 py-10 md:py-16">{children}</main>
      </body>
    </html>
  );
}

/** Workshop details shown above the form, and on the closed and thanks pages. */
export function WorkshopHeader({
  name,
  subject,
  date,
  locationName,
  locationAddress,
}: {
  name: string;
  subject: string;
  date: string;
  locationName: string;
  locationAddress: string;
}) {
  return (
    <header class="mb-6">
      <p class="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
        Workshop
      </p>
      <h1 class="mt-2 font-serif text-3xl leading-tight tracking-tight">{name}</h1>
      <p class="mt-2 text-muted-foreground">{subject}</p>
      <dl class="mt-4 grid gap-1 text-sm">
        <div class="flex gap-2">
          <dt class="w-20 shrink-0 text-muted-foreground">Date</dt>
          <dd>{date}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-20 shrink-0 text-muted-foreground">Location</dt>
          <dd>
            {locationName}
            <span class="text-muted-foreground"> — {locationAddress}</span>
          </dd>
        </div>
      </dl>
    </header>
  );
}
