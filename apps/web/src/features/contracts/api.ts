import { apiFetch } from "@/lib/fetch"
import type {
  Contract,
  ContractGroup,
  ContractVersion,
  CreateContractGroupInput,
  CreateContractInput,
  DeleteContractGroupInput,
  DeleteContractGroupResult,
  UpdateContractGroupInput,
  UpdateContractInput,
} from "@repo/types"

const BASE = "/api"

export async function getContracts(projectId: string): Promise<Contract[]> {
  return apiFetch<Contract[]>(`${BASE}/projects/${projectId}/contracts`)
}

export async function getContract(
  projectId: string,
  contractId: string
): Promise<Contract> {
  return apiFetch<Contract>(
    `${BASE}/projects/${projectId}/contracts/${contractId}`
  )
}

export async function createContract(
  projectId: string,
  data: CreateContractInput
): Promise<Contract> {
  return apiFetch<Contract>(`${BASE}/projects/${projectId}/contracts`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateContract(
  projectId: string,
  contractId: string,
  data: UpdateContractInput
): Promise<Contract> {
  return apiFetch<Contract>(
    `${BASE}/projects/${projectId}/contracts/${contractId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  )
}

export async function updateContractStatus(
  projectId: string,
  contractId: string,
  status: "draft" | "approved"
): Promise<void> {
  await apiFetch(
    `${BASE}/projects/${projectId}/contracts/${contractId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  )
}

export async function deleteContract(
  projectId: string,
  contractId: string
): Promise<void> {
  await apiFetch(
    `${BASE}/projects/${projectId}/contracts/${contractId}`,
    { method: "DELETE" }
  )
}

export async function getContractVersions(
  projectId: string,
  contractId: string
): Promise<ContractVersion[]> {
  return apiFetch<ContractVersion[]>(
    `${BASE}/projects/${projectId}/contracts/${contractId}/versions`
  )
}

export async function getContractGroups(
  projectId: string
): Promise<ContractGroup[]> {
  return apiFetch<ContractGroup[]>(
    `${BASE}/projects/${projectId}/contract-groups`
  )
}

export async function createContractGroup(
  projectId: string,
  data: CreateContractGroupInput
): Promise<ContractGroup> {
  return apiFetch<ContractGroup>(
    `${BASE}/projects/${projectId}/contract-groups`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  )
}

export async function updateContractGroup(
  projectId: string,
  groupId: string,
  data: UpdateContractGroupInput
): Promise<ContractGroup> {
  return apiFetch<ContractGroup>(
    `${BASE}/projects/${projectId}/contract-groups/${groupId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  )
}

export async function deleteContractGroup(
  projectId: string,
  groupId: string,
  data: DeleteContractGroupInput
): Promise<DeleteContractGroupResult> {
  return apiFetch<DeleteContractGroupResult>(
    `${BASE}/projects/${projectId}/contract-groups/${groupId}`,
    {
      method: "DELETE",
      body: JSON.stringify(data),
    }
  )
}
