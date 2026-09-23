import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import type { WorkshopInput } from "../../../domain/contracts";
import { useCreateWorkshop } from "../../../application/hooks/useWorkshops";
import { ApiError } from "../../../transport/http";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { CardHeader } from "../../shared/layout/CardHeader";
import { Input } from "../../shared/ui/Input";
import { Label } from "../../shared/ui/Label";
import { PublicFormLink } from "./PublicFormLink";

const EMPTY_FORM = {
  name: "",
  date: "",
  maxApplicants: "",
  subject: "",
  url: "",
  locationName: "",
  locationAddress: "",
};

type FormState = typeof EMPTY_FORM;

const FIELDS: Array<{
  key: keyof FormState;
  label: string;
  type: string;
  placeholder?: string;
  wide?: boolean;
  optional?: boolean;
}> = [
  { key: "name", label: "Name", type: "text", placeholder: "Agentic AI Kickstart" },
  { key: "date", label: "Date", type: "date" },
  { key: "maxApplicants", label: "Max applicants", type: "number" },
  { key: "subject", label: "Subject", type: "text", placeholder: "Building agents with Vetinari" },
  {
    // The enrollment form is hosted from the workshop's slug, so this is only
    // for an external marketing or landing page.
    key: "url",
    label: "External page URL",
    type: "url",
    placeholder: "https://example.com/workshops/kickstart",
    wide: true,
    optional: true,
  },
  { key: "locationName", label: "Location name", type: "text", placeholder: "De Hoorn" },
  {
    key: "locationAddress",
    label: "Location address",
    type: "text",
    placeholder: "Sluisstraat 79, 3000 Leuven",
  },
];

/** Form that writes a new workshop into the local database. */
export function WorkshopForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const createWorkshop = useCreateWorkshop();

  const issues = createWorkshop.error instanceof ApiError ? createWorkshop.error.issues : [];
  const issueFor = (key: keyof FormState) =>
    issues.find((issue) => issue.path === key)?.message ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: WorkshopInput = {
      name: form.name,
      date: form.date,
      maxApplicants: Number(form.maxApplicants),
      subject: form.subject,
      url: form.url,
      locationName: form.locationName,
      locationAddress: form.locationAddress,
    };
    createWorkshop.mutate(input, { onSuccess: () => setForm(EMPTY_FORM) });
  }

  return (
    <Card>
      <CardHeader
        title="Add a workshop"
        description="Stored in the local database and listed on the dashboard."
      />
      <form className="space-y-4 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, optional, placeholder, type, wide }) => {
            const issue = issueFor(key);
            return (
              <div key={key} className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`workshop-${key}`}>
                  {label}
                  {optional && <span className="text-muted-foreground"> (optional)</span>}
                </Label>
                <Input
                  id={`workshop-${key}`}
                  type={type}
                  required={!optional}
                  min={type === "number" ? 1 : undefined}
                  placeholder={placeholder}
                  value={form[key]}
                  aria-invalid={issue ? true : undefined}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
                {issue && <p className="text-xs text-destructive">{issue}</p>}
              </div>
            );
          })}
        </div>
        {createWorkshop.error && issues.length === 0 && (
          <p className="text-sm text-destructive">{createWorkshop.error.message}</p>
        )}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            className="h-9 gap-2 px-4"
            disabled={createWorkshop.isPending}
          >
            {createWorkshop.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            <span>Add workshop</span>
          </Button>
        </div>
        {createWorkshop.isSuccess && createWorkshop.data && !createWorkshop.isPending && (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium">
              Workshop added. Its enrollment form is already live.
            </p>
            <PublicFormLink url={createWorkshop.data.publicUrl} />
          </div>
        )}
      </form>
    </Card>
  );
}
