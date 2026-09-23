import type { QueryClient } from "@tanstack/react-query";
import type { RouterHistory } from "@tanstack/react-router";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { AppShell } from "../app/AppShell";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { WorkshopsPage } from "../features/workshops/WorkshopsPage";
import { WorkshopDetailPage } from "../features/workshops/WorkshopDetailPage";

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

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  workshopsRoute.addChildren([workshopsIndexRoute, workshopDetailRoute]),
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
