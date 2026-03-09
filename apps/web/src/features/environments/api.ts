import { apiFetch } from "@/lib/fetch"
import type {
  Environment,
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
} from "@repo/types"

const BASE = "/api"

export async function getEnvironments(
  projectId: string
): Promise<Environment[]> {
  return apiFetch<Environment[]>(
    `${BASE}/projects/${projectId}/environments`
  )
}

export async function createEnvironment(
  projectId: string,
  data: CreateEnvironmentInput
): Promise<Environment> {
  return apiFetch<Environment>(`${BASE}/projects/${projectId}/environments`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateEnvironment(
  projectId: string,
  envId: string,
  data: UpdateEnvironmentInput
): Promise<Environment> {
  return apiFetch<Environment>(
    `${BASE}/projects/${projectId}/environments/${envId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  )
}

export async function deleteEnvironment(
  projectId: string,
  envId: string
): Promise<void> {
  await apiFetch(`${BASE}/projects/${projectId}/environments/${envId}`, {
    method: "DELETE",
  })
}
