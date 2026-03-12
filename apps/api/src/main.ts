import { Hono } from "hono"
import { logger } from "hono/logger"
import { corsMiddleware } from "./middleware/cors"
import { loadRootEnv } from "./lib/load-env"
import { authRoutes } from "./routes/auth"
import { projectRoutes } from "./routes/projects"
import { contractRoutes } from "./routes/contracts"
import { environmentRoutes } from "./routes/environments"
import { contractGroupRoutes } from "./routes/contract-groups"
import { validationRoutes } from "./routes/validation"
import { exportRoutes } from "./routes/export"
loadRootEnv()

const app = new Hono()

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(logger())
app.use(corsMiddleware)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok" }))

// ─── Routes ───────────────────────────────────────────────────────────────────
const api = app
  .basePath("/api")
  .route("/auth", authRoutes)
  .route("/projects", projectRoutes)
  .route("/", contractGroupRoutes)
  .route("/", contractRoutes)
  .route("/", environmentRoutes)
  .route("/", validationRoutes)
  .route("/", exportRoutes)

// ─── Export app type for Hono RPC ─────────────────────────────────────────────
export type AppType = typeof api

const port = Number(process.env["PORT"] ?? 3030)
console.log(`API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}
