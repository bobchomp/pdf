import { notFound } from "next/navigation";
import { getPresetById } from "@/lib/presets";
import { createPresignedGetUrl } from "@/lib/r2";
import { PresetSettings } from "./preset-settings";

export default async function PresetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preset = await getPresetById(id);
  if (!preset) notFound();

  const [backgroundImageUrl, logoUrl] = await Promise.all([
    preset.backgroundImageR2Key ? createPresignedGetUrl(preset.backgroundImageR2Key).catch(() => null) : null,
    preset.logoR2Key ? createPresignedGetUrl(preset.logoR2Key).catch(() => null) : null,
  ]);

  return (
    <PresetSettings
      preset={{
        id: preset.id,
        name: preset.name,
        isDefault: preset.isDefault,
        isPrivate: preset.isPrivate,
        allowDownload: preset.allowDownload,
        allowPrint: preset.allowPrint,
        themeColor: preset.themeColor,
        showToolbar: preset.showToolbar,
        backgroundImageR2Key: preset.backgroundImageR2Key,
        backgroundFit: preset.backgroundFit,
        backgroundPosition: preset.backgroundPosition,
        logoR2Key: preset.logoR2Key,
        logoLinkUrl: preset.logoLinkUrl,
      }}
      initialBackgroundImageUrl={backgroundImageUrl}
      initialLogoUrl={logoUrl}
    />
  );
}
