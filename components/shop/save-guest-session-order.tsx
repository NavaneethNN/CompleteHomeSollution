"use client";

import { useEffect } from "react";
import { saveGuestOrderToSession } from "@/lib/guest-session";

interface SaveGuestSessionOrderProps {
  orderId: string;
  guestToken?: string;
  email?: string | null;
}

export function SaveGuestSessionOrder({
  orderId,
  guestToken,
  email,
}: SaveGuestSessionOrderProps) {
  useEffect(() => {
    if (!orderId || !guestToken) return;

    saveGuestOrderToSession({
      orderId,
      guestToken,
      email: email || undefined,
    });
  }, [orderId, guestToken, email]);

  return null;
}
