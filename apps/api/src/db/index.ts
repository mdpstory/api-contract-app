import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { loadRootEnv } from "../lib/load-env"
import * as schema from "./schema"

loadRootEnv()

const databaseUrl = process.env["DATABASE_URL"]

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

const client = postgres(databaseUrl, {
  prepare: false,
})

export const db = drizzle(client, { schema })
export { client }

export type DB = typeof db
