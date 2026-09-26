import { useEffect, useRef, useState } from "react";
import type { Toast as ToastData } from "../lib/state";
import { CheckIcon } from "./Icons";

interface ToastProps {
  toast: ToastData | null;
}

type Phase = "hidden" | "showing" | "visible" | "hiding";

/**
 * Toast — motion #16.
 * Always mounted. Keyed off toast.seq.
 * Show over 200ms, hold 1500ms, hide over 150ms.
 * If a new seq arrives while visible: hide, wait 170ms, show the new one.
 */
export function Toast({ toast }: ToastProps) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [displayToast, setDisplayToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function showToast(t: ToastData) {
    setDisplayToast(t);
    setPhase("showing");
    timerRef.current = setTimeout(() => {
      setPhase("visible");
      timerRef.current = setTimeout(() => {
        setPhase("hiding");
        timerRef.current = setTimeout(() => {
          setPhase("hidden");
        }, 150);
      }, 1500);
    }, 200);
  }

  useEffect(() => {
    if (toast === null) return;
    if (phase === "hidden" || phase === "hiding") {
      clear();
      showToast(toast);
    } else {
      // visible or showing — hide first, then show after 170ms
      clear();
      setPhase("hiding");
      timerRef.current = setTimeout(() => {
        setPhase("hidden");
        timerRef.current = setTimeout(() => {
          showToast(toast);
        }, 0);
      }, 170);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.seq]);

  useEffect(() => () => clear(), []);

  const isVisible = phase === "showing" || phase === "visible";
  const opacity = isVisible ? 1 : 0;
  const translateY = isVisible ? 0 : -8;
  const duration = phase === "hiding" ? 150 : 200;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        top: 76, // below Excalidraw's toolbar island
        left: "50%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "var(--surface)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-panel)",
        boxShadow: "var(--shadow-toast)",
        fontSize: 14,
        color: "var(--body)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        opacity,
        transform: `translate(-50%, ${translateY}px)`,
        transition: `opacity ${duration}ms var(--ease-out), transform ${duration}ms var(--ease-out)`,
        zIndex: 20,
      }}
    >
      <span style={{
        width: 18,
        height: 18,
        borderRadius: "var(--r-pill)",
        background: "var(--obeys-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--obeys)",
        flexShrink: 0,
      }}>
        <CheckIcon />
      </span>
      <span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink)" }}>
          {displayToast?.path}
        </span>
        {" "}
        {displayToast?.msg}
      </span>
    </div>
  );
}
