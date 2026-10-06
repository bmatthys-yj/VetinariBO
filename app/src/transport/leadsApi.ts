import type { LeadDetail, LeadSummary } from "../domain/contracts";
import { API_BASE_PATH, deleteJson, getJson, postJson } from "./http";

export async function fetchLeads(): Promise<LeadSummary[]> {
  const body = await getJson<{ leads: LeadSummary[] }>(`${API_BASE_PATH}/leads`);
  return body.leads;
}

export async function fetchLead(leadId: string): Promise<LeadDetail> {
  const body = await getJson<{ lead: LeadDetail }>(`${API_BASE_PATH}/leads/${leadId}`);
  return body.lead;
}

export async function researchLead(leadId: string): Promise<LeadDetail> {
  const body = await postJson<{ lead: LeadDetail }>(
    `${API_BASE_PATH}/leads/${leadId}/research`,
    {},
  );
  return body.lead;
}

export async function deleteLead(leadId: string): Promise<void> {
  await deleteJson(`${API_BASE_PATH}/leads/${leadId}`);
}
