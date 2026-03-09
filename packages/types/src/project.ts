export interface Project {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
}

export interface ProjectMember {
  projectId: string
  userId: string
  role: "owner" | "member"
  joinedAt: string
  user: {
    id: string
    email: string
    name: string | null
  }
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
}

export interface InviteMemberInput {
  email: string
}
