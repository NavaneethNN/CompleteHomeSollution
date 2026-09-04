"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Lock } from "lucide-react";

/* ── PayWay global type declarations ─────────────────────────────────────── */
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

/* ── Component ────────────────────────────────────────────────────────────── */

interface PayWayCardFrameProps {
  onTokenReady: (tokenId: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

const CONTAINER_ID = "payway-credit-card-iframe";
const PAYWAY_SCRIPT_URL = "https://api.payway.com.au/rest/v1/payway.js";

export function PayWayCardFrame({ onTokenReady, onError, disabled }: PayWayCardFrameProps) {
  const frameRef = useRef<PayWayFrameInstance | null>(null);
  // Keep callbacks in refs so closures always use the latest version
  const onTokenReadyRef = useRef(onTokenReady);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTokenReadyRef.current = onTokenReady; }, [onTokenReady]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isGettingToken, setIsGettingToken] = useState(false);

  // ── Step 1: load payway.js ─────────────────────────────────────────────────
  useEffect(() => {
    // If already loaded (e.g. hot-reload), proceed immediately
    if (window.payway) {
      setScriptLoaded(true);
      return;
    }

    // If the script tag exists (e.g. strict-mode double-mount) just wait for it
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYWAY_SCRIPT_URL}"]`
    );
    if (existing) {
      const onLoad = () => setScriptLoaded(true);
      const onLoadErr = () =>
        onErrorRef.current(
          "Failed to load PayWay payment library. Please refresh the page."
        );
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onLoadErr);
return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onLoadErr);
      };
    }

    // Inject the script
    const script = document.createElement("script");
    script.src = PAYWAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () =>
      onErrorRef.current(
        "Failed to load PayWay payment library. Please check your connection and refresh."
      );
    document.body.appendChild(script);

    return () => {
      // Don't remove — leave it in DOM so subsequent mounts reuse it
    };
  }, []); // runs once on mount

  // ── Step 2: create the PayWay iframe once script is ready ─────────────────
  useEffect(() => {
    if (!scriptLoaded) return;

    // window.payway may take a tick to be set after onload fires
    const tryCreate = () => {
      if (!window.payway) {
        onErrorRef.current(
          "PayWay library loaded but not initialised. Please refresh."
        );
        return;
      }

      if (frameRef.current) return; // already created (strict-mode guard)

      window.payway.createCreditCardFrame(
        {
          publishableApiKey: process.env.NEXT_PUBLIC_PAYWAY_PUBLISHABLE_KEY!,
          container: CONTAINER_ID,
          tokenMode: "callback",
          layout: "wide",
          onValid: () => setIsValid(true),
          onInvalid: () => setIsValid(false),
          style: {
            "div.payway-card": { "font-family": "inherit", "padding": "4px 0" },
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
            onErrorRef.current(
              err.message ?? "Could not initialise card form. Please refresh."
            );
            return;
          }
          frameRef.current = frame;
          setFrameReady(true);
        }
      );
    };

    // Small delay to ensure window.payway is set after the script's onload
    const id = setTimeout(tryCreate, 50);
    return () => {
      clearTimeout(id);
      frameRef.current?.destroy();
      frameRef.current = null;
      setFrameReady(false);
      setIsValid(false);
    };
  }, [scriptLoaded]);

  // ── Token retrieval ────────────────────────────────────────────────────────
  const getToken = useCallback(() => {
    if (!frameRef.current || !isValid || isGettingToken || disabled) return;
    setIsGettingToken(true);
    frameRef.current.getToken((err, data) => {
      setIsGettingToken(false);
      if (err) {
        onErrorRef.current(err.message ?? "Could not secure card details. Please try again.");
        return;
      }
      onTokenReadyRef.current(data.singleUseTokenId);
    });
  }, [isValid, isGettingToken, disabled]);

  // Expose getToken via DOM event so parent can trigger imperatively
  useEffect(() => {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    const handler = () => getToken();
    container.addEventListener("payway:getToken", handler);
    return () => container.removeEventListener("payway:getToken", handler);
  }, [getToken]);

  return (
    <div className={`space-y-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="relative min-h-[220px] rounded-lg border border-border bg-white overflow-hidden">
        {!frameReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Loading secure card form…</p>
          </div>
        )}
        <div id={CONTAINER_ID} className="p-4" />
      </div>
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

export function triggerPayWayGetToken() {
  const container = document.getElementById(CONTAINER_ID);
  if (container) {
    container.dispatchEvent(new CustomEvent("payway:getToken"));
  }
}
