import { defineConfig } from "drizzle-kit"
import { loadRootEnv } from "./src/lib/load-env"

loadRootEnv()

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
})
