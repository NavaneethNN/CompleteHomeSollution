"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Crown, Sparkles } from "lucide-react";

export function RefreshSessionOnMembership() {
  const { update, data: session } = useSession();
  const [refreshed, setRefreshed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (refreshed) return;
    setRefreshed(true);

    // Force JWT refresh so isMember = true is picked up immediately
    update().then((updatedSession) => {
      if (updatedSession?.user?.isMember) {
        setShowBanner(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also show banner if session already reflects membership
  useEffect(() => {
    if (session?.user?.isMember) setShowBanner(true);
  }, [session?.user?.isMember]);

  if (!showBanner) return null;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-primary/90 p-5 text-white flex items-center gap-4 shadow-lg">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
        <Crown className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="font-bold text-base flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" />
          Welcome to CHS Premium!
        </p>
        <p className="text-sm text-white/70 mt-0.5">
          Your membership is now active. Enjoy member pricing, free express delivery, and exclusive perks on every order.
        </p>
      </div>
    </div>
  );
}
