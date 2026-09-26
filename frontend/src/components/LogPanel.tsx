import type { State } from "../lib/state";

interface LogPanelProps {
  state: State;
  simulated?: boolean;
}

function fileNote(path: string, importlinter: string): string {
  if (path === ".importlinter") {
    const count = (importlinter.match(/\[importlinter:contract:/g) ?? []).length;
    return `${count} contract${count !== 1 ? "s" : ""}`;
  }
  if (path.startsWith(".github/workflows/")) return "PR check";
  if (path.startsWith(".bob/skills/")) return "Bob skill";
  if (path === ".bob/custom_modes.yaml") return "Bob mode";
  if (path === ".etch/drawing.json") return "the sketch";
  return "";
}

/**
 * LogPanel — the flexible region below rows.
 * Shows "Live from IBM Bob" log in running/done/error,
 * or "Written to your repo" file list in etched.
 * Motion #11: log region slides in.
 * Motion #10: log lines animate in.
 * Motion #20: written-files rows animate in.
 */
export function LogPanel({ state, simulated = false }: LogPanelProps) {
  const { phase, log, written, importlinter } = state;

  const showLog = phase === "running" || phase === "done" || phase === "error";
  const showEtched = phase === "etched";

  // Log region appear — motion #11
  const logOpacity = showLog ? 1 : 0;
  const logTranslateY = showLog ? 0 : 8;

  let logMeta = "waiting";
  if (log.length > 0) {
    logMeta = simulated ? "agent mode · simulated" : "agent mode";
  }

  const toneColor: Record<string, string> = {
    muted: "var(--muted)",
    obeys: "var(--obeys)",
    violation: "var(--violation)",
  };

  return (
    <div className="rail-log" style={{
      position: "relative",
      flexGrow: 1,
      minHeight: 0,
      margin: "16px 16px 0",
      borderTop: "1px solid var(--rule)",
    }}>
      {/* Live log — motion #11 */}
      {(showLog || !showEtched) && (
        <div style={{
          position: "absolute",
          inset: "12px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          opacity: logOpacity,
          transform: `translateY(${logTranslateY}px)`,
          transition: "opacity 200ms ease, transform 200ms var(--ease-out)",
          pointerEvents: showLog ? "auto" : "none",
        }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            padding: "0 12px",
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
              Live from IBM Bob
            </span>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--muted)",
            }}>
              {logMeta}
            </span>
          </div>

          <ol style={{
            listStyle: "none",
            margin: 0,
            padding: 12,
            flexGrow: 1,
            minHeight: 0,
            overflow: "hidden",
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-panel)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.45,
            fontVariantNumeric: "tabular-nums",
          }}>
            {log.map((ln, i) => (
              <li
                key={i}
                className="lineIn"
                style={{ display: "flex", gap: 10, flexShrink: 0 }}
              >
                <span style={{ color: "var(--muted)", width: 36, flexShrink: 0 }}>
                  {ln.t}
                </span>
                <span style={{ color: "var(--ink)", width: 56, flexShrink: 0 }}>
                  {ln.verb}
                </span>
                <span style={{
                  color: "var(--body)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {ln.detail}{" "}
                  {ln.suf && (
                    <span style={{ color: toneColor[ln.tone] ?? "var(--muted)" }}>
                      {ln.suf}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Written-to-repo list — motion #20 */}
      {showEtched && (
        <div style={{
          position: "absolute",
          inset: "12px 12px 0",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          // never spill over the action slot on short windows: scroll instead
          overflowY: "auto",
        }}>
          <span className="rowIn" style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink)",
            paddingBottom: 8,
          }}>
            Written to your repo
          </span>

          {written.map((filePath, i) => {
            const note = fileNote(filePath, importlinter);
            const delay = 60 + i * 40;
            return (
              <div
                key={filePath}
                className="rowIn"
                style={{
                  padding: "8px 0",
                  flexShrink: 0,
                  borderTop: "1px solid var(--rule)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  animationDelay: `${delay}ms`,
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--obeys)",
                  width: 12,
                }}>+</span>
                <span title={filePath} style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: "var(--ink)",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {filePath}
                </span>
                <span style={{ flexGrow: 1 }} />
                <span style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {note}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
