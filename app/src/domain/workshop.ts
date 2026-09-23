import type { Workshop } from "./contracts";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Render an ISO calendar date for display, falling back to the raw value. */
export function formatWorkshopDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormatter.format(parsed);
}

/** Start of today, used to split workshops into upcoming and past. */
function startOfToday(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Workshops that have not happened yet, soonest first. */
export function upcomingWorkshops(workshops: Workshop[]): Workshop[] {
  const today = startOfToday();
  return workshops.filter((workshop) => workshop.date >= today);
}

/** Total seats offered across the given workshops. */
export function totalSeats(workshops: Workshop[]): number {
  return workshops.reduce((total, workshop) => total + workshop.maxApplicants, 0);
}

/** The soonest upcoming workshop, or `null` when there is none. */
export function nextWorkshop(workshops: Workshop[]): Workshop | null {
  return upcomingWorkshops(workshops)[0] ?? null;
}

/** Enrollments across the given workshops. */
export function totalEnrollments(workshops: Workshop[]): number {
  return workshops.reduce((total, workshop) => total + workshop.enrollmentCount, 0);
}
