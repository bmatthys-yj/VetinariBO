import type { Enrollment, Workshop, WorkshopInput } from "../domain/contracts";
import { API_BASE_PATH, deleteJson, getJson, postJson } from "./http";

export async function fetchWorkshops(): Promise<Workshop[]> {
  const body = await getJson<{ workshops: Workshop[] }>(`${API_BASE_PATH}/workshops`);
  return body.workshops;
}

export async function fetchWorkshop(workshopId: string): Promise<Workshop> {
  const body = await getJson<{ workshop: Workshop }>(`${API_BASE_PATH}/workshops/${workshopId}`);
  return body.workshop;
}

export async function createWorkshop(input: WorkshopInput): Promise<Workshop> {
  const body = await postJson<{ workshop: Workshop }>(`${API_BASE_PATH}/workshops`, input);
  return body.workshop;
}

export async function fetchEnrollments(workshopId: string): Promise<Enrollment[]> {
  const body = await getJson<{ enrollments: Enrollment[] }>(
    `${API_BASE_PATH}/workshops/${workshopId}/enrollments`,
  );
  return body.enrollments;
}

export function enrollmentsCsvUrl(workshopId: string): string {
  return `${API_BASE_PATH}/workshops/${workshopId}/enrollments.csv`;
}

export async function deleteEnrollment(workshopId: string, enrollmentId: string): Promise<void> {
  await deleteJson(`${API_BASE_PATH}/workshops/${workshopId}/enrollments/${enrollmentId}`);
}
