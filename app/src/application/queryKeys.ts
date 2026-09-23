/** Central queryKey registry for the backoffice. */
export const queryKeys = {
  workshops: ["workshops"] as const,
  workshop: (workshopId: string) => ["workshops", workshopId] as const,
  enrollments: (workshopId: string) => ["workshops", workshopId, "enrollments"] as const,
};
