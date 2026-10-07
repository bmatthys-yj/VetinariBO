import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeadDetail } from "../../domain/contracts";
import { isResearchInProgress } from "../../domain/lead";
import { deleteLead, fetchLead, fetchLeads, researchLead } from "../../transport/leadsApi";
import { queryKeys } from "../queryKeys";

/** While a company lookup runs in the background, check back this often. */
const RESEARCH_POLL_MS = 3_000;

/** Read every lead. Polls while any company lookup is still going. */
export function useLeads() {
  const query = useQuery({
    queryKey: queryKeys.leads,
    queryFn: fetchLeads,
    refetchInterval: (query) =>
      query.state.data?.some((lead) => isResearchInProgress(lead.companyResearchStatus))
        ? RESEARCH_POLL_MS
        : false,
  });
  return { leads: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

/** Read one lead with its workshops. Polls until its company lookup finishes. */
export function useLead(leadId: string) {
  const query = useQuery({
    queryKey: queryKeys.lead(leadId),
    queryFn: () => fetchLead(leadId),
    refetchInterval: (query) =>
      query.state.data && isResearchInProgress(query.state.data.companyResearchStatus)
        ? RESEARCH_POLL_MS
        : false,
  });
  return { lead: query.data ?? null, isLoading: query.isLoading, error: query.error };
}

/** Look a lead's company up again with the company research workflow. */
export function useResearchLead(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation<LeadDetail, Error, void>({
    mutationFn: () => researchLead(leadId),
    onSuccess: async (lead) => {
      queryClient.setQueryData(queryKeys.lead(leadId), lead);
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads, exact: true });
    },
  });
}

/** Erase a lead and its enrollments, to service an erasure request. */
export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteLead,
    onSuccess: async (_result, leadId) => {
      queryClient.removeQueries({ queryKey: queryKeys.lead(leadId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leads });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workshops });
    },
  });
}
