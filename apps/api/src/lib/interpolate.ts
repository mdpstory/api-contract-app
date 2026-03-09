/**
 * Replace {{variable}} placeholders in a string
 * using the provided variables map.
 *
 * Example:
 *   interpolate("{{BASE_URL}}/api", { BASE_URL: "http://localhost:3000" })
 *   → "http://localhost:3000/api"
 */
export function interpolate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match
  })
}

/**
 * Recursively interpolate all string values in an object.
 */
export function interpolateObject(
  obj: unknown,
  variables: Record<string, string>
): unknown {
  if (typeof obj === "string") {
    return interpolate(obj, variables)
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, variables))
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, variables)
    }
    return result
  }
  return obj
}
