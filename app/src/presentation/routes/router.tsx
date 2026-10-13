import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "../app/AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { WorkshopsPage } from "../features/workshops/WorkshopsPage";
import { WorkshopDetailPage } from "../features/workshops/WorkshopDetailPage";
import { LeadsPage } from "../features/leads/LeadsPage";
import { LeadDetailPage } from "../features/leads/LeadDetailPage";

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const workshopsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workshops",
});

const workshopsIndexRoute = createRoute({
  getParentRoute: () => workshopsRoute,
  path: "/",
  component: WorkshopsPage,
});

/** Workshop detail: enrollments and the hosted form link. */
const workshopDetailRoute = createRoute({
  getParentRoute: () => workshopsRoute,
  path: "$workshopId",
  component: WorkshopDetailPage,
});

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leads",
});

const leadsIndexRoute = createRoute({
  getParentRoute: () => leadsRoute,
  path: "/",
  component: LeadsPage,
});

/** Lead detail: contact details, the company lookup, and workshops enrolled for. */
const leadDetailRoute = createRoute({
  getParentRoute: () => leadsRoute,
  path: "$leadId",
  component: LeadDetailPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  workshopsRoute.addChildren([workshopsIndexRoute, workshopDetailRoute]),
  leadsRoute.addChildren([leadsIndexRoute, leadDetailRoute]),
]);

export function createAppRouter(context: RouterContext, history?: RouterHistory) {
  return createRouter({ routeTree, context, history });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
