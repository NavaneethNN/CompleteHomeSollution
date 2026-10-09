import { notFound } from "next/navigation";
import { hasFreshAdminSession } from "@/lib/admin-auth";

export default async function QaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await hasFreshAdminSession())) notFound();

  return children;
}
