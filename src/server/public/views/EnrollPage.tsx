import { Layout, WorkshopHeader } from "./Layout.js";

export interface WorkshopView {
  name: string;
  subject: string;
  date: string;
  locationName: string;
  locationAddress: string;
  seatsRemaining: number;
}

/** Values echoed back so a rejected submission does not lose what was typed. */
export type EnrollValues = Record<string, string>;
export type EnrollErrors = Record<string, string>;

const FIELDS = [
  {
    name: "firstName",
    label: "First name",
    type: "text",
    required: true,
    autocomplete: "given-name",
  },
  {
    name: "lastName",
    label: "Last name",
    type: "text",
    required: true,
    autocomplete: "family-name",
  },
  { name: "email", label: "Email address", type: "email", required: true, autocomplete: "email" },
  { name: "phone", label: "Phone number", type: "tel", required: false, autocomplete: "tel" },
  {
    name: "company",
    label: "Company",
    type: "text",
    required: false,
    autocomplete: "organization",
  },
  {
    name: "position",
    label: "Position in the company",
    type: "text",
    required: false,
    autocomplete: "organization-title",
  },
] as const;

const INPUT_CLASS =
  "mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid]:border-destructive";

export function EnrollPage({
  workshop,
  values = {},
  errors = {},
  formError,
}: {
  workshop: WorkshopView;
  values?: EnrollValues;
  errors?: EnrollErrors;
  formError?: string;
}) {
  return (
    <Layout title={`Enroll — ${workshop.name}`}>
      <div class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm md:p-8">
        <WorkshopHeader {...workshop} />

        <p class="mb-6 text-sm text-muted-foreground">
          {workshop.seatsRemaining === 1
            ? "1 seat left."
            : `${workshop.seatsRemaining} seats left.`}
        </p>

        {formError && (
          <p
            role="alert"
            class="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <form method="post" novalidate>
          <div class="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div class={field.name === "email" ? "sm:col-span-2" : ""}>
                <label for={field.name} class="text-sm font-medium">
                  {field.label}
                  {!field.required && <span class="text-muted-foreground"> (optional)</span>}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  required={field.required}
                  autocomplete={field.autocomplete}
                  value={values[field.name] ?? ""}
                  aria-invalid={errors[field.name] ? "true" : undefined}
                  aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
                  class={INPUT_CLASS}
                />
                {errors[field.name] && (
                  <p id={`${field.name}-error`} class="mt-1 text-xs text-destructive">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Honeypot: hidden from people, tempting to bots. */}
          <div aria-hidden="true" class="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label for="website">Leave this field empty</label>
            <input id="website" name="website" type="text" tabindex={-1} autocomplete="off" />
          </div>

          <div class="mt-6 rounded-md border bg-muted/40 p-4">
            <label class="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="consent"
                required
                value="yes"
                checked={values.consent === "yes"}
                aria-invalid={errors.consent ? "true" : undefined}
                class="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              />
              <span>
                I agree that my details may be stored so the organiser can contact me about this
                workshop.
              </span>
            </label>
            {errors.consent && <p class="mt-2 text-xs text-destructive">{errors.consent}</p>}
            <p class="mt-3 text-xs text-muted-foreground">
              Your details are used only to manage your place at this workshop. They are kept until
              the workshop has taken place and are not shared with anyone else. To have them removed
              sooner, reply to the organiser.
            </p>
          </div>

          <button
            type="submit"
            class="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
          >
            Enroll
          </button>
        </form>
      </div>
    </Layout>
  );
}
