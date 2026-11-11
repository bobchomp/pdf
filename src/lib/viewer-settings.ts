import { z } from "zod";
import { BACKGROUND_POSITIONS } from "@/lib/background-position";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True for an absolute https URL (or http on a local development host) with no credentials.
 * Every URL an external project hands us goes through this before it reaches the viewer, so a
 * value like `javascript:…` or one crafted to break out of CSS `url("…")` is never used.
 */
export function isSafeUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

/** A URL ready to drop into CSS `url("…")`: re-serialized, with anything that could end the string escaped. */
export function cssUrl(value: string) {
  const href = new URL(value).href;
  return `url("${href.replace(/["\\\n\r\f]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)}")`;
}

const color = z
  .string()
  .regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, "Use a hex colour like #0f2044.")
  .transform((v) => v.toLowerCase());
const url = z.string().max(2000).refine(isSafeUrl, "Use a full https:// address.");

/** Display settings an external project can set — per viewer token, or as project-wide defaults. */
export const viewerSettingsSchema = z
  .object({
    backgroundColor: color,
    backgroundImageUrl: url.nullable(),
    backgroundFit: z.enum(["contain", "cover"]),
    backgroundPosition: z.enum(BACKGROUND_POSITIONS),
    headerColor: color.nullable(),
    headerTextColor: color,
    showHeader: z.boolean(),
    showTitle: z.boolean(),
    showPrint: z.boolean(),
    showDownload: z.boolean(),
    showFullscreen: z.boolean(),
    showPageArrows: z.boolean(),
    enableZoom: z.boolean(),
    logoUrl: url.nullable(),
    logoLinkUrl: url.nullable(),
    startPage: z.number().int().min(1).max(10000),
  })
  .partial()
  .strict();

/** Project defaults: the same settings, minus the ones that only make sense per document. */
export const projectDefaultSettingsSchema = viewerSettingsSchema.omit({ startPage: true });

export type ViewerSettingsInput = z.infer<typeof viewerSettingsSchema>;
export type ProjectDefaultSettings = z.infer<typeof projectDefaultSettingsSchema>;
export type ViewerSettings = Required<Omit<ViewerSettingsInput, "headerColor">> & { headerColor: string };

export const BUILT_IN_SETTINGS: Required<ViewerSettingsInput> = {
  backgroundColor: "#0f2044",
  backgroundImageUrl: null,
  backgroundFit: "contain",
  backgroundPosition: "center",
  headerColor: null, // same as the background colour
  headerTextColor: "#ffffff",
  showHeader: true,
  showTitle: true,
  showPrint: true,
  showDownload: true,
  showFullscreen: true,
  showPageArrows: true,
  enableZoom: true,
  logoUrl: null,
  logoLinkUrl: null,
  startPage: 1,
};

/**
 * The settings a viewer actually uses: the token's own, then the project's defaults, then the
 * built-in ones. A setting given as null (e.g. `logoUrl: null`) deliberately clears a default.
 */
export function resolveViewerSettings(project: ProjectDefaultSettings, token: ViewerSettingsInput): ViewerSettings {
  const merged = { ...BUILT_IN_SETTINGS, ...project, ...token };
  return { ...merged, headerColor: merged.headerColor ?? merged.backgroundColor };
}

/** Turns a zod error into one readable line, e.g. "settings.backgroundColor: Use a hex colour like #0f2044." */
export function describeZodError(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  if (issue.code === "unrecognized_keys") {
    const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${where}Unknown setting${issue.keys.length > 1 ? "s" : ""} ${issue.keys.map((k) => `"${k}"`).join(", ")}.`;
  }
  return `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`;
}
