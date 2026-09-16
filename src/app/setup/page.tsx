import type { Metadata } from "next";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return <SetupForm />;
}
