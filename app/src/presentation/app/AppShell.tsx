import { Outlet } from "@tanstack/react-router";
import { BackofficeSidebar } from "../shared/layout/BackofficeSidebar";

export function AppShell() {
  return (
    <div className="flex h-full bg-background text-foreground">
      <BackofficeSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
