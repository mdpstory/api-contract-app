import { sql } from "drizzle-orm"
import {
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core"

const nowDefault = sql`to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at")
    .notNull()
    .default(nowDefault),
})

// ─── Magic Links ──────────────────────────────────────────────────────────────

export const magicLinks = pgTable("magic_links", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
})

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(nowDefault),
})

// ─── Project Members ──────────────────────────────────────────────────────────

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    joinedAt: text("joined_at")
      .notNull()
      .default(nowDefault),
  },
  (t) => [uniqueIndex("project_members_unique").on(t.projectId, t.userId)]
)

// ─── Contract Groups ──────────────────────────────────────────────────────────

export const contractGroups = pgTable(
  "contract_groups",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(nowDefault),
  },
  (t) => [uniqueIndex("contract_groups_project_name_unique").on(t.projectId, t.name)]
)

// ─── Contracts ────────────────────────────────────────────────────────────────

export const contracts = pgTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => contractGroups.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    method: text("method", {
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }).notNull(),
    path: text("path").notNull(),
    status: text("status", { enum: ["draft", "approved"] })
      .notNull()
      .default("draft"),
    requestBodyFormat: text("request_body_format", {
      enum: ["json", "form-data"],
    }).notNull().default("json"),
    // JSON stored as text
    querySchema: text("query_schema").notNull().default('{"fields":[]}'),
    parametersSchema: text("parameters_schema").notNull().default('{"fields":[]}'),
    headersSchema: text("headers_schema").notNull().default('{"fields":[]}'),
    authSchema: text("auth_schema").notNull().default('{"fields":[]}'),
    requestSchema: text("request_schema").notNull().default('{"fields":[]}'),
    responseSchema: text("response_schema").notNull().default('{"fields":[]}'),
    createdAt: text("created_at")
      .notNull()
      .default(nowDefault),
    updatedAt: text("updated_at")
      .notNull()
      .default(nowDefault),
  },
  (t) => [uniqueIndex("contracts_project_method_path_unique").on(t.projectId, t.method, t.path)]
)

// ─── Contract Versions ────────────────────────────────────────────────────────

export const contractVersions = pgTable(
  "contract_versions",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => users.id),
    changedAt: text("changed_at")
      .notNull()
      .default(nowDefault),
    changeSummary: text("change_summary").notNull(),
    // Full contract state at this version
    snapshot: text("snapshot").notNull(),
    // Field-by-field diff from previous version (null for v1)
    diff: text("diff"),
  },
  (t) => [uniqueIndex("contract_versions_contract_version_unique").on(t.contractId, t.version)]
)

// ─── Environments ─────────────────────────────────────────────────────────────

export const environments = pgTable(
  "environments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isGlobal: boolean("is_global").notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(nowDefault),
  },
  (t) => [uniqueIndex("environments_project_name_unique").on(t.projectId, t.name)]
)

// ─── Environment Variables ────────────────────────────────────────────────────

export const envVariables = pgTable(
  "env_variables",
  {
    id: text("id").primaryKey(),
    environmentId: text("environment_id")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("env_variables_environment_key_unique").on(t.environmentId, t.key)]
)

// ─── Validation Runs ──────────────────────────────────────────────────────────

export const validationRuns = pgTable("validation_runs", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  environmentId: text("environment_id").references(() => environments.id, {
    onDelete: "set null",
  }),
  url: text("url").notNull(),
  requestHeaders: text("request_headers").notNull().default("{}"),
  requestBody: text("request_body"),
  result: text("result", { enum: ["passed", "failed"] }).notNull(),
  details: text("details").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(nowDefault),
})

// ─── Type exports ─────────────────────────────────────────────────────────────

export type UserRow = typeof users.$inferSelect
export type MagicLinkRow = typeof magicLinks.$inferSelect
export type ProjectRow = typeof projects.$inferSelect
export type ProjectMemberRow = typeof projectMembers.$inferSelect
export type ContractGroupRow = typeof contractGroups.$inferSelect
export type ContractRow = typeof contracts.$inferSelect
export type ContractVersionRow = typeof contractVersions.$inferSelect
export type EnvironmentRow = typeof environments.$inferSelect
export type EnvVariableRow = typeof envVariables.$inferSelect
export type ValidationRunRow = typeof validationRuns.$inferSelect
