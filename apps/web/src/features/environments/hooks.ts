import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from "./api"
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from "@repo/types"

export const envKeys = {
  all: (projectId: string) => ["environments", projectId] as const,
}

export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: envKeys.all(projectId),
    queryFn: () => getEnvironments(projectId),
    staleTime: 1000 * 30,
  })
}

export function useCreateEnvironment(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEnvironmentInput) =>
      createEnvironment(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: envKeys.all(projectId) })
    },
  })
}

export function useUpdateEnvironment(projectId: string, envId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEnvironmentInput) =>
      updateEnvironment(projectId, envId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: envKeys.all(projectId) })
    },
  })
}

export function useDeleteEnvironment(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (envId: string) => deleteEnvironment(projectId, envId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: envKeys.all(projectId) })
    },
  })
}
