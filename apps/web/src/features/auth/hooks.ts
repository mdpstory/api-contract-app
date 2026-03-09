import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getMe, logout, sendMagicLink, verifyToken } from "./api"

import type { QueryClient } from "@tanstack/react-query"
import type { User } from "@repo/types"

export const authKeys = {
  me: ["auth", "me"] as const,
}

export const meQueryOptions = {
  queryKey: authKeys.me,
  queryFn: getMe,
  staleTime: 1000 * 60 * 5,
  retry: false,
}

/** Use inside beforeLoad — always re-check auth so dev bypass/session state stays fresh */
export async function getOrFetchMe(queryClient: QueryClient): Promise<User | null> {
  return queryClient.fetchQuery({
    ...meQueryOptions,
    staleTime: 0,
  })
}

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  })
}

export function useSendMagicLink() {
  return useMutation({
    mutationFn: (email: string) => sendMagicLink(email),
  })
}

export function useVerifyToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => verifyToken(token),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authKeys.me, null)
      queryClient.clear()
    },
  })
}
