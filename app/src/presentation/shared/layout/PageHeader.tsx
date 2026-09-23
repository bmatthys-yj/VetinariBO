import type { ComponentType, ReactNode } from "react";

export interface PageHeaderProps {
  icon: ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ actions, description, eyebrow, icon: Icon, title }: PageHeaderProps) {
  return (
    <section className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          {eyebrow && (
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 font-serif text-3xl leading-none tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions}
    </section>
  );
}
