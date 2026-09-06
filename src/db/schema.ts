import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
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

  // Privacy
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  passwordHash: text("password_hash"),

  // Controls
  allowDownload: integer("allow_download", { mode: "boolean" }).notNull().default(true),
  allowPrint: integer("allow_print", { mode: "boolean" }).notNull().default(true),

  // Branding
  themeColor: text("theme_color").notNull().default("#1e293b"),
  showToolbar: integer("show_toolbar", { mode: "boolean" }).notNull().default(true),

  status: text("status", { enum: ["processing", "ready", "error"] })
    .notNull()
    .default("processing"),

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
});

export type User = typeof users.$inferSelect;
export type Flipbook = typeof flipbooks.$inferSelect;
export type FlipbookView = typeof flipbookViews.$inferSelect;
