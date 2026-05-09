import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CredentialType, RequirementLevel } from "@shared/schema";

export type JobRequirementWithCredential = {
  id: number;
  job_id: number;
  credential_type_id: number;
  requirement_level: RequirementLevel;
  notes: string | null;
  created_at: string;
  credential_type: CredentialType;
};

const requirementsKey = (jobId: number) => ["/api/jobs", jobId, "requirements"] as const;

export function useJobRequirements(jobId: number | null) {
  return useQuery<JobRequirementWithCredential[]>({
    queryKey: jobId ? requirementsKey(jobId) : ["/api/jobs", "none", "requirements"],
    queryFn: async () => {
      if (!jobId) return [];
      const res = await fetch(`/api/jobs/${jobId}/requirements`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requirements");
      return res.json();
    },
    enabled: !!jobId,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, jobId: number) {
  queryClient.invalidateQueries({ queryKey: requirementsKey(jobId) });
  queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
}

export function useAddRequirement(jobId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { credential_type_id: number; requirement_level: RequirementLevel; notes?: string | null }) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/requirements`, input);
      return res.json();
    },
    onSuccess: () => invalidate(queryClient, jobId),
  });
}

export function useUpdateRequirement(jobId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; requirement_level?: RequirementLevel; notes?: string | null }) => {
      const { id, ...body } = input;
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/requirements/${id}`, body);
      return res.json();
    },
    onSuccess: () => invalidate(queryClient, jobId),
  });
}

export function useRemoveRequirement(jobId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/jobs/${jobId}/requirements/${id}`);
    },
    onSuccess: () => invalidate(queryClient, jobId),
  });
}
