import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { createPreset, listPresets } from "@/lib/presets";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const presets = await listPresets();
  return Response.json({ presets });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const preset = await createPreset(parsed.data.name);
  return Response.json({ preset });
}
