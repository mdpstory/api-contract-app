import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import * as schema from "./schema"

const sqlite = new Database(process.env["DATABASE_PATH"] ?? "data/app.db")

// Enable WAL mode for better concurrent read performance
sqlite.exec("PRAGMA journal_mode = WAL;")
sqlite.exec("PRAGMA foreign_keys = ON;")

export const db = drizzle(sqlite, { schema })
export { sqlite }

export type DB = typeof db
