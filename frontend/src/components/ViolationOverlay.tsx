import type { State } from "../lib/state";
import { edgeCounts, knownEdges } from "../lib/state";
import { edgeGeometry, type Rect } from "../lib/geometry";
import { ViolationMarkerDefs } from "./Icons";

interface ViewState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** NEW on a drawn box that will become a package; CREATED once Bob built it (DESIGN.md §6, §12). */
export interface BoxTag {
  name: string;
  rect: Rect;
  kind: "new" | "created";
  visible: boolean;
}

interface Props {
  state: State;
  boxRects: Record<string, Rect>;
  tags?: BoxTag[];
  view: ViewState;
  containerRect: DOMRect | null;
  onHover: (edge: string | null) => void;
}

/**
 * ViolationOverlay (DESIGN.md §6, motion #17).
 * An SVG over the Excalidraw area. Everything is drawn in scene coordinates
 * inside one <g transform="scale(zoom) translate(scrollX scrollY)">, so the red
 * arrows, pills and box subtitles pan and zoom exactly like the drawing.
 * The SVG itself ignores the pointer; only the 18px hit paths catch it.
 */
export function ViolationOverlay({ state, boxRects, tags = [], view, containerRect, onHover }: Props) {
  if (!containerRect) return null;

  const counts = edgeCounts(state);
  const edges = knownEdges(state);
  const { scrollX, scrollY, zoom } = view;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 3,
        overflow: "visible",
      }}
      aria-hidden="true"
    >
      <ViolationMarkerDefs />
      <g transform={`scale(${zoom}) translate(${scrollX} ${scrollY})`}>
        {/* Box subtitles: module · N files */}
        {state.graph?.layers.map((layer) => {
          const rect = boxRects[layer.id];
          if (!rect) return null;
          return (
            <text
              key={layer.id}
              x={rect.x + rect.width / 2}
              y={rect.y + rect.height - 18}
              textAnchor="middle"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, fill: "var(--muted)" }}
            >
              {layer.module} · {layer.files} {layer.files === 1 ? "file" : "files"}
            </text>
          );
        })}

        {/* NEW / CREATED tags straddle the box's top-right corner */}
        {tags.map((t) => {
          const created = t.kind === "created";
          const w = created ? 84 : 52;
          return (
            <g key={`tag-${t.name}`} style={{ opacity: t.visible ? 1 : 0, transition: "opacity 400ms ease" }}>
              <rect
                x={t.rect.x + t.rect.width - w + 10}
                y={t.rect.y - 12}
                width={w}
                height={24}
                rx={12}
                strokeDasharray={created ? undefined : "3 2.5"}
                style={{
                  fill: created ? "var(--obeys-bg)" : "var(--hover)",
                  stroke: created ? "transparent" : "var(--muted)",
                  strokeWidth: 1,
                  transition: "fill 240ms var(--ease-out), stroke 240ms var(--ease-out)",
                }}
              />
              <text
                x={t.rect.x + t.rect.width - w / 2 + 10}
                y={t.rect.y + 4}
                textAnchor="middle"
                letterSpacing="0.6"
                style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 500, fill: created ? "var(--obeys)" : "var(--muted)" }}
              >
                {created ? "CREATED" : "NEW"}
              </text>
            </g>
          );
        })}

        {/* Violation edges: kept mounted so a healed arrow can fade out */}
        {edges.map((ek) => {
          const [src, tgt] = ek.split(">") as [string, string];
          const from = boxRects[src];
          const to = boxRects[tgt];
          if (!from || !to) return null;

          const count = counts[ek] ?? 0;
          const hovered = state.hover === ek;
          const g = edgeGeometry(from, to);
          const label = count === 1 ? "1 import" : `${count} imports`;
          const pillW = count === 1 ? 72 : 80;

          return (
            <g key={ek} style={{ opacity: count > 0 ? 1 : 0, transition: "opacity 240ms ease" }}>
              <path
                d={g.d}
                fill="none"
                strokeDasharray="7 7"
                strokeLinecap="round"
                markerEnd="url(#pRed)"
                style={{
                  stroke: "var(--violation)",
                  strokeWidth: hovered ? 3.4 : 2,
                  transition: "stroke-width 120ms ease",
                }}
              />
              <path
                d={g.d}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                style={{ pointerEvents: count > 0 ? "stroke" : "none", cursor: "pointer" }}
                onMouseEnter={() => onHover(ek)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onHover(state.hover === ek ? null : ek)}
              />
              <rect
                x={g.mid.x - pillW / 2}
                y={g.mid.y - 12}
                width={pillW}
                height={24}
                rx={12}
                style={{ fill: "var(--violation-bg)" }}
              />
              <text
                x={g.mid.x}
                y={g.mid.y + 4}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, fill: "var(--violation)" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
