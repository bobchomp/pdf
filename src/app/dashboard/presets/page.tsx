import Link from "next/link";
import { listPresets } from "@/lib/presets";
import { IconPlus } from "@/components/icons";
import { PresetsList } from "./presets-list";

export default async function PresetsPage() {
  const presets = await listPresets();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-navy-900">Presets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Reusable bundles of settings — privacy, controls, and branding — you can apply to any newsletter.
          </p>
        </div>
        <Link
          href="/dashboard/presets/new"
          className="flex shrink-0 items-center gap-2 rounded-[9px] bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-700"
        >
          <IconPlus />
          New preset
        </Link>
      </div>

      <div className="mt-7">
        <PresetsList
          presets={presets.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))}
        />
      </div>
    </div>
  );
}
