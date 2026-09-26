import type { State, Row } from "../lib/state";
import { edgeKey } from "../lib/state";
import { CheckIcon } from "./Icons";

interface RowsProps {
  state: State;
  onHover: (edge: string | null) => void;
}

/**
 * Rows — violation list.
 * Motion #4: rows persist across phases.
 * Motion #5: 4-state icon stack.
 * Motion #7: strike line, path color, code opacity.
 * Motion #8: stagger on mount (keyed off rowsEpoch).
 * Motion #9: hover background.
 */
export function Rows({ state, onHover }: RowsProps) {
  const { rows, rowsEpoch, hover, phase } = state;
  const boxRows = newBoxRows(state);

  if (rows.length === 0 && boxRows.length === 0) return null;

  return (
    <ul style={{
      listStyle: "none",
      margin: 0,
      padding: "0 12px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      overflowY: "auto",
      // with a new-box row the list can outgrow the rail: scroll it, never squash Bob's log
      minHeight: 0,
      flexShrink: 1,
    }}>
      {boxRows.map((b) => <BoxRow key={`box:${b.id}`} row={b} />)}
      {rows.map((row: Row, i: number) => {
        const st = row.status;
        const ek = edgeKey(row.source, row.target);
        const isHovered = hover === ek;
        const isFixed = st === "fixed";

        const bgColor = isHovered && !isFixed
          ? "var(--row-hover-violation)"
          : "var(--surface)";

        // Icon states
        const iconOpacity = {
          open:   st === "open"   ? 1 : 0,
          queued: st === "queued" ? 1 : 0,
          fixing: st === "fixing" ? 1 : 0,
          fixed:  st === "fixed"  ? 1 : 0,
        };
        const iconScale = {
          open:   st === "open"   ? 1 : 0.9,
          queued: st === "queued" ? 1 : 0.9,
          fixing: st === "fixing" ? 1 : 0.9,
          fixed:  st === "fixed"  ? 1 : 0.9,
        };

        const pathColor = isFixed ? "var(--muted)" : "var(--ink)";
        // de-emphasise fixed code by colour, not opacity, so it stays readable (7:1)
        const codeColor = isFixed ? "var(--muted)" : "var(--body)";
        const strikeScaleX = isFixed ? 1 : 0;

        // Touch: toggle on click, hover on mouse
        function handleMouseEnter() { onHover(ek); }
        function handleMouseLeave() { onHover(null); }

        return (
          <li
            key={`${rowsEpoch}:${row.key}`}
            className={phase === "idle" || phase === "scanning" ? "rowIn" : undefined}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => onHover(isHovered ? null : ek)}
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--rule)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              backgroundColor: bgColor,
              transition: "background-color 120ms ease",
              animationDelay: `${i * 40}ms`,
              cursor: "default",
            }}
          >
            {/* Row header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Status icon slot */}
              <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                {/* open: red dot */}
                <span style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: iconOpacity.open,
                  transform: `scale(${iconScale.open})`,
                  transition: "opacity 150ms ease, transform 150ms var(--ease-out)",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "var(--r-pill)",
                    background: "var(--violation)",
                  }} />
                </span>

                {/* queued: grey ring */}
                <span style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: iconOpacity.queued,
                  transform: `scale(${iconScale.queued})`,
                  transition: "opacity 150ms ease, transform 150ms var(--ease-out)",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "var(--r-pill)",
                    border: "1.5px solid var(--faint)",
                    boxSizing: "border-box",
                  }} />
                </span>

                {/* fixing: pulsing amber dot */}
                <span style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: iconOpacity.fixing,
                  transform: `scale(${iconScale.fixing})`,
                  transition: "opacity 150ms ease, transform 150ms var(--ease-out)",
                }}>
                  <span className="pulse" style={{
                    width: 8, height: 8, borderRadius: "var(--r-pill)",
                    background: "var(--working)",
                  }} />
                </span>

                {/* fixed: green check disc */}
                <span style={{
                  position: "absolute", inset: 0,
                  borderRadius: "var(--r-pill)",
                  background: "var(--obeys-bg)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--obeys)",
                  opacity: iconOpacity.fixed,
                  transform: `scale(${iconScale.fixed})`,
                  transition: "opacity 150ms ease, transform 150ms var(--ease-out)",
                }}>
                  <CheckIcon />
                </span>
              </span>

              {/* Path */}
              <span style={{
                position: "relative",
                display: "flex",
                minWidth: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                fontWeight: 500,
                color: pathColor,
                transition: "color 180ms ease",
                whiteSpace: "nowrap",
              }}>
                {/* long paths ellipsize; the :line number always stays visible */}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{row.path}</span>
                <span style={{ color: "var(--muted)", flexShrink: 0 }}>:{row.line}</span>
                {/* Strike line — motion #7 */}
                <span style={{
                  position: "absolute",
                  left: 0, right: 0,
                  top: "50%",
                  height: 1,
                  background: "var(--faint)",
                  transformOrigin: "left",
                  transform: `scaleX(${strikeScaleX})`,
                  transition: "transform 200ms var(--ease-out)",
                }} />
              </span>

              <span style={{ flexGrow: 1 }} />

              {/* Right label stack (140px slot) */}
              <span className="row-label-slot" style={{ position: "relative", height: 20, flexShrink: 0 }}>
                {/* open: rule pill */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 0,
                  padding: "2px 8px",
                  borderRadius: "var(--r-pill)",
                  background: "var(--violation-bg)",
                  color: "var(--violation)",
                  fontSize: 12, fontWeight: 500,
                  whiteSpace: "nowrap",
                  opacity: iconOpacity.open,
                }}>
                  {/* the path already starts with the source layer, so narrow rails drop it */}
                  <span className="rule-src">{row.source} </span>↛ {row.target}
                </span>
                {/* queued */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 2,
                  fontSize: 13, color: "var(--muted)",
                  opacity: iconOpacity.queued,
                }}>queued</span>
                {/* fixing */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 2,
                  fontSize: 13, color: "var(--working)",
                  opacity: iconOpacity.fixing,
                }}>fixing</span>
                {/* fixed */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 2,
                  fontSize: 13, color: "var(--obeys)",
                  opacity: iconOpacity.fixed,
                }}>fixed</span>
              </span>
            </div>

            {/* Code block */}
            <code style={{
              display: "block",
              padding: "6px 8px",
              borderRadius: "var(--r-code)",
              background: "var(--code-bg)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: codeColor,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "color 180ms ease",
            }}>
              {row.code}
            </code>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- New-box rows (DESIGN.md §12): drawn boxes Bob builds into packages ----------

interface BoxRowData {
  id: string;
  intent: string;
  status: "new" | "building" | "created";
  detail: string | null; // "shop/pricing/ · 2 files" once built
}

function newBoxRows(state: State): BoxRowData[] {
  const root = state.graph?.root_package ?? "";
  const built = state.builtBoxes.map((b) => {
    const files = state.graph?.layers.find((l) => l.id === b.id)?.files ?? 0;
    return { id: b.id, intent: b.intent, status: "created" as const, detail: `${root}/${b.id}/ · ${files} ${files === 1 ? "file" : "files"}` };
  });
  const pending = state.drawing.new_boxes
    .filter((b) => !state.builtBoxes.some((x) => x.id === b.id))
    .map((b) => ({
      id: b.id,
      intent: b.intent,
      status: state.phase === "running" ? ("building" as const) : ("new" as const),
      detail: null,
    }));
  return [...built, ...pending];
}

const BOX_LABEL = {
  new: { text: "new package", color: "var(--muted)" },
  building: { text: "building…", color: "var(--working)" },
  created: { text: "created", color: "var(--obeys)" },
};

function BoxRow({ row }: { row: BoxRowData }) {
  const label = BOX_LABEL[row.status];
  const created = row.status === "created";
  return (
    <li style={{ padding: "12px 16px", borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 18, height: 18, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {created ? (
            <CheckIcon />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              className={row.status === "building" ? "pulse" : undefined}
              style={{ stroke: row.status === "building" ? "var(--working)" : "var(--muted)" }}
              strokeWidth="2" strokeDasharray="3.5 3">
              <rect x="3" y="5" width="18" height="14" rx="3" />
            </svg>
          )}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.id}
        </span>
        <span style={{ flexGrow: 1 }} />
        <span style={{ fontSize: 13, color: label.color, whiteSpace: "nowrap", transition: "color 200ms ease" }}>{label.text}</span>
      </div>
      <code style={{
        display: "block",
        padding: "6px 8px",
        borderRadius: "var(--r-code)",
        background: "var(--code-bg)",
        fontFamily: created ? "var(--font-mono)" : "var(--font-ui)",
        fontSize: created ? 13 : 14,
        color: created ? "var(--muted)" : row.intent ? "var(--body)" : "var(--subtle)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {created ? row.detail : row.intent || "no description"}
      </code>
    </li>
  );
}
