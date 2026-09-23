import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { Button, buttonVariants } from "../../shared/ui/Button";

/**
 * The address of a workshop's hosted enrollment form, ready to open or share.
 *
 * The form is live as soon as the workshop exists, so this link never needs a
 * publish step behind it.
 */
export function PublicFormLink({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link stays selectable either way.
    }
  }

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="Open enrollment form"
        aria-label="Open enrollment form"
        className={buttonVariants({ variant: "outline", className: "h-8 shrink-0 gap-1.5 px-3" })}
      >
        <span>Form</span>
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Enrollment form</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-sm text-foreground underline-offset-4 hover:underline"
        >
          {url}
        </a>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" className="h-9 gap-2 px-3" onClick={copy}>
          {copied ? (
            <Check className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          <span>{copied ? "Copied" : "Copy link"}</span>
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "primary", className: "h-9 gap-2 px-3" })}
        >
          <span>Open form</span>
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
