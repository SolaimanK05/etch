import { describe, expect, it } from "vitest";
import type { ArchGraph } from "../types";
import {
  BOX_HEIGHT,
  BOX_WIDTH,
  FONT_NUNITO,
  boxId,
  drawingFromElements,
  drawingOfGraph,
  layerOfBox,
  layoutLayers,
  sceneSkeleton,
} from "./drawing";

const dep = (source: string, target: string) => ({ source, target, imports: [] });

// The real demo-app dependency graph (see backend/tests/test_demo_app.py)
const DEMO: ArchGraph = {
  root_package: "shop",
  layers: ["api", "db", "notifications", "services"].map((id) => ({ id, module: `shop.${id}`, files: 2 })),
  dependencies: [
    dep("api", "db"),
    dep("api", "notifications"),
    dep("api", "services"),
    dep("db", "services"),
    dep("notifications", "db"),
    dep("services", "db"),
    dep("services", "notifications"),
  ],
};

describe("box ids", () => {
  it("round-trips layer <-> element id", () => {
    expect(boxId("api")).toBe("etch-box-api");
    expect(layerOfBox("etch-box-api")).toBe("api");
    expect(layerOfBox("something-else")).toBeNull();
  });
});

describe("layoutLayers", () => {
  it("orders by (out-degree - in-degree) desc, then id, on a staggered grid", () => {
    // scores: api 3, services 0, notifications -1, db -2 ; 4 boxes -> 2 columns
    expect(layoutLayers(DEMO)).toEqual({
      api: { x: 80, y: 80 },
      services: { x: 440, y: 80 },
      notifications: { x: 260, y: 300 },
      db: { x: 620, y: 300 },
    });
  });
  it("uses one row for up to 3 boxes", () => {
    const g: ArchGraph = { root_package: "p", layers: [{ id: "a", module: "p.a", files: 1 }, { id: "b", module: "p.b", files: 1 }], dependencies: [dep("a", "b")] };
    expect(layoutLayers(g)).toEqual({ a: { x: 80, y: 80 }, b: { x: 440, y: 80 } });
  });
});

describe("sceneSkeleton", () => {
  const scene = sceneSkeleton(DEMO) as Array<Record<string, any>>;

  it("draws one labelled Nunito rectangle per layer at the layout position", () => {
    const api = scene.find((e) => e.id === "etch-box-api")!;
    expect(api).toMatchObject({
      type: "rectangle",
      x: 80,
      y: 80,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
      strokeColor: "#111111",
      backgroundColor: "transparent",
      label: { text: "api", fontSize: 22, fontFamily: FONT_NUNITO },
    });
    expect(FONT_NUNITO).toBe(6);
    expect(scene.filter((e) => e.type === "rectangle")).toHaveLength(4);
  });

  it("draws one bound arrow per real dependency; reverse pairs get a bent middle point", () => {
    const arrows = scene.filter((e) => e.type === "arrow");
    expect(arrows).toHaveLength(7);
    const apiDb = arrows.find((e) => e.id === "etch-arrow-api-db")!;
    expect(apiDb.start).toEqual({ id: "etch-box-api" });
    expect(apiDb.end).toEqual({ id: "etch-box-db" });
    expect(apiDb.points).toHaveLength(2);
    // services <-> db exist in both directions
    expect(arrows.find((e) => e.id === "etch-arrow-services-db")!.points).toHaveLength(3);
    expect(arrows.find((e) => e.id === "etch-arrow-db-services")!.points).toHaveLength(3);
  });

  it("honours saved positions", () => {
    const moved = sceneSkeleton(DEMO, { api: { x: 5, y: 7 } }) as Array<Record<string, any>>;
    expect(moved.find((e) => e.id === "etch-box-api")).toMatchObject({ x: 5, y: 7 });
    expect(moved.find((e) => e.id === "etch-box-db")).toMatchObject({ x: 620, y: 300 });
  });
});

describe("drawingOfGraph", () => {
  it("allows every real dependency, so the first scan has zero violations", () => {
    const d = drawingOfGraph(DEMO);
    expect(d.layers).toEqual(["api", "db", "notifications", "services"]);
    expect(d.arrows).toHaveLength(7);
    expect(d.arrows[0]).toEqual({ source: "api", target: "db" });
  });
});

describe("drawingFromElements", () => {
  it("reads live etch boxes and bound arrows, ignoring everything else", () => {
    const b = (elementId: string) => ({ elementId });
    const elements = [
      { id: "etch-box-api", type: "rectangle" },
      { id: "etch-box-db", type: "rectangle" },
      { id: "etch-box-services", type: "rectangle", isDeleted: true },
      { id: "user-rect", type: "rectangle" },
      { id: "t1", type: "text" },
      { id: "a1", type: "arrow", startBinding: b("etch-box-api"), endBinding: b("etch-box-db") },
      { id: "a2", type: "arrow", startBinding: b("etch-box-api"), endBinding: b("etch-box-services") },
      { id: "a3", type: "arrow", isDeleted: true, startBinding: b("etch-box-db"), endBinding: b("etch-box-api") },
      { id: "a4", type: "arrow", startBinding: b("etch-box-api"), endBinding: null },
      { id: "a5", type: "arrow", startBinding: b("etch-box-api"), endBinding: b("etch-box-db") },
      { id: "a6", type: "arrow", startBinding: b("etch-box-db"), endBinding: b("etch-box-db") },
      { id: "l1", type: "line", startBinding: b("etch-box-db"), endBinding: b("etch-box-api") },
    ];
    expect(drawingFromElements(elements)).toEqual({
      layers: ["api", "db"],
      arrows: [{ source: "api", target: "db" }],
    });
  });
});
