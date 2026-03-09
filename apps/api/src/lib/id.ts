import { randomUUIDv7 } from "bun"

/**
 * Generate a new unique ID using UUIDv7 (time-sortable).
 */
export function generateId(): string {
  return randomUUIDv7()
}
