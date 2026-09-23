import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteEnrollment, fetchEnrollments } from "../../transport/workshopsApi";
import { queryKeys } from "../queryKeys";

/** Read who signed up for a workshop. */
export function useEnrollments(workshopId: string) {
  const query = useQuery({
    queryKey: queryKeys.enrollments(workshopId),
    queryFn: () => fetchEnrollments(workshopId),
  });
  return { enrollments: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

/** Remove one enrollment, used to service an erasure request. */
export function useDeleteEnrollment(workshopId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (enrollmentId) => deleteEnrollment(workshopId, enrollmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.enrollments(workshopId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workshop(workshopId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workshops });
    },
  });
}
