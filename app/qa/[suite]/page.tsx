import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
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

  if (!VALID_SUITES.includes(suite as Suite)) notFound();

  const rawResults = await db.testResult.findMany({
    where: { suite },
    select: { testId: true, status: true, notes: true, comments: true },
  });

  try {
    const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? "";
    const hostMatch = url.match(/@(.*?)\//);
    // eslint-disable-next-line no-console
    console.log("[qa/suite] suite=", suite, "dbHost=", hostMatch ? hostMatch[1] : "(none)", "results=", rawResults.length);
  } catch (e) {
    // ignore
  }

  const initialResults = rawResults.map((r) => ({
    testId: r.testId,
    status: r.status as "PENDING" | "PASSED" | "FAILED",
    notes: r.notes ?? "",
    comments: (r as any).comments ?? "",
  }));

  return <SuiteRunner suite={suite as Suite} initialResults={initialResults} />;
}
