"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";

export function SentryUserSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      // Attach non-sensitive user identity to Sentry events
      Sentry.setUser({
        id: session.user.id || undefined,
      });

      if (session.user.role) {
        Sentry.setTag("user.role", session.user.role);
      }

      if ("isMember" in session.user) {
        Sentry.setTag("user.isMember", String(Boolean((session.user as { isMember?: boolean }).isMember)));
      }
    } else {
      Sentry.setUser(null);
    }
  }, [session]);

  return null;
}
