import type { State } from "../lib/state";
import { BranchIcon, RefreshIcon } from "./Icons";

interface TopBarProps {
  state: State;
  onRescan: () => void;
  firstRun?: boolean;
}

/** Top bar — 56px, always mounted. */
export function TopBar({ state, onRescan, firstRun = false }: TopBarProps) {
  const { phase, scanning, branch, repoPath } = state;

  // Activity pill
  const isWorking = phase === "running";
  const isEtched = phase === "etched";
  const pillAOpacity = (isWorking || isEtched) ? 1 : 0;

  // Count pill
  const openRows = state.rows.filter((r) => r.status !== "fixed").length;
  const pillBBg = openRows > 0 ? "var(--violation-bg)" : "var(--obeys-bg)";
  const pillBFg = openRows > 0 ? "var(--violation)" : "var(--obeys)";
  const displayDigit = Math.min(openRows, 9);
  const digitTranslateY = -displayDigit * 14;

  const repoBasename = repoPath.split(/[\\/]/).pop() ?? repoPath;

  return (
    <header style={{
      height: 56,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 20,
      padding: "0 20px 0 24px",
      borderBottom: "1px solid var(--rule)",
      background: "var(--surface)",
      boxSizing: "border-box",
      zIndex: 10,
    }}>
      {/* Wordmark */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 52, flexShrink: 0 }}>
        <span style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          lineHeight: 1,
        }}>etch</span>
        <svg width="46" height="7" viewBox="0 0 46 7" aria-hidden="true">
          <path d="M1 4.5 C 10 2.2, 20 6.2, 30 3.4 S 42 2.8, 45 3.8"
            fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>

      {!firstRun && (
        <>
          <div className="topbar-divider" style={{ width: 1, height: 20, background: "var(--rule)", flexShrink: 0 }} />

          {/* Repo / branch block */}
          <div className="topbar-repo-block" style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
          }}>
            <span style={{ color: "var(--ink)", fontWeight: 500 }}>{repoBasename}</span>
            <span style={{ color: "var(--faint)" }}>/</span>
            <span style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--muted)",
            }}>
              <BranchIcon />
              {branch}
            </span>
          </div>
        </>
      )}

      <div style={{ flexGrow: 1 }} />

      {firstRun ? (
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Built with IBM Bob</span>
      ) : (
        <>
          {/* Activity pill — motion #13 */}
          <div className="topbar-activity-pill" style={{
            position: "relative",
            width: 128,
            height: 24,
            opacity: pillAOpacity,
            transition: "opacity 200ms ease",
            flexShrink: 0,
          }}>
            {/* Bob is working layer */}
            <span className="layer" style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: "var(--r-pill)",
              background: "var(--working-bg)",
              color: "var(--working)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              opacity: isWorking ? 1 : 0,
              filter: isWorking ? "blur(0)" : "blur(2px)",
            }}>
              <span className="pulse" style={{
                width: 6,
                height: 6,
                borderRadius: "var(--r-pill)",
                background: "var(--working)",
              }} />
              Bob is working
            </span>

            {/* Etched layer */}
            <span className="layer" style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: "var(--r-pill)",
              background: "var(--etched-bg)",
              color: "var(--etched)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              opacity: isEtched ? 1 : 0,
              filter: isEtched ? "blur(0)" : "blur(2px)",
            }}>
              Etched
            </span>
          </div>

          {/* Count pill — motion #12 */}
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 24,
            padding: "0 10px",
            borderRadius: "var(--r-pill)",
            background: pillBBg,
            color: pillBFg,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            transition: "background-color 200ms ease, color 200ms ease",
            flexShrink: 0,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "var(--r-pill)",
              background: pillBFg,
              transition: "background-color 200ms ease",
            }} />
            {/* rolling digit strip */}
            <span style={{
              display: "inline-block",
              height: 14,
              overflow: "hidden",
              lineHeight: "14px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {openRows > 9 ? (
                <span>9+</span>
              ) : (
                <span style={{
                  display: "flex",
                  flexDirection: "column",
                  transform: `translateY(${digitTranslateY}px)`,
                  transition: "transform 280ms var(--ease-out)",
                }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i}>{i}</span>
                  ))}
                </span>
              )}
            </span>
            <span>{openRows === 1 ? "violation" : "violations"}</span>
          </span>

          {/* Rescan button — motion #21 */}
          <button
            className="press ghost"
            onClick={onRescan}
            disabled={scanning}
            aria-label="Rescan"
            style={{
              height: 32,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-control)",
              background: "var(--surface)",
              color: "var(--body)",
              font: "500 13px var(--font-ui)",
              cursor: scanning ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            <RefreshIcon className={scanning ? "spin" : undefined} />
            <span className="topbar-rescan-label">Rescan</span>
          </button>
        </>
      )}
    </header>
  );
}
