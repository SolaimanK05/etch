import type { ArchGraph, Drawing, Note } from "../types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { center, exitPoint, type Point } from "./geometry";

// 6 is FONT_FAMILY.Nunito in @excalidraw/excalidraw 0.18
export const BOX_PREFIX = "etch-box-";
export const BOX_WIDTH = 220;
export const BOX_HEIGHT = 96;
export const FONT_NUNITO = 6;

// DESIGN.md §6: stroke "1.7-ish", arrows leave a little air at the box border
const STROKE = 1.7;
const ARROW_GAP = 8;
const BEND = 36;

/** Move `p` toward `toward` by `by` pixels. */
function nudge(p: Point, toward: Point, by: number): Point {
  const dx = toward.x - p.x;
  const dy = toward.y - p.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len > 0 ? { x: p.x + (dx / len) * by, y: p.y + (dy / len) * by } : p;
}

export function boxId(layer: string): string {
  return BOX_PREFIX + layer;
}

export function layerOfBox(id: string): string | null {
  if (!id.startsWith(BOX_PREFIX)) return null;
  return id.slice(BOX_PREFIX.length);
}

type Position = { x: number; y: number };
type Positions = Record<string, Position>;

export function layoutLayers(graph: ArchGraph): Positions {
  // Compute out-degree and in-degree per layer
  const outDeg: Record<string, number> = {};
  const inDeg: Record<string, number> = {};
  for (const layer of graph.layers) {
    outDeg[layer.id] = 0;
    inDeg[layer.id] = 0;
  }
  // Use distinct pairs (one dep = one pair)
  for (const dep of graph.dependencies) {
    outDeg[dep.source] = (outDeg[dep.source] ?? 0) + 1;
    inDeg[dep.target] = (inDeg[dep.target] ?? 0) + 1;
  }

  // Sort by score descending, then id
  const sorted = graph.layers
    .map((l) => ({ id: l.id, score: (outDeg[l.id] ?? 0) - (inDeg[l.id] ?? 0) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const n = sorted.length;
  const cols = n <= 3 ? n : Math.ceil(Math.sqrt(n));

  const positions: Positions = {};
  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[sorted[i].id] = {
      x: 80 + col * 360 + (row % 2) * 180,
      y: 80 + row * 220,
    };
  }
  return positions;
}

export function sceneSkeleton(
  graph: ArchGraph,
  positions?: Positions,
): ExcalidrawElementSkeleton[] {
  const layout = layoutLayers(graph);
  const posMap = positions ? { ...layout, ...positions } : layout;

  const elements: ExcalidrawElementSkeleton[] = [];

  // One rectangle per layer
  for (const layer of graph.layers) {
    const pos = posMap[layer.id] ?? layout[layer.id];
    elements.push({
      type: "rectangle",
      id: boxId(layer.id),
      x: pos.x,
      y: pos.y,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
      strokeColor: "#111111",
      backgroundColor: "transparent",
      strokeWidth: STROKE,
      roughness: 1,
      label: {
        text: layer.id,
        fontSize: 22,
        fontFamily: FONT_NUNITO,
        strokeColor: "#111111",
      },
    } as ExcalidrawElementSkeleton);
  }

  // Build a set of all dependency pairs for bidirectional detection
  const depSet = new Set<string>();
  for (const dep of graph.dependencies) {
    depSet.add(`${dep.source}>${dep.target}`);
  }

  // One arrow per dependency. Endpoints sit on the box borders (Excalidraw keeps
  // explicit points even when the arrow is bound), leaving ARROW_GAP of air.
  for (const dep of graph.dependencies) {
    const { source: s, target: t } = dep;
    const sPos = posMap[s] ?? layout[s];
    const tPos = posMap[t] ?? layout[t];
    const sRect = { x: sPos.x, y: sPos.y, width: BOX_WIDTH, height: BOX_HEIGHT };
    const tRect = { x: tPos.x, y: tPos.y, width: BOX_WIDTH, height: BOX_HEIGHT };
    const sc = center(sRect);
    const tc = center(tRect);

    // Bidirectional pairs bend to opposite sides (perp = (-dy, dx)) so they never overlap
    let bendPoint: Point | null = null;
    if (depSet.has(`${t}>${s}`)) {
      const dx = tc.x - sc.x;
      const dy = tc.y - sc.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const px = len > 0 ? -dy / len : 0;
      const py = len > 0 ? dx / len : 0;
      bendPoint = { x: (sc.x + tc.x) / 2 + px * BEND, y: (sc.y + tc.y) / 2 + py * BEND };
    }

    const start = nudge(exitPoint(sRect, bendPoint ?? tc), bendPoint ?? tc, ARROW_GAP);
    const end = nudge(exitPoint(tRect, bendPoint ?? sc), bendPoint ?? sc, ARROW_GAP);
    const rel = (p: Point): [number, number] => [p.x - start.x, p.y - start.y];
    const points = bendPoint ? [rel(start), rel(bendPoint), rel(end)] : [rel(start), rel(end)];

    elements.push({
      type: "arrow",
      id: `etch-arrow-${s}-${t}`,
      x: start.x,
      y: start.y,
      points,
      start: { id: boxId(s) },
      end: { id: boxId(t) },
      strokeColor: "#111111",
      strokeWidth: STROKE,
      roughness: 1,
      roundness: { type: 2 }, // ROUNDNESS.PROPORTIONAL_RADIUS: smooth curve through the bend
      endArrowhead: "arrow",
    } as unknown as ExcalidrawElementSkeleton);
  }

  return elements;
}

export function drawingOfGraph(graph: ArchGraph): Drawing {
  return {
    layers: graph.layers.map((l) => l.id).sort(),
    arrows: graph.dependencies.map((d) => ({ source: d.source, target: d.target })),
  };
}

export interface SceneElementLike {
  id: string;
  type: string;
  isDeleted?: boolean;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  text?: string;
  containerId?: string | null;
}

export function drawingFromElements(elements: SceneElementLike[]): Drawing {
  // Live etch boxes
  const liveBoxes = new Set<string>();
  for (const el of elements) {
    if (!el.isDeleted && el.type === "rectangle") {
      const layer = layerOfBox(el.id);
      if (layer !== null) liveBoxes.add(layer);
    }
  }

  const layers = Array.from(liveBoxes).sort();

  // Live arrows: type === "arrow", not deleted, start+end both point at live etch boxes,
  // no self-arrows, deduplicated and sorted by (source, target)
  const seen = new Set<string>();
  const arrowList: Array<{ source: string; target: string }> = [];

  for (const el of elements) {
    if (el.isDeleted || el.type !== "arrow") continue;
    if (!el.startBinding || !el.endBinding) continue;
    const src = layerOfBox(el.startBinding.elementId);
    const tgt = layerOfBox(el.endBinding.elementId);
    if (src === null || tgt === null) continue;
    if (!liveBoxes.has(src) || !liveBoxes.has(tgt)) continue;
    if (src === tgt) continue;
    const key = `${src}>${tgt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    arrowList.push({ source: src, target: tgt });
  }

  arrowList.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

  return { layers, arrows: arrowList };
}

export function notesFromElements(elements: SceneElementLike[]): Note[] {
  // Build set of live etch box ids
  const liveBoxIds = new Set<string>();
  for (const el of elements) {
    if (!el.isDeleted && el.type === "rectangle" && el.id.startsWith(BOX_PREFIX)) {
      liveBoxIds.add(el.id);
    }
  }

  // Build a map of arrow id -> {source, target} for arrows bound to two live etch boxes
  const arrowEtchMap = new Map<string, { source: string; target: string }>();
  for (const el of elements) {
    if (el.isDeleted || el.type !== "arrow") continue;
    if (!el.startBinding || !el.endBinding) continue;
    const src = layerOfBox(el.startBinding.elementId);
    const tgt = layerOfBox(el.endBinding.elementId);
    if (src !== null && tgt !== null && liveBoxIds.has(el.startBinding.elementId) && liveBoxIds.has(el.endBinding.elementId)) {
      arrowEtchMap.set(el.id, { source: src, target: tgt });
    }
  }

  const notes: Note[] = [];
  for (const el of elements) {
    if (el.isDeleted || el.type !== "text") continue;
    const text = el.text?.trim() ?? "";
    if (!text) continue;
    // Skip box labels (contained in an etch box)
    if (el.containerId && liveBoxIds.has(el.containerId)) continue;
    // Arrow label on an etch arrow
    if (el.containerId && arrowEtchMap.has(el.containerId)) {
      const { source, target } = arrowEtchMap.get(el.containerId)!;
      notes.push({ text, source, target });
    } else {
      notes.push({ text, source: null, target: null });
    }
  }
  return notes;
}
