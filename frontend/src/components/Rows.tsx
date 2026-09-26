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

  if (rows.length === 0) return null;

  return (
    <ul style={{
      listStyle: "none",
      margin: 0,
      padding: "0 12px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      overflowY: "auto",
    }}>
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
        const codeOpacity = isFixed ? 0.5 : 1;
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
                fontSize: 13,
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
                  fontSize: 11, fontWeight: 500,
                  whiteSpace: "nowrap",
                  opacity: iconOpacity.open,
                }}>
                  {/* the path already starts with the source layer, so narrow rails drop it */}
                  <span className="rule-src">{row.source} </span>↛ {row.target}
                </span>
                {/* queued */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 2,
                  fontSize: 12, color: "var(--muted)",
                  opacity: iconOpacity.queued,
                }}>queued</span>
                {/* fixing */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 2,
                  fontSize: 12, color: "var(--working)",
                  opacity: iconOpacity.fixing,
                }}>fixing</span>
                {/* fixed */}
                <span className="layer" style={{
                  position: "absolute", right: 0, top: 2,
                  fontSize: 12, color: "var(--obeys)",
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
              fontSize: 12,
              color: "var(--body)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              opacity: codeOpacity,
              transition: "opacity 180ms ease",
            }}>
              {row.code}
            </code>
          </li>
        );
      })}
    </ul>
  );
}
