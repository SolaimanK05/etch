import type { ArchGraph, Drawing } from "../types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";

// 6 is FONT_FAMILY.Nunito in @excalidraw/excalidraw 0.18
export const BOX_PREFIX = "etch-box-";
export const BOX_WIDTH = 220;
export const BOX_HEIGHT = 96;
export const FONT_NUNITO = 6;

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
      strokeWidth: 2,
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

  // One arrow per dependency
  for (const dep of graph.dependencies) {
    const { source: s, target: t } = dep;
    const sPos = posMap[s] ?? layout[s];
    const tPos = posMap[t] ?? layout[t];
    const sx = sPos.x + BOX_WIDTH / 2;
    const sy = sPos.y + BOX_HEIGHT / 2;
    const tx = tPos.x + BOX_WIDTH / 2;
    const ty = tPos.y + BOX_HEIGHT / 2;
    const dx = tx - sx;
    const dy = ty - sy;

    let points: number[][];
    if (depSet.has(`${t}>${s}`)) {
      // Bidirectional: add a bent midpoint
      const len = Math.sqrt(dx * dx + dy * dy);
      const px = len > 0 ? -dy / len : 0;
      const py = len > 0 ? dx / len : 0;
      points = [
        [0, 0],
        [dx / 2 + px * 28, dy / 2 + py * 28],
        [dx, dy],
      ];
    } else {
      points = [[0, 0], [dx, dy]];
    }

    elements.push({
      type: "arrow",
      id: `etch-arrow-${s}-${t}`,
      x: sx,
      y: sy,
      points: points as [number, number][],
      start: { id: boxId(s) },
      end: { id: boxId(t) },
      strokeColor: "#111111",
      strokeWidth: 2,
      roughness: 1,
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
