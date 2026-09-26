import { describe, expect, it } from "vitest";
import { TOOLS, TOOL_GROUPS, isAllowedTool, stepZoom, zoomAround, zoomLabel } from "./canvasControls";

describe("toolbar tools", () => {
  it("offers seven tools in three groups, with Excalidraw's own shortcut keys", () => {
    expect(TOOLS.map((t) => `${t.label} ${t.key}`)).toEqual([
      "Select V", "Pan H", "Box R", "Arrow A", "Note T", "Pen P", "Eraser E",
    ]);
    expect(TOOL_GROUPS.flat()).toEqual(TOOLS.map((t) => t.type));
  });

  it("anything else Excalidraw can reach by shortcut is not allowed", () => {
    expect(isAllowedTool("rectangle")).toBe(true);
    for (const t of ["diamond", "ellipse", "line", "laser", "image", "frame", "embeddable"]) {
      expect(isAllowedTool(t)).toBe(false);
    }
  });
});

describe("zoom", () => {
  it("steps by 10% and clamps to 10%..3000%", () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1.1, -1)).toBe(1);
    expect(stepZoom(0.1, -1)).toBe(0.1);
    expect(stepZoom(30, 1)).toBe(30);
  });

  it("keeps the scene point under the anchor still", () => {
    const view = { scrollX: 10, scrollY: -20, zoom: 1 };
    const anchor = { x: 400, y: 300 };
    const next = zoomAround(view, 2, anchor);
    const scene = (v: typeof view) => ({ x: anchor.x / v.zoom - v.scrollX, y: anchor.y / v.zoom - v.scrollY });
    expect(next.zoom).toBe(2);
    expect(scene(next).x).toBeCloseTo(scene(view).x);
    expect(scene(next).y).toBeCloseTo(scene(view).y);
  });

  it("labels as a whole percentage", () => {
    expect(zoomLabel(1)).toBe("100%");
    expect(zoomLabel(1.4641)).toBe("146%");
  });
});
