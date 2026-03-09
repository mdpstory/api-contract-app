export interface EnvVariable {
  id: string
  environmentId: string
  key: string
  value: string
}

export interface Environment {
  id: string
  projectId: string
  name: string
  isGlobal: boolean
  createdAt: string
  variables: EnvVariable[]
}

export interface CreateEnvironmentInput {
  name: string
  variables?: Array<{ key: string; value: string }>
}

export interface UpdateEnvironmentInput {
  name?: string
  variables?: Array<{ key: string; value: string }>
}
