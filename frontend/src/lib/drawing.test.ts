import { describe, expect, it } from "vitest";
import type { ArchGraph } from "../types";
import {
  BOX_HEIGHT,
  BOX_WIDTH,
  FONT_NUNITO,
  adoptionPlan,
  boxId,
  boxSkeleton,
  drawingFromElements,
  isPackageName,
  drawingOfGraph,
  layerOfBox,
  layoutLayers,
  notesFromElements,
  rebindForAdoption,
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

  it("draws one clean, white, 10px-rounded, labelled Nunito rectangle per layer at the layout position", () => {
    const api = scene.find((e) => e.id === "etch-box-api")!;
    expect(api).toMatchObject({
      type: "rectangle",
      x: 80,
      y: 80,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
      strokeColor: "#111111",
      backgroundColor: "#ffffff",
      fillStyle: "solid",
      roughness: 0,
      roundness: { type: 3, value: 10 },
      label: { text: "api", fontSize: 24, fontFamily: FONT_NUNITO },
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
    expect(apiDb.roughness).toBe(0);
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
      new_boxes: [],
    });
  });
});

describe("notesFromElements", () => {
  it("turns free text and arrow labels into notes, skipping box labels and deleted text", () => {
    const b = (elementId: string) => ({ elementId });
    const elements = [
      { id: "etch-box-api", type: "rectangle" },
      { id: "etch-box-services", type: "rectangle" },
      { id: "box-label", type: "text", text: "api", containerId: "etch-box-api" },
      { id: "a1", type: "arrow", startBinding: b("etch-box-api"), endBinding: b("etch-box-services") },
      { id: "lbl", type: "text", text: "  all business logic goes through here  ", containerId: "a1" },
      { id: "free", type: "text", text: "legacy, don't touch", containerId: null },
      { id: "gone", type: "text", text: "deleted note", isDeleted: true },
      { id: "blank", type: "text", text: "   " },
      { id: "u1", type: "rectangle" },
      { id: "in-user-shape", type: "text", text: "cache layer?", containerId: "u1" },
      { id: "a2", type: "arrow", startBinding: b("etch-box-api"), endBinding: null },
      { id: "loose-lbl", type: "text", text: "half-drawn", containerId: "a2" },
    ];
    expect(notesFromElements(elements)).toEqual([
      { text: "all business logic goes through here", source: "api", target: "services" },
      { text: "legacy, don't touch", source: null, target: null },
      { text: "cache layer?", source: null, target: null },
      { text: "half-drawn", source: null, target: null },
    ]);
  });

  it("uses Excalidraw's unwrapped originalText and folds line breaks", () => {
    const b = (elementId: string) => ({ elementId });
    const elements = [
      { id: "etch-box-api", type: "rectangle" },
      { id: "etch-box-services", type: "rectangle" },
      { id: "a1", type: "arrow", startBinding: b("etch-box-api"), endBinding: b("etch-box-services") },
      { id: "l1", type: "text", text: "all business logic goes\nthere", originalText: "all business logic goes there", containerId: "a1" },
      { id: "n1", type: "text", text: "two\n  lines" },
    ];
    expect(notesFromElements(elements)).toEqual([
      { text: "all business logic goes there", source: "api", target: "services" },
      { text: "two lines", source: null, target: null },
    ]);
  });
});

// ---------- Task 8a: draw a box = new package ----------

const bind = (elementId: string) => ({ elementId, focus: 0.1, gap: 4 });

// services and db are real (scanned) boxes; the user drew a "pricing" box under them.
const SCENE = [
  { id: "etch-box-services", type: "rectangle" },
  { id: "etch-box-db", type: "rectangle" },
  { id: "r1", type: "rectangle" },
  // Excalidraw keeps what the user typed in originalText; text is the wrapped version
  { id: "t1", type: "text", containerId: "r1", text: "pricing\ndiscount math,\nno I/O", originalText: "pricing\ndiscount math, no I/O" },
  { id: "a1", type: "arrow", startBinding: bind("etch-box-services"), endBinding: bind("r1") },
  { id: "a1-lbl", type: "text", containerId: "a1", text: "pure functions only" },
  { id: "a2", type: "arrow", startBinding: bind("etch-box-db"), endBinding: bind("r1") },
  // not new boxes: uppercase name, no arrow, existing package name, duplicate name, deleted
  { id: "r2", type: "rectangle" },
  { id: "t2", type: "text", containerId: "r2", text: "Cache" },
  { id: "a3", type: "arrow", startBinding: bind("etch-box-db"), endBinding: bind("r2") },
  { id: "r3", type: "rectangle" },
  { id: "t3", type: "text", containerId: "r3", text: "queue" },
  { id: "r4", type: "rectangle" },
  { id: "t4", type: "text", containerId: "r4", text: "db" },
  { id: "a4", type: "arrow", startBinding: bind("etch-box-services"), endBinding: bind("r4") },
  { id: "r5", type: "rectangle" },
  { id: "t5", type: "text", containerId: "r5", text: "pricing" },
  { id: "a5", type: "arrow", startBinding: bind("etch-box-services"), endBinding: bind("r5") },
  { id: "r6", type: "rectangle", isDeleted: true },
  { id: "t6", type: "text", containerId: "r6", text: "search", isDeleted: true },
  { id: "a6", type: "arrow", startBinding: bind("etch-box-services"), endBinding: bind("r6") },
];

describe("isPackageName", () => {
  it("accepts lowercase Python package names only", () => {
    for (const ok of ["pricing", "_util2", "a"]) expect(isPackageName(ok)).toBe(true);
    for (const bad of ["Pricing", "9lives", "a-b", "a b", "", "class", "import", "a".repeat(41)]) {
      expect(isPackageName(bad)).toBe(false);
    }
  });
});

describe("new boxes in drawingFromElements", () => {
  it("a named box with an arrow to a code box is a new package; its arrows are rules", () => {
    expect(drawingFromElements(SCENE)).toEqual({
      layers: ["db", "services"],
      arrows: [
        { source: "db", target: "pricing" },
        { source: "services", target: "pricing" },
      ],
      new_boxes: [{ id: "pricing", intent: "discount math, no I/O" }],
    });
  });

  it("the first line is the name, the rest (folded to one line) is the intent", () => {
    const scene = [
      { id: "etch-box-api", type: "rectangle" },
      { id: "r", type: "rectangle" },
      { id: "t", type: "text", containerId: "r", text: "  audit  \n\n  who did\n what  " },
      { id: "a", type: "arrow", startBinding: bind("r"), endBinding: bind("etch-box-api") },
    ];
    expect(drawingFromElements(scene)).toEqual({
      layers: ["api"],
      arrows: [{ source: "audit", target: "api" }],
      new_boxes: [{ id: "audit", intent: "who did what" }],
    });
  });
});

describe("notes around new boxes", () => {
  it("a new box's own text is not a note; rejected boxes' text still is", () => {
    expect(notesFromElements(SCENE)).toEqual([
      { text: "pure functions only", source: "services", target: "pricing" },
      { text: "Cache", source: null, target: null },
      { text: "queue", source: null, target: null },
      { text: "db", source: null, target: null },
      { text: "pricing", source: null, target: null },
    ]);
  });

  it("a built box keeps its intent as a note named after the package", () => {
    const scene = [
      { id: "etch-box-api", type: "rectangle" },
      { id: "etch-box-pricing", type: "rectangle", customData: { etchIntent: "discount math, no I/O" } },
      { id: "lbl", type: "text", containerId: "etch-box-pricing", text: "pricing" },
      { id: "n", type: "text", text: "later: tax rules" },
    ];
    expect(notesFromElements(scene)).toEqual([
      { text: "pricing: discount math, no I/O", source: null, target: null },
      { text: "later: tax rules", source: null, target: null },
    ]);
  });
});

describe("adopting a new box once Bob built the package", () => {
  it("plans one adoption per new box whose package now exists", () => {
    expect(adoptionPlan(SCENE, ["db", "pricing", "services"])).toEqual([
      { name: "pricing", rectId: "r1", textId: "t1", intent: "discount math, no I/O", arrowIds: ["a1", "a2"] },
    ]);
    expect(adoptionPlan(SCENE, ["db", "services"])).toEqual([]);
  });

  it("retires the drawn box and its text and rebinds its arrows to the code box, without mutating", () => {
    const plan = adoptionPlan(SCENE, ["db", "pricing", "services"]);
    const before = JSON.stringify(SCENE);
    const out = rebindForAdoption(SCENE, plan) as Array<Record<string, any>>;
    expect(JSON.stringify(SCENE)).toBe(before);
    expect(out).toHaveLength(SCENE.length);
    const byId = (id: string) => out.find((e) => e.id === id)!;
    expect(byId("r1").isDeleted).toBe(true);
    expect(byId("t1").isDeleted).toBe(true);
    expect(byId("a1").endBinding).toEqual({ elementId: "etch-box-pricing", focus: 0.1, gap: 4 });
    expect(byId("a1").startBinding).toEqual(bind("etch-box-services"));
    expect(byId("a2").endBinding.elementId).toBe("etch-box-pricing");
    expect(byId("r2")).toBe(SCENE.find((e) => e.id === "r2")); // untouched elements are reused as-is
  });
});

describe("boxSkeleton", () => {
  it("is the code box sceneSkeleton draws, at any position and size", () => {
    expect(boxSkeleton("pricing", { x: 1, y: 2, width: 300, height: 120 })).toMatchObject({
      type: "rectangle",
      id: "etch-box-pricing",
      x: 1,
      y: 2,
      width: 300,
      height: 120,
      label: { text: "pricing", fontFamily: FONT_NUNITO },
    });
    const api = (sceneSkeleton(DEMO) as Array<Record<string, any>>).find((e) => e.id === "etch-box-api");
    expect(api).toEqual(boxSkeleton("api", { x: 80, y: 80, width: BOX_WIDTH, height: BOX_HEIGHT }));
  });
});
