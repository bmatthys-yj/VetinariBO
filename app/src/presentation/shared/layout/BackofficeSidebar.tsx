import { CalendarDays, LayoutDashboard } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ThemeSelector } from "../theme/ThemeSelector";

const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workshops", label: "Workshops", icon: CalendarDays },
] as const;

export function BackofficeSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <aside
      aria-label="Backoffice sidebar"
      className="relative z-20 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-20 items-center gap-3 px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary font-serif text-lg text-sidebar-primary-foreground">
          V
        </span>
        <span className="font-serif text-2xl tracking-tight">VetinariBO</span>
      </div>
      <nav aria-label="Backoffice navigation" className="space-y-1 px-3 py-4">
        {navigation.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon
                className={`size-5 ${active ? "text-sidebar-primary" : ""}`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center justify-between border-t border-sidebar-border px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
          <p>Vetinari</p>
          <p className="mt-1 normal-case tracking-normal">Backoffice v0.1.0</p>
        </div>
        <ThemeSelector className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
      </div>
    </aside>
  );
}
