import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ProjectDefaultSettings, ViewerSettingsInput } from "@/lib/viewer-settings";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  mustResetPassword: integer("must_reset_password", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const flipbooks = sqliteTable("flipbooks", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  originalFilename: text("original_filename").notNull(),
  r2Key: text("r2_key").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull().default(0),
  pageCount: integer("page_count").notNull().default(0),
  coverImageR2Key: text("cover_image_r2_key"),
  backgroundImageR2Key: text("background_image_r2_key"),
  backgroundFit: text("background_fit", { enum: ["contain", "cover"] })
    .notNull()
    .default("contain"),
  backgroundPosition: text("background_position").notNull().default("center"),

  // Privacy
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  passwordHash: text("password_hash"),

  // Controls
  allowDownload: integer("allow_download", { mode: "boolean" }).notNull().default(true),
  allowPrint: integer("allow_print", { mode: "boolean" }).notNull().default(true),

  // Branding
  themeColor: text("theme_color").notNull().default("#1e293b"),
  showToolbar: integer("show_toolbar", { mode: "boolean" }).notNull().default(true),
  logoR2Key: text("logo_r2_key"),
  logoLinkUrl: text("logo_link_url"),

  // The preset this flipbook's settings were last copied from, if any — a one-time snapshot,
  // not a live link. Cleared whenever a tracked setting is changed independently.
  presetId: text("preset_id"),

  status: text("status", { enum: ["processing", "ready", "error"] })
    .notNull()
    .default("processing"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const presets = sqliteTable("presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),

  // Privacy
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  passwordHash: text("password_hash"),

  // Controls
  allowDownload: integer("allow_download", { mode: "boolean" }).notNull().default(true),
  allowPrint: integer("allow_print", { mode: "boolean" }).notNull().default(true),

  // Branding
  themeColor: text("theme_color").notNull().default("#0f2044"),
  showToolbar: integer("show_toolbar", { mode: "boolean" }).notNull().default(true),
  backgroundImageR2Key: text("background_image_r2_key"),
  backgroundFit: text("background_fit", { enum: ["contain", "cover"] })
    .notNull()
    .default("contain"),
  backgroundPosition: text("background_position").notNull().default("center"),
  logoR2Key: text("logo_r2_key"),
  logoLinkUrl: text("logo_link_url"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const flipbookViews = sqliteTable("flipbook_views", {
  id: text("id").primaryKey(),
  flipbookId: text("flipbook_id")
    .notNull()
    .references(() => flipbooks.id),
  viewedAt: integer("viewed_at", { mode: "timestamp" }).notNull(),
  referrer: text("referrer").notNull().default(""),
  source: text("source", { enum: ["direct", "embed"] })
    .notNull()
    .default("direct"),

  // Parsed from the User-Agent header, not the raw string — enough for a device/browser
  // breakdown without storing something more fingerprintable than needed. Null on views
  // recorded before this column existed, and whenever the value can't be determined.
  deviceType: text("device_type", { enum: ["mobile", "tablet", "desktop"] }),
  browser: text("browser"),

  // From Vercel's geolocation headers — only populated when actually deployed on Vercel.
  country: text("country"),
  region: text("region"),
});

/** One row per page a visitor actually turned to during a view — lets stats show which pages
 * get the most engagement, where people drop off, and (combined with flipbookViews.viewedAt)
 * roughly how long a session lasted. */
export const flipbookPageEvents = sqliteTable("flipbook_page_events", {
  id: text("id").primaryKey(),
  viewId: text("view_id")
    .notNull()
    .references(() => flipbookViews.id),
  flipbookId: text("flipbook_id")
    .notNull()
    .references(() => flipbooks.id),
  pageNumber: integer("page_number").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
});

/** One row per click on a hyperlink embedded in the PDF itself. */
export const flipbookLinkClicks = sqliteTable("flipbook_link_clicks", {
  id: text("id").primaryKey(),
  viewId: text("view_id")
    .notNull()
    .references(() => flipbookViews.id),
  flipbookId: text("flipbook_id")
    .notNull()
    .references(() => flipbooks.id),
  pageNumber: integer("page_number").notNull(),
  url: text("url").notNull(),
  clickedAt: integer("clicked_at", { mode: "timestamp" }).notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  bucketKey: text("bucket_key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
});

/** An external app (one of your other projects) allowed to use the flipbook engine. */
export const apiProjects = sqliteTable("api_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Origins (e.g. "https://example.com") the hosted viewer may be framed by; JSON array.
  allowedOrigins: text("allowed_origins", { mode: "json" }).$type<string[]>().notNull(),
  // Display settings every viewer token in this project starts from (see lib/viewer-settings).
  defaultSettings: text("default_settings", { mode: "json" }).$type<ProjectDefaultSettings>().notNull().default({}),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Secret API keys for a project. Only a SHA-256 hash of each key is stored (keys are long and
 * random, so a fast hash is enough — unlike passwords); the key itself is shown once at creation.
 */
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => apiProjects.id),
  name: text("name").notNull().default(""),
  // The first characters of the key, so it can be recognised in the dashboard.
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});

/**
 * A document an external project has shown in the viewer. The PDF itself stays in the
 * project's own storage; only its address and title are kept, so stats can name it.
 */
export const apiDocuments = sqliteTable(
  "api_documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => apiProjects.id),
    // The project's own ID for the document, so stats can be matched back to its database.
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    pdfUrl: text("pdf_url").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("api_documents_project_external_unique").on(t.projectId, t.externalId)]
);

/** Short-lived permission to open one document in the hosted viewer, with its display settings. */
export const apiViewerTokens = sqliteTable("api_viewer_tokens", {
  id: text("id").primaryKey(), // the token itself — it appears in the viewer URL
  projectId: text("project_id")
    .notNull()
    .references(() => apiProjects.id),
  documentId: text("document_id")
    .notNull()
    .references(() => apiDocuments.id),
  settings: text("settings", { mode: "json" }).$type<ViewerSettingsInput>().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** One row each time the hosted viewer opens a document. */
export const apiViews = sqliteTable(
  "api_views",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => apiProjects.id),
    documentId: text("document_id")
      .notNull()
      .references(() => apiDocuments.id),
    tokenId: text("token_id").notNull(),
    viewedAt: integer("viewed_at", { mode: "timestamp" }).notNull(),
    referrer: text("referrer").notNull().default(""),
    deviceType: text("device_type", { enum: ["mobile", "tablet", "desktop"] }),
    browser: text("browser"),
    country: text("country"),
    region: text("region"),
  },
  (t) => [index("api_views_project_viewed_idx").on(t.projectId, t.viewedAt)]
);

/** Page turns and link clicks within an external view. */
export const apiViewEvents = sqliteTable(
  "api_view_events",
  {
    id: text("id").primaryKey(),
    viewId: text("view_id")
      .notNull()
      .references(() => apiViews.id),
    projectId: text("project_id")
      .notNull()
      .references(() => apiProjects.id),
    documentId: text("document_id")
      .notNull()
      .references(() => apiDocuments.id),
    type: text("type", { enum: ["page_view", "link_click"] }).notNull(),
    pageNumber: integer("page_number").notNull(),
    url: text("url"),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("api_view_events_project_occurred_idx").on(t.projectId, t.occurredAt)]
);

export type User = typeof users.$inferSelect;
export type ApiProject = typeof apiProjects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiDocument = typeof apiDocuments.$inferSelect;
export type ApiViewerToken = typeof apiViewerTokens.$inferSelect;
export type Flipbook = typeof flipbooks.$inferSelect;
export type FlipbookView = typeof flipbookViews.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type FlipbookPageEvent = typeof flipbookPageEvents.$inferSelect;
export type FlipbookLinkClick = typeof flipbookLinkClicks.$inferSelect;
