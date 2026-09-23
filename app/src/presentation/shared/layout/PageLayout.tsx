import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn("relative z-10 h-full min-w-0 flex-1 overflow-y-auto bg-muted/30", className)}
    >
      <div className="backoffice-content space-y-6 p-5 md:p-7">{children}</div>
    </main>
  );
}
