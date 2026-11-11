import { z } from "zod";
import { normalizeOrigins } from "@/lib/origins";
import { projectDefaultSettingsSchema } from "@/lib/viewer-settings";

const name = z.string().trim().min(1, "Give the project a name.").max(100);
const allowedOrigins = z.array(z.string().max(300)).max(20, "Up to 20 website addresses.");

export const createProjectSchema = z.object({ name, allowedOrigins });

export const updateProjectSchema = z.object({
  name: name.optional(),
  allowedOrigins: allowedOrigins.optional(),
  status: z.enum(["active", "disabled"]).optional(),
  defaultSettings: projectDefaultSettingsSchema.optional(),
});

export const createKeySchema = z.object({ name: z.string().trim().max(100).default("") });

/** Normalizes admin-typed website addresses; returns an error message if any aren't valid. */
export function parseOrigins(inputs: string[]): { origins: string[]; error: string | null } {
  const { origins, invalid } = normalizeOrigins(inputs);
  return { origins, error: invalid.length > 0 ? `Not a valid website address: ${invalid.join(", ")}` : null };
}
