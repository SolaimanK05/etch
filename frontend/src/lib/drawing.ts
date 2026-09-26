import type { ArchGraph, Drawing, NewBox, Note } from "../types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import { center, exitPoint, type Point } from "./geometry";

// 6 is FONT_FAMILY.Nunito in @excalidraw/excalidraw 0.18
export const BOX_PREFIX = "etch-box-";
export const BOX_WIDTH = 220;
export const BOX_HEIGHT = 96;
export const FONT_NUNITO = 6;

// DESIGN.md §6 (v2): clean shapes, no wobble; arrows leave a little air at the box border
const STROKE = 1.5;
export const BOX_RADIUS = 10;
const ARROW_GAP = 8;
const BEND = 36;

// Python keywords (3.x)
const PYTHON_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield",
]);

/** True when `name` is a valid lowercase Python package name (not a keyword, max 40 chars). */
export function isPackageName(name: string): boolean {
  if (!name || name.length > 40) return false;
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) return false;
  if (PYTHON_KEYWORDS.has(name)) return false;
  return true;
}

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

/** Return the rectangle skeleton for a single code box at the given position/size. */
export function boxSkeleton(
  layer: string,
  rect: { x: number; y: number; width: number; height: number },
): ExcalidrawElementSkeleton {
  return {
    type: "rectangle",
    id: boxId(layer),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    strokeColor: "#111111",
    backgroundColor: "#ffffff",
    fillStyle: "solid",
    strokeWidth: STROKE,
    roughness: 0,
    roundness: { type: 3, value: BOX_RADIUS }, // ROUNDNESS.ADAPTIVE_RADIUS with a fixed 10px
    label: {
      text: layer,
      fontSize: 24,
      fontFamily: FONT_NUNITO,
      strokeColor: "#111111",
    },
  } as ExcalidrawElementSkeleton;
}

export function sceneSkeleton(
  graph: ArchGraph,
  positions?: Positions,
): ExcalidrawElementSkeleton[] {
  const layout = layoutLayers(graph);
  const posMap = positions ? { ...layout, ...positions } : layout;

  const elements: ExcalidrawElementSkeleton[] = [];

  // One rectangle per layer — delegate to boxSkeleton
  for (const layer of graph.layers) {
    const pos = posMap[layer.id] ?? layout[layer.id];
    elements.push(boxSkeleton(layer.id, { x: pos.x, y: pos.y, width: BOX_WIDTH, height: BOX_HEIGHT }));
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
      roughness: 0,
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
    new_boxes: [],
  };
}

export interface SceneElementLike {
  id: string;
  type: string;
  isDeleted?: boolean;
  startBinding?: { elementId: string; [k: string]: unknown } | null;
  endBinding?: { elementId: string; [k: string]: unknown } | null;
  text?: string;
  originalText?: string; // Excalidraw keeps the unwrapped text here
  containerId?: string | null;
  customData?: Record<string, unknown> | null;
  version?: number;
}

/** Exported interface for adoption plan entries. */
export interface Adoption {
  name: string;
  rectId: string;
  textId: string | null;
  intent: string;
  arrowIds: string[];
}

/** Private: find qualifying new boxes in scene order.
 *
 * A qualifying new box is a live rectangle (not an etch box) whose first text line
 * is a valid package name, is not already a code box layer, and has at least one
 * live arrow connecting it to a live code box.
 */
function findNewBoxes(elements: SceneElementLike[]): Array<{
  rectId: string;
  textId: string | null;
  name: string;
  intent: string;
}> {
  // 1. Collect live code box layers
  const liveCodeBoxLayers = new Set<string>();
  for (const el of elements) {
    if (!el.isDeleted && el.type === "rectangle") {
      const layer = layerOfBox(el.id);
      if (layer !== null) liveCodeBoxLayers.add(layer);
    }
  }

  // 2. Build map: containerId -> first live text element in scene order
  const containerTextMap = new Map<string, SceneElementLike>();
  for (const el of elements) {
    if (el.isDeleted || el.type !== "text" || !el.containerId) continue;
    if (!containerTextMap.has(el.containerId)) {
      containerTextMap.set(el.containerId, el);
    }
  }

  // 3. Build set of live rect ids connected to a live code box by a live arrow (either side)
  const rectsWithCodeBoxArrow = new Set<string>();
  for (const el of elements) {
    if (el.isDeleted || el.type !== "arrow") continue;
    if (!el.startBinding || !el.endBinding) continue;
    const sId = el.startBinding.elementId;
    const eId = el.endBinding.elementId;
    const sIsCodeBox = layerOfBox(sId) !== null && liveCodeBoxLayers.has(layerOfBox(sId)!);
    const eIsCodeBox = layerOfBox(eId) !== null && liveCodeBoxLayers.has(layerOfBox(eId)!);
    if (sIsCodeBox) rectsWithCodeBoxArrow.add(eId);
    if (eIsCodeBox) rectsWithCodeBoxArrow.add(sId);
  }

  // 4. Walk elements in scene order, collect candidate rects
  const result: Array<{ rectId: string; textId: string | null; name: string; intent: string }> = [];
  const seenNames = new Set<string>();

  for (const el of elements) {
    if (el.isDeleted || el.type !== "rectangle") continue;
    // Skip etch code boxes
    if (layerOfBox(el.id) !== null) continue;

    // Get label text
    const textEl = containerTextMap.get(el.id) ?? null;
    const raw = (textEl ? (textEl.originalText ?? textEl.text ?? "") : "");
    const lines = raw.split("\n");
    const name = lines[0].trim();
    const intent = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();

    // Check qualification
    if (!isPackageName(name)) continue;
    if (liveCodeBoxLayers.has(name)) continue;
    if (seenNames.has(name)) continue;
    if (!rectsWithCodeBoxArrow.has(el.id)) continue;

    seenNames.add(name);
    result.push({ rectId: el.id, textId: textEl?.id ?? null, name, intent });
  }

  return result;
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

  // Find qualifying new boxes
  const newBoxCandidates = findNewBoxes(elements);
  const newBoxRectIds = new Map(newBoxCandidates.map((c) => [c.rectId, c.name]));

  const new_boxes: NewBox[] = newBoxCandidates.map((c) => ({ id: c.name, intent: c.intent }));

  // Helper: resolve element id to a name (code box layer or qualifying new box name)
  function resolveName(elementId: string): string | null {
    const layer = layerOfBox(elementId);
    if (layer !== null && liveBoxes.has(layer)) return layer;
    const newName = newBoxRectIds.get(elementId);
    return newName ?? null;
  }

  // Live arrows: both endpoints map to a name, no self-arrows, deduped, sorted by (source, target)
  const seen = new Set<string>();
  const arrowList: Array<{ source: string; target: string }> = [];

  for (const el of elements) {
    if (el.isDeleted || el.type !== "arrow") continue;
    if (!el.startBinding || !el.endBinding) continue;
    const src = resolveName(el.startBinding.elementId);
    const tgt = resolveName(el.endBinding.elementId);
    if (src === null || tgt === null) continue;
    if (src === tgt) continue;
    const key = `${src}>${tgt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    arrowList.push({ source: src, target: tgt });
  }

  arrowList.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

  return { layers, arrows: arrowList, new_boxes };
}

export function notesFromElements(elements: SceneElementLike[]): Note[] {
  // Build set of live etch box ids
  const liveBoxIds = new Set<string>();
  for (const el of elements) {
    if (!el.isDeleted && el.type === "rectangle" && el.id.startsWith(BOX_PREFIX)) {
      liveBoxIds.add(el.id);
    }
  }

  // Find qualifying new boxes and their rect ids / text ids
  const newBoxCandidates = findNewBoxes(elements);
  const newBoxTextIds = new Set(newBoxCandidates.map((c) => c.textId).filter((id): id is string => id !== null));
  const newBoxRectToName = new Map(newBoxCandidates.map((c) => [c.rectId, c.name]));

  // Build a map of arrow id -> {source, target} for arrows bound to two known names
  // (code boxes or new boxes)
  function resolveNameFull(elementId: string): string | null {
    const layer = layerOfBox(elementId);
    if (layer !== null && liveBoxIds.has(elementId)) return layer;
    const newName = newBoxRectToName.get(elementId);
    return newName ?? null;
  }

  const arrowNameMap = new Map<string, { source: string; target: string }>();
  for (const el of elements) {
    if (el.isDeleted || el.type !== "arrow") continue;
    if (!el.startBinding || !el.endBinding) continue;
    const src = resolveNameFull(el.startBinding.elementId);
    const tgt = resolveNameFull(el.endBinding.elementId);
    if (src !== null && tgt !== null) {
      arrowNameMap.set(el.id, { source: src, target: tgt });
    }
  }

  // Build notes in a single pass in scene order.
  // etchIntent notes are emitted at the rectangle's own position in scene order.
  const finalNotes: Note[] = [];
  for (const el of elements) {
    if (el.isDeleted) continue;

    if (el.type === "rectangle") {
      // Built etch box with etchIntent
      if (el.id.startsWith(BOX_PREFIX)) {
        const layer = layerOfBox(el.id)!;
        const intent = el.customData?.etchIntent;
        if (typeof intent === "string" && intent.length > 0) {
          finalNotes.push({ text: `${layer}: ${intent}`, source: null, target: null });
        }
      }
    } else if (el.type === "text") {
      const text = (el.originalText ?? el.text ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      // Skip box labels (contained in an etch box)
      if (el.containerId && liveBoxIds.has(el.containerId)) continue;
      // Skip text that is a label of a qualifying new box
      if (newBoxTextIds.has(el.id)) continue;
      // Arrow label on a known arrow
      if (el.containerId && arrowNameMap.has(el.containerId)) {
        const { source, target } = arrowNameMap.get(el.containerId)!;
        finalNotes.push({ text, source, target });
      } else {
        finalNotes.push({ text, source: null, target: null });
      }
    }
  }

  return finalNotes;
}

/** Return adoption plan: one entry per qualifying new box whose name is in layerIds. */
export function adoptionPlan(elements: readonly SceneElementLike[], layerIds: string[]): Adoption[] {
  const layerSet = new Set(layerIds);
  const candidates = findNewBoxes(elements as SceneElementLike[]);

  // For each candidate whose name is in layerIds, collect arrow ids
  const result: Adoption[] = [];
  for (const c of candidates) {
    if (!layerSet.has(c.name)) continue;

    // Collect arrow ids where either binding is on the rect, in scene order
    const arrowIds: string[] = [];
    for (const el of elements) {
      if (el.isDeleted || el.type !== "arrow") continue;
      if (!el.startBinding || !el.endBinding) continue;
      if (el.startBinding.elementId === c.rectId || el.endBinding.elementId === c.rectId) {
        arrowIds.push(el.id);
      }
    }

    result.push({ name: c.name, rectId: c.rectId, textId: c.textId, intent: c.intent, arrowIds });
  }

  return result;
}

/** Return a new array with each plan's drawn rect and text deleted, and arrows rebound to the code box. */
export function rebindForAdoption<T extends SceneElementLike>(elements: readonly T[], plan: Adoption[]): T[] {
  if (plan.length === 0) return elements as T[];

  const retiredRects = new Set(plan.map((p) => p.rectId));
  const retiredTexts = new Set(plan.flatMap((p) => p.textId ? [p.textId] : []));
  // Map: old rect id -> new box id
  const rectToBoxId = new Map(plan.map((p) => [p.rectId, boxId(p.name)]));
  const arrowsToRebind = new Map<string, Adoption>();
  for (const p of plan) {
    for (const aid of p.arrowIds) {
      arrowsToRebind.set(aid, p);
    }
  }

  return elements.map((el) => {
    if (retiredRects.has(el.id) || retiredTexts.has(el.id)) {
      return { ...el, isDeleted: true, version: (el.version ?? 1) + 1 };
    }
    if (arrowsToRebind.has(el.id)) {
      const p = arrowsToRebind.get(el.id)!;
      const newBoxElementId = rectToBoxId.get(p.rectId)!;
      let changed = false;
      let newStart = el.startBinding;
      let newEnd = el.endBinding;
      if (el.startBinding && el.startBinding.elementId === p.rectId) {
        newStart = { ...el.startBinding, elementId: newBoxElementId };
        changed = true;
      }
      if (el.endBinding && el.endBinding.elementId === p.rectId) {
        newEnd = { ...el.endBinding, elementId: newBoxElementId };
        changed = true;
      }
      if (!changed) return el;
      return { ...el, startBinding: newStart, endBinding: newEnd, version: (el.version ?? 1) + 1 };
    }
    return el;
  });
}
