import type { Metadata } from "next";
import { NewFlipbookForm } from "./new-flipbook-form";

export const metadata: Metadata = { title: "Upload PDF" };

export default function NewFlipbookPage() {
  return <NewFlipbookForm />;
}
