/** Central queryKey registry for the backoffice. */
export const queryKeys = {
  workshops: ["workshops"] as const,
  workshop: (workshopId: string) => ["workshops", workshopId] as const,
  enrollments: (workshopId: string) => ["workshops", workshopId, "enrollments"] as const,
  agents: ["agents"] as const,
  agent: (agentId: string) => ["agents", agentId] as const,
  gateway: ["gateway"] as const,
};
