import type { FormEvent } from "react";
import type { State } from "../lib/state";
import { STATIC_DEMO } from "../demo/staticApi";

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
          // up to 800px so the 56px headline keeps its two lines (Geist needs 658px);
          // narrower on small desktops; scrolls on short screens
          width: "min(800px, 58vw)",
          flexShrink: 0,
          overflowY: "auto",
          padding: "min(120px, 12vh) 24px 40px min(112px, 8vw)",
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
          maxWidth: 490,
          fontSize: 18,
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
            style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}
          >
            Repository folder
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="repo"
              name="repo"
              className="field"
              type="text"
              // the hosted demo only has the bundled demo shop app
              defaultValue={repoPath || (STATIC_DEMO ? "demo-app" : "")}
              readOnly={STATIC_DEMO}
              placeholder={String.raw`C:\Users\you\Desktop\Projects\demo-app`}
              style={{
                flexGrow: 1,
                height: 44,
                padding: "0 12px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-control)",
                background: "var(--surface)",
                fontFamily: "var(--font-mono)",
                fontSize: 14,
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
                font: "500 16px var(--font-ui)",
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

          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Read-only. Nothing changes until you press Make it so.
          </span>

          {error && (
            <span style={{ fontSize: 13, color: "var(--violation)" }}>{error}</span>
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
              fontSize: 13,
              color: "var(--muted)",
              paddingTop: 2,
            }}>01</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>Draw</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--muted)" }}>
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
              fontSize: 13,
              color: "var(--muted)",
              paddingTop: 2,
            }}>02</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>Make it so</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--muted)" }}>
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
              fontSize: 13,
              color: "var(--muted)",
              paddingTop: 2,
            }}>03</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>Etch it</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--muted)" }}>
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
        {/* Clean boxes at full strength; the violation arrow is animated (theme.css .landing-*).
            pricing is the package Bob created in the "draw a box" flow. Scales to the panel. */}
        <svg
          viewBox="0 20 720 740"
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 32, width: "calc(100% - 64px)", height: "calc(100% - 64px)" }}
        >
          <defs>
            <marker id="ink0" viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M1.5 1.5 L10.5 6 L1.5 10.5" fill="none" stroke="#111111"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="red0" viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="9" markerHeight="9" orient="auto-start-reverse">
              <path d="M1.5 1.5 L10.5 6 L1.5 10.5" fill="none" stroke="#9F2F2D"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {/* allowed arrows */}
          <g fill="none" stroke="#111111" strokeWidth="1.6" strokeLinecap="round">
            <path d="M150 152 Q 170 236 250 274" markerEnd="url(#ink0)" />
            <path d="M430 244 Q 470 170 492 156" markerEnd="url(#ink0)" />
            <path d="M420 342 Q 470 420 492 450" markerEnd="url(#ink0)" />
            <path d="M360 342 L 360 630" markerEnd="url(#ink0)" />
            <path d="M560 542 Q 530 610 470 650" markerEnd="url(#ink0)" />
          </g>
          {/* boxes */}
          <g fill="#FFFFFF" stroke="#111111" strokeWidth="1.6">
            <rect x="20" y="60" width="180" height="84" rx="10" />
            <rect x="500" y="60" width="200" height="84" rx="10" />
            <rect x="260" y="250" width="200" height="84" rx="10" />
            <rect x="500" y="450" width="180" height="84" rx="10" />
            <rect x="260" y="640" width="200" height="84" rx="10" />
          </g>
          <g fontFamily="Nunito, sans-serif" fontWeight="700" fontSize="26" fill="#111111" textAnchor="middle">
            <text x="110" y="102">api</text>
            <text x="600" y="102">notifications</text>
            <text x="360" y="292">services</text>
            <text x="590" y="492">db</text>
            <text x="360" y="682">pricing</text>
          </g>
          <g fontFamily="Geist Mono, monospace" fontSize="14" fill="#55544F" textAnchor="middle">
            <text x="110" y="126">shop.api</text>
            <text x="600" y="126">shop.notifications</text>
            <text x="360" y="316">shop.services</text>
            <text x="590" y="516">shop.db</text>
            <text x="360" y="706">shop.pricing</text>
          </g>
          {/* created tag on pricing */}
          <g transform="translate(236 627)">
            <rect width="92" height="26" rx="13" fill="#EDF3EC" />
            <text x="46" y="17.5" fontFamily="Geist, sans-serif" fontSize="13" fontWeight="500"
              letterSpacing="0.7" fill="#346538" textAnchor="middle">CREATED</text>
          </g>
          {/* animated violation api → db */}
          <path className="landing-flow" d="M90 152 Q 110 520 490 500" fill="none" stroke="#9F2F2D"
            strokeWidth="2.2" strokeLinecap="round" markerEnd="url(#red0)" />
          <circle className="landing-packet" r="5.5" fill="#9F2F2D" />
          <g className="landing-pill">
            <rect x="118" y="368" width="92" height="28" rx="14" fill="#FDEBEC" />
            <text x="164" y="387" fontFamily="Geist, sans-serif" fontSize="14" fontWeight="500"
              fill="#9F2F2D" textAnchor="middle">1 import</text>
          </g>
        </svg>
      </section>
    </div>
  );
}
