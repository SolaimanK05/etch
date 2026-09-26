import type { FormEvent } from "react";
import type { State } from "../lib/state";

interface FirstRunProps {
  state: State;
  onScan: (repoPath: string) => void;
}

/**
 * FirstRun — ported from Empty.dc.html.
 * Shown when phase is "empty" or "scanning".
 */
export function FirstRun({ state, onScan }: FirstRunProps) {
  const { scanning, error, repoPath } = state;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const path = (fd.get("repo") as string).trim();
    if (path) onScan(path);
  }

  return (
    <div
      className="firstrun-layout"
      style={{
        flexGrow: 1,
        display: "flex",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Left column */}
      <section
        className="firstrun-left"
        style={{
          width: 700,
          flexShrink: 0,
          padding: "120px 0 0 112px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <h1
          className="firstrun-headline"
          style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            fontSize: 56,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "var(--ink)",
          }}
        >
          Draw the architecture.<br />Bob makes the code obey.
        </h1>

        <p style={{
          margin: 0,
          maxWidth: 460,
          fontSize: 17,
          lineHeight: 1.6,
          color: "var(--muted)",
        }}>
          Etch sketches your Python repo as boxes and arrows. Erase an arrow and every import that crosses it turns red.
        </p>

        <form
          onSubmit={handleSubmit}
          className="firstrun-form"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: 500,
          }}
        >
          <label
            htmlFor="repo"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}
          >
            Repository folder
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="repo"
              name="repo"
              className="field"
              type="text"
              defaultValue={repoPath}
              placeholder={String.raw`C:\Users\you\Desktop\Projects\demo-app`}
              style={{
                flexGrow: 1,
                height: 44,
                padding: "0 12px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-control)",
                background: "var(--surface)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--body)",
                boxSizing: "border-box",
                transition: "border-color 160ms ease, box-shadow 160ms ease",
              }}
            />
            <button
              type="submit"
              className="press cta"
              disabled={scanning}
              style={{
                height: 44,
                padding: "0 20px",
                border: 0,
                borderRadius: "var(--r-control)",
                background: "var(--ink)",
                color: "#FFFFFF",
                font: "500 15px var(--font-ui)",
                cursor: scanning ? "default" : "pointer",
                minWidth: 80,
                position: "relative",
              }}
            >
              {/* crossfade label — motion #22 */}
              <span
                className="layer"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: scanning ? 0 : 1,
                  filter: scanning ? "blur(2px)" : "blur(0)",
                }}
              >
                Scan
              </span>
              <span
                className="layer"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: scanning ? 1 : 0,
                  filter: scanning ? "blur(0)" : "blur(2px)",
                }}
              >
                Scanning…
              </span>
              {/* invisible spacer to maintain button width */}
              <span aria-hidden style={{ visibility: "hidden" }}>Scanning…</span>
            </button>
          </div>

          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Read-only. Nothing changes until you press Make it so.
          </span>

          {error && (
            <span style={{ fontSize: 12, color: "var(--violation)" }}>{error}</span>
          )}
        </form>

        {/* Steps */}
        <ol
          className="firstrun-steps"
          style={{
            listStyle: "none",
            margin: "16px 0 0",
            padding: 0,
            width: 500,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <li style={{
            padding: "14px 0",
            borderTop: "1px solid var(--rule)",
            display: "flex",
            gap: 20,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--muted)",
              paddingTop: 2,
            }}>01</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>Draw</span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
                Keep the arrows you allow. Erase the ones you don't.
              </span>
            </span>
          </li>
          <li style={{
            padding: "14px 0",
            borderTop: "1px solid var(--rule)",
            display: "flex",
            gap: 20,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--muted)",
              paddingTop: 2,
            }}>02</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>Make it so</span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
                IBM Bob refactors every import that breaks the drawing, then reruns your tests.
              </span>
            </span>
          </li>
          <li style={{
            padding: "14px 0",
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            gap: 20,
          }}>
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--muted)",
              paddingTop: 2,
            }}>03</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>Etch it</span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
                The drawing becomes import-linter contracts, a Bob skill and a pull-request check.
              </span>
            </span>
          </li>
        </ol>
      </section>

      {/* Right decorative panel */}
      <section
        aria-hidden="true"
        className="firstrun-right"
        style={{
          flexGrow: 1,
          position: "relative",
          borderLeft: "1px solid var(--rule)",
          backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          backgroundColor: "var(--paper)",
        }}
      >
        <svg
          width="740"
          height="844"
          viewBox="60 60 1000 900"
          style={{ position: "absolute", inset: 0, opacity: 0.55 }}
        >
          <defs>
            <marker id="ink0" viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="11" markerHeight="11" orient="auto-start-reverse">
              <path d="M1 1.5 L10.5 6 L1.5 10.5" fill="none" stroke="#111111"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="red0" viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="11" markerHeight="11" orient="auto-start-reverse">
              <path d="M1 1.5 L10.5 6 L1.5 10.5" fill="none" stroke="#9F2F2D"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          <g fill="none" stroke="#111111" strokeWidth="1.7" strokeLinecap="round">
            <path d="M109.2 138.5 Q212.9 138.0 320.7 138.1 Q318.5 183.0 320.2 231.4 Q213.8 233.2 108.1 232.0 Q107.0 184.0 109.2 138.5" />
            <path d="M410.2 358.1 Q528.9 357.5 648.1 358.7 Q650.7 406.1 650.8 451.7 Q528.9 452.4 409.2 452.4 Q409.8 406.9 410.2 358.1" />
            <path d="M730.4 599.8 Q831.6 603.1 931.5 602.0 Q932.1 646.4 929.9 692.7 Q828.5 693.5 728.1 692.9 Q727.1 646.2 730.4 599.8" />
            <path d="M719.4 141.7 Q851.1 139.0 982.0 138.5 Q978.1 184.3 978.6 230.8 Q848.1 231.7 718.8 231.9 Q721.1 187.7 719.4 141.7" />
            <path d="M252 242 Q 300 330 402 390" markerEnd="url(#ink0)" />
            <path d="M600 462 Q 662 540 742 594" markerEnd="url(#ink0)" />
            <path d="M612 352 Q 660 262 714 234" markerEnd="url(#ink0)" />
          </g>
          <path d="M196 244 Q 214 660 720 650" fill="none" stroke="#9F2F2D"
            strokeWidth="2" strokeLinecap="round" strokeDasharray="7 7"
            markerEnd="url(#red0)" />
          <g fontFamily="Nunito, sans-serif" fontWeight="700" fill="#111111"
            textAnchor="middle" fontSize="22">
            <text x="215" y="194">api</text>
            <text x="530" y="414">services</text>
            <text x="830" y="654">db</text>
            <text x="850" y="194">notifications</text>
          </g>
        </svg>
      </section>
    </div>
  );
}
