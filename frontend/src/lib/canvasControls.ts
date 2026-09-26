/**
 * Etch's own canvas controls (DESIGN.md §6 v2): which Excalidraw tools the
 * toolbar offers, and the zoom maths behind the zoom buttons.
 */

export type ToolType = "selection" | "hand" | "rectangle" | "arrow" | "text" | "freedraw" | "eraser";

export interface ToolDef {
  type: ToolType;
  label: string;
  key: string;      // Excalidraw's own shortcut, shown on the button
  hint?: string;    // extra tooltip text after the key
}

export const TOOLS: ToolDef[] = [
  { type: "selection", label: "Select", key: "V" },
  { type: "hand", label: "Pan", key: "H", hint: "or hold Space" },
  { type: "rectangle", label: "Box", key: "R" },
  { type: "arrow", label: "Arrow", key: "A", hint: "box to box = rule" },
  { type: "text", label: "Note", key: "T" },
  { type: "freedraw", label: "Pen", key: "P" },
  { type: "eraser", label: "Eraser", key: "E" },
];

/** Toolbar groups; a divider goes between groups. */
export const TOOL_GROUPS: ToolType[][] = [
  ["selection", "hand"],
  ["rectangle", "arrow", "text", "freedraw"],
  ["eraser"],
];

const ALLOWED = new Set<string>(TOOLS.map((t) => t.type));

/** Tools reachable only through Excalidraw shortcuts (diamond, ellipse, line, laser…) are not ours. */
export function isAllowedTool(type: string): type is ToolType {
  return ALLOWED.has(type);
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;
export const ZOOM_FACTOR = 1.1;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** One zoom step in (+1) or out (-1), clamped, rounded to 3 decimals. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const next = dir > 0 ? zoom * ZOOM_FACTOR : zoom / ZOOM_FACTOR;
  return Math.round(clampZoom(next) * 1000) / 1000;
}

export interface View {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/**
 * Zoom to `nextZoom` keeping the scene point under `anchor` (viewport px) still.
 * Excalidraw maps viewport -> scene as scene = viewport / zoom - scroll.
 */
export function zoomAround(view: View, nextZoom: number, anchor: { x: number; y: number }): View {
  const zoom = clampZoom(nextZoom);
  return {
    zoom,
    scrollX: view.scrollX + anchor.x / zoom - anchor.x / view.zoom,
    scrollY: view.scrollY + anchor.y / zoom - anchor.y / view.zoom,
  };
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
