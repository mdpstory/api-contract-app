import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getContracts,
  getContract,
  getContractGroups,
  createContract,
  createContractGroup,
  updateContractGroup,
  updateContract,
  updateContractStatus,
  deleteContractGroup,
  deleteContract,
  getContractVersions,
} from "./api"
import type {
  Contract,
  CreateContractGroupInput,
  CreateContractInput,
  DeleteContractGroupResult,
  UpdateContractGroupInput,
  UpdateContractInput,
} from "@repo/types"

export const contractKeys = {
  all: (projectId: string) => ["contracts", projectId] as const,
  detail: (projectId: string, contractId: string) =>
    ["contracts", projectId, contractId] as const,
  versions: (projectId: string, contractId: string) =>
    ["contracts", projectId, contractId, "versions"] as const,
  groups: (projectId: string) => ["contracts", projectId, "groups"] as const,
}

export function useContracts(projectId: string) {
  return useQuery({
    queryKey: contractKeys.all(projectId),
    queryFn: () => getContracts(projectId),
    staleTime: 1000 * 30,
  })
}

export function useContract(projectId: string, contractId: string) {
  return useQuery({
    queryKey: contractKeys.detail(projectId, contractId),
    queryFn: () => getContract(projectId, contractId),
    staleTime: 1000 * 30,
  })
}

export function useContractGroups(projectId: string) {
  return useQuery({
    queryKey: contractKeys.groups(projectId),
    queryFn: () => getContractGroups(projectId),
    staleTime: 1000 * 30,
  })
}

export function useCreateContract(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateContractInput) => createContract(projectId, data),
    onSuccess: (created) => {
      // Optimistic insert into list
      queryClient.setQueryData<Contract[]>(
        contractKeys.all(projectId),
        (old) => [...(old ?? []), created]
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) })
    },
  })
}

export function useUpdateContract(projectId: string, contractId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateContractInput) =>
      updateContract(projectId, contractId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        contractKeys.detail(projectId, contractId),
        updated
      )
      queryClient.setQueryData<Contract[]>(
        contractKeys.all(projectId),
        (old) => old?.map((contract) =>
          contract.id === updated.id ? updated : contract
        ) ?? old
      )
      void queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) })
      // Invalidate versions as new version was created on save
      void queryClient.invalidateQueries({
        queryKey: contractKeys.versions(projectId, contractId),
      })
    },
  })
}

export function useUpdateContractStatus(projectId: string, contractId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: "draft" | "approved") =>
      updateContractStatus(projectId, contractId, status),
    onSuccess: (_data, status) => {
      queryClient.setQueryData<Contract>(
        contractKeys.detail(projectId, contractId),
        (old) => (old ? { ...old, status } : old)
      )
      queryClient.setQueryData<Contract[]>(
        contractKeys.all(projectId),
        (old) => old?.map((contract) =>
          contract.id === contractId ? { ...contract, status } : contract
        ) ?? old
      )
      void queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) })
    },
  })
}

export function useDeleteContract(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contractId: string) => deleteContract(projectId, contractId),
    onSuccess: (_data, contractId) => {
      queryClient.removeQueries({
        queryKey: contractKeys.detail(projectId, contractId),
      })
      void queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) })
    },
  })
}

export function useMoveContractGroup(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      contractId,
      groupId,
    }: {
      contractId: string
      groupId: string | null
    }) => updateContract(projectId, contractId, { groupId }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        contractKeys.detail(projectId, updated.id),
        updated
      )
      void queryClient.invalidateQueries({ queryKey: contractKeys.all(projectId) })
      void queryClient.invalidateQueries({
        queryKey: contractKeys.groups(projectId),
      })
    },
  })
}

export function useUpdateContractGroup(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string
      data: UpdateContractGroupInput
    }) => updateContractGroup(projectId, groupId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.groups(projectId),
      })
    },
  })
}

export function useCreateContractGroup(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateContractGroupInput) =>
      createContractGroup(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.groups(projectId),
      })
    },
  })
}

export function useDeleteContractGroup(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      groupId,
      confirmName,
    }: {
      groupId: string
      confirmName: string
    }) => deleteContractGroup(projectId, groupId, { confirmName }),
    onSuccess: (_data: DeleteContractGroupResult) => {
      void queryClient.invalidateQueries({
        queryKey: contractKeys.groups(projectId),
      })
      void queryClient.invalidateQueries({
        queryKey: contractKeys.all(projectId),
      })
    },
  })
}

export function useContractVersions(projectId: string, contractId: string) {
  return useQuery({
    queryKey: contractKeys.versions(projectId, contractId),
    queryFn: () => getContractVersions(projectId, contractId),
    staleTime: 1000 * 30,
  })
}
