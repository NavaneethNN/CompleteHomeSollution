import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPackagingPresets } from "@/lib/actions/packaging";
import { PackagingClient } from "@/components/admin/packaging-client";

export const metadata: Metadata = {
  title: "Packaging Configuration — Admin",
  description: "Configure box presets, dimensions, weight capacity, and tare weights.",
};

export default async function PackagingPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { presets = [] } = await getPackagingPresets();

  return <PackagingClient initialPresets={presets} />;
}

