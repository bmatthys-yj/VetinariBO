import type { Workshop, WorkshopInput } from "../domain/contracts";
import { API_BASE_PATH, getJson, postJson } from "./http";

export async function fetchWorkshops(): Promise<Workshop[]> {
  const body = await getJson<{ workshops: Workshop[] }>(`${API_BASE_PATH}/workshops`);
  return body.workshops;
}

export async function createWorkshop(input: WorkshopInput): Promise<Workshop> {
  const body = await postJson<{ workshop: Workshop }>(`${API_BASE_PATH}/workshops`, input);
  return body.workshop;
}
