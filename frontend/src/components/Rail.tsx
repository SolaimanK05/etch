import type { State } from "../lib/state";
import { openCount, canEtch, progress, workCount, newBoxCount } from "../lib/state";
import { Rows } from "./Rows";
import { LogPanel } from "./LogPanel";
import { CountUp } from "./CountUp";
import { CoinChip } from "./Coin";

interface RailProps {
  state: State;
  simulated: boolean;
  onHover: (edge: string | null) => void;
  onMakeItSo: () => void;
  onStop: () => void;
  onEtchIt: () => void;
  onUndo: () => void;
  onOpenPr: () => void;
  prPending: boolean;
  prMessage: string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clockStr(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/**
 * Rail — 400px right rail.
 * Regions (never change position between phases):
 *  1. Heading block (150px)
 *  2. Violation rows (list)
 *  3. Flexible log / written-files region
 *  4. Action slot (92px)
 *  5. Footer (Etch it)
 */
export function Rail({ state, simulated, onHover, onMakeItSo, onStop, onEtchIt, onUndo, onOpenPr, prPending, prMessage }: RailProps) {
  const { phase, rows, drawing, coins, elapsedMs } = state;
  const open = openCount(state);
  const canEtchNow = canEtch(state);
  const prog = progress(state);
  const clock = clockStr(elapsedMs);

  // Heading layer visibilities — motion #2
  const headLayer = (active: boolean) => ({
    opacity: active ? 1 : 0,
    filter: active ? "blur(0)" : "blur(2px)",
    pointerEvents: active ? ("auto" as const) : ("none" as const),
  });

  const headIdle = headLayer(phase === "idle" || phase === "error");
  const headRun  = headLayer(phase === "running");
  const headDone = headLayer(phase === "done");
  const headEtched = headLayer(phase === "etched");

  // CTA layer visibilities — motion #3
  const ctaIdle   = headLayer((phase === "idle" || phase === "error") && workCount(state) > 0);
  const ctaIdleEmpty = headLayer((phase === "idle") && workCount(state) === 0);
  const ctaRun    = headLayer(phase === "running");
  const ctaDone   = headLayer(phase === "done");
  const ctaEtched = headLayer(phase === "etched");

  // Subtext for idle heading
  const arrowsSummary = (() => {
    const arrows = drawing.arrows;
    if (arrows.length === 0) return "";
    const parts = arrows.map((a) => `${a.source} → ${a.target}`);
    return "You drew " + parts.slice(0, 4).join(", ") + (arrows.length > 4 ? "…" : "") + ". These lines cross an arrow you didn't draw.";
  })();

  // New boxes (DESIGN.md §12)
  const boxes = newBoxCount(state);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const idleHeading = boxes === 0
    ? (open === 1 ? "1 import breaks your drawing" : `${open} imports break your drawing`)
    : open === 0
      ? `${plural(boxes, "new box", "new boxes")} to build`
      : `${plural(open, "import", "imports")}, ${plural(boxes, "new box", "new boxes")}`;
  const boxWord = boxes === 1 ? "box" : "boxes";
  const boxesSummary = open > 0
    ? `IBM Bob fixes the imports and builds the ${boxWord} you drew, then reruns your tests.`
    : `IBM Bob builds the ${boxWord} you drew, then reruns your tests.`;

  // Done subtext: "4 imports fixed and 1 box built in 1:52 for"
  const fixedCount = rows.filter((r) => r.status === "fixed").length;
  const builtCount = state.builtBoxes.length;
  const doneParts = [
    fixedCount > 0 || builtCount === 0 ? plural(fixedCount, "import fixed", "imports fixed") : null,
    builtCount > 0 ? plural(builtCount, "box built", "boxes built") : null,
  ].filter(Boolean);
  const doneText = `${doneParts.join(" and ")} in ${clock} for `;

  // Footer Etch it button
  const etchReady = canEtchNow && phase !== "etched";
  const etchBg = etchReady ? "var(--ink)" : "var(--paper)";
  const etchFg = etchReady ? "#FFFFFF" : (phase === "etched" ? "var(--etched)" : "var(--subtle)");
  const etchBorder = etchReady ? "var(--ink)" : "var(--rule)";
  const etchLabel = phase === "etched" ? "Etched" : "Etch it";
  const etchHint = phase === "etched"
    ? "Rules written to your repo."
    : etchReady
      ? "Make the drawing a rule"
      : "Unlocks at 0 violations";

  return (
    <aside className="app-rail" data-phase={state.phase}>
      {/* 1. Heading block */}
      <div
        className="rail-heading"
        style={{
          position: "relative",
          height: 150,
          flexShrink: 0,
          margin: "32px 28px 0",
        }}
      >
        {/* idle / error layer */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", gap: 10,
          ...headIdle,
        }}>
          {phase === "error" ? (
            <>
              <h1 style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 600, fontSize: 30,
                lineHeight: 1.15, letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}>Bob stopped</h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--violation)" }}>
                {state.error}
              </p>
            </>
          ) : workCount(state) > 0 ? (
            <>
              <h1 style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 600, fontSize: 30,
                lineHeight: 1.15, letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}>
                {idleHeading}
              </h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>
                {boxes > 0 ? boxesSummary : arrowsSummary}
              </p>
            </>
          ) : (
            <>
              <h1 style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 600, fontSize: 30,
                lineHeight: 1.15, letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}>Your code obeys the drawing</h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>
                Every import follows an arrow you drew. Etch it to make the drawing a rule.
              </p>
            </>
          )}
        </div>

        {/* running layer */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", gap: 10,
          ...headRun,
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontWeight: 600, fontSize: 30,
            lineHeight: 1.15, letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}>Making it so</h1>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)", fontSize: 13,
            color: "var(--muted)", fontVariantNumeric: "tabular-nums",
          }}>
            <span>{clock}</span>
            <span style={{ color: "var(--subtle)" }}>·</span>
            <span>agent mode</span>
            {/* Live runs learn the cost only from Bob's final result event: show the cap until then */}
            <CoinChip>
              {coins === null ? <>max <b>1</b> Bobcoin</> : <><b><CountUp target={coins} /></b> of 1 Bobcoin</>}
            </CoinChip>
          </div>
          {/* Progress bar — motion #14 */}
          <div style={{
            height: 2,
            background: "var(--hover)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              height: 2,
              background: "var(--ink)",
              transformOrigin: "left",
              transform: `scaleX(${prog})`,
              transition: "transform 300ms var(--ease-out)",
            }} />
          </div>
        </div>

        {/* done layer */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", gap: 10,
          ...headDone,
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontWeight: 600, fontSize: 30,
            lineHeight: 1.15, letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}>Your code obeys the drawing</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>
            {doneText}
            {/* remount on phase change so the chip pops in when the cost is revealed */}
            <CoinChip key={phase} pop>
              <b><CountUp target={coins} /></b> Bobcoin
            </CoinChip>
          </p>
        </div>

        {/* etched layer */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", gap: 10,
          ...headEtched,
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontWeight: 600, fontSize: 30,
            lineHeight: 1.15, letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}>Etched</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>
            Every pull request is now checked against this drawing. No AI in that check, no cost.
          </p>
        </div>
      </div>

      {/* 2. Violation rows */}
      <Rows state={state} onHover={onHover} />

      {/* 3. Flexible log / written-files */}
      <LogPanel state={state} simulated={simulated} />

      {/* 4 + 5 share a dock: display:contents on desktop, one sticky bar on phones */}
      <div className="rail-dock">
      {/* 4. Action slot — motion #3 */}
      <div className="action-slot" style={{
        position: "relative",
        height: 92,
        flexShrink: 0,
        margin: "16px 28px 0",
      }}>
        {/* idle with rows: Make it so */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", gap: 10,
          ...ctaIdle,
        }}>
          <button
            className="press cta"
            onClick={onMakeItSo}
            style={{
              height: 46,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10,
              border: 0, borderRadius: "var(--r-control)",
              background: "var(--ink)", color: "#FFFFFF",
              font: "500 16px var(--font-ui)",
              cursor: "pointer",
            }}
          >
            Make it so
            <kbd className="kbd-hint" style={{
              padding: "1px 6px",
              border: "1px solid #3A3A3A",
              borderRadius: "var(--r-code)",
              fontFamily: "var(--font-mono)",
              fontSize: 12, color: "var(--faint)",
            }}>Ctrl ↵</kbd>
          </button>
          {phase === "error" ? (
            <button
              className="press ghost"
              onClick={onUndo}
              style={{
                height: 36, padding: "0 14px",
                border: "1px solid var(--rule)", borderRadius: "var(--r-control)",
                background: "var(--surface)", color: "var(--body)",
                font: "500 14px var(--font-ui)", cursor: "pointer",
              }}
            >Undo changes</button>
          ) : (
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
              IBM Bob refactors on a new branch, reruns your tests, then Etch rescans.
            </span>
          )}
        </div>

        {/* idle with 0 rows: empty */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          ...ctaIdleEmpty,
        }} />

        {/* running: Stop */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", gap: 12,
          ...ctaRun,
        }}>
          <button
            className="press ghost"
            onClick={onStop}
            style={{
              height: 36, padding: "0 14px",
              border: "1px solid var(--rule)", borderRadius: "var(--r-control)",
              background: "var(--surface)", color: "var(--body)",
              font: "500 14px var(--font-ui)", cursor: "pointer",
            }}
          >Stop</button>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>
            Changes land on{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--body)" }}>
              etch/make-it-so
            </span>
            , never on main.
          </span>
        </div>

        {/* done: caption */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center",
          ...ctaDone,
        }}>
          <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
            All clear on{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--body)" }}>
              etch/make-it-so
            </span>
            . Etch it writes the contracts, a Bob skill and a PR check.
          </span>
        </div>

        {/* etched: Open pull request */}
        <div className="layer" style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 8,
          ...ctaEtched,
        }}>
          <button
            className="press cta"
            onClick={prPending ? undefined : onOpenPr}
            disabled={prPending}
            style={{
              height: 46,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: 0, borderRadius: "var(--r-control)",
              background: "var(--ink)", color: "#FFFFFF",
              font: "500 16px var(--font-ui)",
              cursor: prPending ? "not-allowed" : "pointer",
              opacity: prPending ? 0.7 : 1,
            }}
          >{prPending ? "Opening…" : "Open pull request"}</button>
          {prMessage && (
            <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>
              {prMessage}
            </span>
          )}
        </div>
      </div>

      {/* 5. Footer — Etch it — motion #18 */}
      <div className="rail-footer" style={{
        padding: "16px 28px 20px",
        borderTop: "1px solid var(--rule)",
        marginTop: 16,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          className="press"
          onClick={etchReady ? onEtchIt : undefined}
          disabled={!etchReady}
          style={{
            height: 36, padding: "0 14px",
            display: "flex", alignItems: "center", gap: 6,
            border: `1px solid ${etchBorder}`,
            borderRadius: "var(--r-control)",
            background: etchBg, color: etchFg,
            font: "500 14px var(--font-ui)",
            cursor: etchReady ? "pointer" : "default",
            transition: "background-color 200ms ease, color 200ms ease, border-color 200ms ease",
          }}
        >
          {etchLabel}
        </button>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{etchHint}</span>
      </div>
      </div>
    </aside>
  );
}
