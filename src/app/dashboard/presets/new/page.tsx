import type { Metadata } from "next";
import { NewPresetForm } from "./new-preset-form";

export const metadata: Metadata = { title: "New preset" };

export default function NewPresetPage() {
  return <NewPresetForm />;
}
