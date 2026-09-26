import type { ReactNode } from "react";

export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

/**
 * Amber Bobcoin chip. Live runs only learn the cost from Bob's final result
 * event, so while running it shows the cap; once done it shows the real spend.
 */
export function CoinChip({ children, pop = false }: { children: ReactNode; pop?: boolean }) {
  return (
    <span className={pop ? "coin coin-pop" : "coin"}>
      <CoinIcon />
      {children}
    </span>
  );
}
