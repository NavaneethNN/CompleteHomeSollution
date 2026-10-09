import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Re-read the role so a demoted administrator loses access immediately even
 * when an older signed session still contains the ADMIN role. */
export async function hasFreshAdminSession(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return false;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}
