import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminPreloader } from "@/components/admin/admin-preloader";
import { Providers } from "@/components/shared/providers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  return (
    <Providers>
      <Suspense fallback={null}>
        <AdminPreloader />
      </Suspense>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
