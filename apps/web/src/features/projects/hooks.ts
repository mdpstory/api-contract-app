import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getMembers,
  inviteMember,
  removeMember,
} from "./api"
import type { CreateProjectInput, Project, UpdateProjectInput } from "@repo/types"

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  members: (id: string) => ["projects", id, "members"] as const,
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: getProjects,
    staleTime: 1000 * 30,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => getProject(id),
    staleTime: 1000 * 30,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectInput) => createProject(data),
    onMutate: async (data) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: projectKeys.all })
      const prev = queryClient.getQueryData<Project[]>(projectKeys.all)
      const optimistic: Project = {
        id: `optimistic-${Date.now()}`,
        name: data.name,
        description: data.description ?? null,
        ownerId: "",
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData<Project[]>(projectKeys.all, (old) => [
        ...(old ?? []),
        optimistic,
      ])
      return { prev }
    },
    onError: (_err, _data, ctx) => {
      queryClient.setQueryData(projectKeys.all, ctx?.prev)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProjectInput) => updateProject(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(projectKeys.detail(id), updated)
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, confirmName }: { id: string; confirmName: string }) =>
      deleteProject(id, confirmName),
    onSuccess: (_data, { id }) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) })
      queryClient.removeQueries({ queryKey: projectKeys.members(id) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: () => getMembers(projectId),
  })
}

export function useInviteMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => inviteMember(projectId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      })
    },
  })
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeMember(projectId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.members(projectId),
      })
    },
  })
}
