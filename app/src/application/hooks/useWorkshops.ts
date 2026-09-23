import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workshop, WorkshopInput } from "../../domain/contracts";
import { createWorkshop, fetchWorkshop, fetchWorkshops } from "../../transport/workshopsApi";
import { queryKeys } from "../queryKeys";

/** Read the workshop register. */
export function useWorkshops() {
  const query = useQuery({ queryKey: queryKeys.workshops, queryFn: fetchWorkshops });
  return { workshops: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

/** Read one workshop, including its hosted form link and seat counts. */
export function useWorkshop(workshopId: string) {
  const query = useQuery({
    queryKey: queryKeys.workshop(workshopId),
    queryFn: () => fetchWorkshop(workshopId),
  });
  return { workshop: query.data ?? null, isLoading: query.isLoading, error: query.error };
}

/** Add a workshop and refresh the register on success. */
export function useCreateWorkshop() {
  const queryClient = useQueryClient();
  return useMutation<Workshop, Error, WorkshopInput>({
    mutationFn: createWorkshop,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workshops }),
  });
}
