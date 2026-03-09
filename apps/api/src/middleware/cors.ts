import { cors } from "hono/cors"

const ALLOWED_ORIGIN = process.env["WEB_URL"] ?? "http://localhost:5173"

/**
 * CORS middleware — allows requests from the frontend dev server
 * and production URL. Credentials enabled for cookie-based auth.
 */
export const corsMiddleware = cors({
  origin: ALLOWED_ORIGIN,
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
})
