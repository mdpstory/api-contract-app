export interface User {
  id: string
  email: string
  name: string | null
  createdAt: string
}

export interface Session {
  id: string
  userId: string
  expiresAt: string
}

export interface SendMagicLinkInput {
  email: string
}

export interface AuthResponse {
  user: User
  session: Session
}
