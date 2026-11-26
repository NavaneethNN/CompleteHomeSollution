import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasFreshAdminSession } from "@/lib/admin-auth";
import { SUITE_META, type Suite } from "@/lib/qa-test-data";
import SuiteRunner from "./_components/suite-runner";

export const dynamic = "force-dynamic"; // Always fetch fresh results from database

const VALID_SUITES: Suite[] = [
  "login",
  "signup",
  "profile",
  "products",
  "cart",
  "wishlist",
  "checkout",
  "orders",
  "membership",
  "admin-products",
  "admin-orders",
  "admin-customers",
  "admin-coupons",
  "blog",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ suite: string }>;
}): Promise<Metadata> {
  const { suite } = await params;
  const meta = SUITE_META[suite as Suite];
  if (!meta) return { title: "Not Found" };
  return { title: `${meta.label} Tests — CHS QA` };
}

export default async function SuitePage({
  params,
}: {
  params: Promise<{ suite: string }>;
}) {
  const { suite } = await params;

  if (!(await hasFreshAdminSession())) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/qa/${suite}`)}`);
  }

  if (!VALID_SUITES.includes(suite as Suite)) notFound();

  const rawResults = await db.testResult.findMany({
    where: { suite },
    select: { testId: true, status: true, notes: true, comments: true },
  });

  const initialResults = rawResults.map((r) => ({
    testId: r.testId,
    status: r.status as "PENDING" | "PASSED" | "FAILED",
    notes: r.notes ?? "",
    comments: (r as { comments?: string | null }).comments ?? "",
  }));

  return <SuiteRunner suite={suite as Suite} initialResults={initialResults} />;
}
