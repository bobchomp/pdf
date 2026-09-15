import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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

export type User = typeof users.$inferSelect;
export type Flipbook = typeof flipbooks.$inferSelect;
export type FlipbookView = typeof flipbookViews.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type FlipbookPageEvent = typeof flipbookPageEvents.$inferSelect;
export type FlipbookLinkClick = typeof flipbookLinkClicks.$inferSelect;
