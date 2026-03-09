import { hc } from "hono/client"
import type { AppType } from "../../../api/src/main"

/**
 * Type-safe Hono RPC client.
 * All API calls go through this — no manual fetch needed.
 */
export const api = hc<AppType>("/", {
  headers: {
    "Content-Type": "application/json",
  },
  init: {
    credentials: "include",
  },
})
