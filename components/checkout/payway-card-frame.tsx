"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Lock } from "lucide-react";

/* ── PayWay global type declarations ────────────────────────────────────────── */
interface PayWayFrameOptions {
  publishableApiKey: string;
  container?: string;
  tokenMode: "callback";
  layout?: "wide" | "narrow";
  style?: Record<string, Record<string, string>>;
  onValid?: () => void;
  onInvalid?: () => void;
}

interface PayWayFrameInstance {
  getToken: (
    callback: (
      err: { message: string; status?: number } | undefined,
      data: { singleUseTokenId: string; paymentMethod: string }
    ) => void
  ) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    payway?: {
      createCreditCardFrame: (
        options: PayWayFrameOptions,
        createdCallback: (
          err: { message: string; status?: number } | undefined,
          frame: PayWayFrameInstance
        ) => void
      ) => void;
    };
  }
}

/* ── Component ───────────────────────────────────────────────────────────────── */

interface PayWayCardFrameProps {
  /** Called when a single-use token is successfully obtained */
  onTokenReady: (tokenId: string) => void;
  /** Called when PayWay reports an error */
  onError: (message: string) => void;
  disabled?: boolean;
}

const CONTAINER_ID = "payway-credit-card-iframe";

export function PayWayCardFrame({ onTokenReady, onError, disabled }: PayWayCardFrameProps) {
  const frameRef = useRef<PayWayFrameInstance | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isGettingToken, setIsGettingToken] = useState(false);

  // ── Load payway.js once ────────────────────────────────────────────────────
  useEffect(() => {
    // Avoid double-loading if script is already present
    if (window.payway || document.querySelector('script[src*="payway.js"]')) {
      if (window.payway) setScriptLoaded(true);
      else {
        // Script tag exists but may still be loading — wait for it
        const existing = document.querySelector('script[src*="payway.js"]') as HTMLScriptElement;
        existing.addEventListener("load", () => setScriptLoaded(true));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://api.payway.com.au/rest/v1/payway.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => onError("Failed to load PayWay payment library. Please refresh.");
    document.body.appendChild(script);
  }, []);

  // ── Create iframe once script is available ────────────────────────────────
  useEffect(() => {
    if (!scriptLoaded || !window.payway) return;
    if (frameRef.current) return; // already created

    window.payway.createCreditCardFrame(
      {
        publishableApiKey: process.env.NEXT_PUBLIC_PAYWAY_PUBLISHABLE_KEY!,
        container: CONTAINER_ID,
        tokenMode: "callback",
        layout: "wide",
        onValid: () => setIsValid(true),
        onInvalid: () => setIsValid(false),
        style: {
          "div.payway-card": {
            "font-family": "inherit",
            "padding": "4px 0",
          },
          ".payway-card label": {
            "color": "#374151",
            "font-size": "13px",
            "font-weight": "500",
          },
          ".payway-card input": {
            "border": "1px solid #e5e7eb",
            "border-radius": "6px",
            "padding": "8px 12px",
            "font-size": "14px",
            "color": "#111827",
          },
          ".payway-card select": {
            "border": "1px solid #e5e7eb",
            "border-radius": "6px",
            "padding": "8px 12px",
            "font-size": "14px",
          },
        },
      },
      (err, frame) => {
        if (err) {
          onError(err.message ?? "Could not initialise card form");
          return;
        }
        frameRef.current = frame;
        setFrameReady(true);
      }
    );

    return () => {
      frameRef.current?.destroy();
      frameRef.current = null;
      setFrameReady(false);
      setIsValid(false);
    };
  }, [scriptLoaded]);

  // ── Token retrieval ───────────────────────────────────────────────────────
  const getToken = useCallback(() => {
    if (!frameRef.current || !isValid || isGettingToken || disabled) return;
    setIsGettingToken(true);
    frameRef.current.getToken((err, data) => {
      setIsGettingToken(false);
      if (err) {
        onError(err.message ?? "Could not secure card details");
        return;
      }
      onTokenReady(data.singleUseTokenId);
    });
  }, [isValid, isGettingToken, disabled, onTokenReady, onError]);

  // Expose getToken so the parent's pay button can trigger it imperatively
  useEffect(() => {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    const handler = () => getToken();
    container.addEventListener("payway:getToken", handler);
    return () => container.removeEventListener("payway:getToken", handler);
  }, [getToken]);

  return (
    <div className={`space-y-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* PayWay iframe container */}
      <div className="relative min-h-[220px] rounded-lg border border-border bg-white overflow-hidden">
        {!frameReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Loading secure card form…</p>
          </div>
        )}
        <div id={CONTAINER_ID} className="p-4" />
      </div>

      {/* Status indicators */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          Secured by PayWay (Westpac)
        </span>
        {isGettingToken && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Securing card…
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Trigger token retrieval on the PayWay frame imperatively.
 * Call this when the user clicks "Pay Now" instead of managing
 * token state entirely in the frame component.
 */
export function triggerPayWayGetToken() {
  const container = document.getElementById(CONTAINER_ID);
  if (container) {
    container.dispatchEvent(new CustomEvent("payway:getToken"));
  }
}
