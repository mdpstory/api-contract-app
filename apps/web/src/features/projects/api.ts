import { apiFetch } from "@/lib/fetch"
import type {
  Project,
  ProjectMember,
  CreateProjectInput,
  UpdateProjectInput,
} from "@repo/types"

const BASE = "/api"

export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>(`${BASE}/projects`)
}

export async function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`${BASE}/projects/${id}`)
}

export async function createProject(data: CreateProjectInput): Promise<Project> {
  return apiFetch<Project>(`${BASE}/projects`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<Project> {
  return apiFetch<Project>(`${BASE}/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteProject(
  id: string,
  confirmName: string
): Promise<void> {
  await apiFetch(`${BASE}/projects/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmName }),
  })
}

export async function getMembers(projectId: string): Promise<ProjectMember[]> {
  return apiFetch<ProjectMember[]>(`${BASE}/projects/${projectId}/members`)
}

export async function inviteMember(
  projectId: string,
  email: string
): Promise<void> {
  await apiFetch(`${BASE}/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function removeMember(
  projectId: string,
  userId: string
): Promise<void> {
  await apiFetch(`${BASE}/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
  })
}
