import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { db } from "./index"
import { mkdirSync } from "fs"

// Ensure data directory exists
mkdirSync("data", { recursive: true })

console.log("Running migrations...")
migrate(db, { migrationsFolder: "./src/db/migrations" })
console.log("Migrations complete.")
