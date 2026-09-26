import { describe, expect, it } from "vitest";
import type { ArchGraph, Drawing, Violation } from "../types";
import {
  canEtch,
  edgeCounts,
  edgeKey,
  initialState,
  knownEdges,
  openCount,
  progress,
  reducer,
  rowsFromViolations,
  type Action,
  type State,
} from "./state";

const GRAPH: ArchGraph = {
  root_package: "shop",
  layers: ["api", "db", "notifications", "services"].map((id) => ({ id, module: `shop.${id}`, files: 2 })),
  dependencies: [],
};

// intended drawing: api -> services -> db, services -> notifications
const DRAWING: Drawing = {
  layers: ["api", "db", "notifications", "services"],
  arrows: [
    { source: "api", target: "services" },
    { source: "services", target: "db" },
    { source: "services", target: "notifications" },
  ],
};

const imp = (file: string, line: number, code = "import x") => ({ importer: "m", imported: "n", file, line, code });

const V: Violation[] = [
  { source: "api", target: "db", imports: [imp("shop/api/orders.py", 3, "from shop.db.orders_repo import get_order")] },
  { source: "api", target: "notifications", imports: [imp("shop/api/users.py", 8)] },
  { source: "notifications", target: "db", imports: [imp("shop/notifications/email.py", 4)] },
];

const run = (actions: Action[], from: State = initialState) => actions.reduce(reducer, from);

const idleWithViolations = () =>
  run([
    { type: "scanStarted", repoPath: "demo-app" },
    { type: "scanSucceeded", graph: GRAPH, drawing: DRAWING },
    { type: "checkSucceeded", violations: V },
  ]);

describe("rowsFromViolations", () => {
  it("makes one open row per import, keyed file:line, path without the root package", () => {
    const rows = rowsFromViolations(V, "shop");
    expect(rows.map((r) => [r.key, r.path, r.line, r.source, r.target, r.status])).toEqual([
      ["shop/api/orders.py:3", "api/orders.py", 3, "api", "db", "open"],
      ["shop/api/users.py:8", "api/users.py", 8, "api", "notifications", "open"],
      ["shop/notifications/email.py:4", "notifications/email.py", 4, "notifications", "db", "open"],
    ]);
    expect(rows[0].code).toBe("from shop.db.orders_repo import get_order");
  });
});

describe("scan and live check", () => {
  it("starts empty, scans, and lands in idle", () => {
    expect(initialState.phase).toBe("empty");
    const s1 = reducer(initialState, { type: "scanStarted", repoPath: "demo-app" });
    expect(s1.phase).toBe("scanning");
    expect(s1.scanning).toBe(true);
    const s2 = reducer(s1, { type: "scanSucceeded", graph: GRAPH, drawing: DRAWING });
    expect(s2.phase).toBe("idle");
    expect(s2.scanning).toBe(false);
    expect(s2.branch).toBe("main");
    expect(s2.rowsEpoch).toBe(s1.rowsEpoch + 1);
  });

  it("a rescan keeps the current phase while spinning", () => {
    const s = reducer(idleWithViolations(), { type: "scanStarted", repoPath: "demo-app" });
    expect(s.phase).toBe("idle");
    expect(s.scanning).toBe(true);
  });

  it("zero violations on idle means Etch it is enabled directly", () => {
    const s = run([
      { type: "scanSucceeded", graph: GRAPH, drawing: DRAWING },
      { type: "checkSucceeded", violations: [] },
    ]);
    expect(openCount(s)).toBe(0);
    expect(canEtch(s)).toBe(true);
  });

  it("violations become open rows; counts per edge drive the red arrows", () => {
    const s = idleWithViolations();
    expect(openCount(s)).toBe(3);
    expect(canEtch(s)).toBe(false);
    expect(edgeCounts(s)).toEqual({ "api>db": 1, "api>notifications": 1, "notifications>db": 1 });
    expect(knownEdges(s)).toEqual(["api>db", "api>notifications", "notifications>db"]);
    expect(edgeKey("api", "db")).toBe("api>db");
  });

  it("drawing an allowed arrow back removes its rows on the next check", () => {
    const s = run([{ type: "checkSucceeded", violations: V.slice(1) }], idleWithViolations());
    expect(s.rows.map((r) => r.key)).toEqual(["shop/api/users.py:8", "shop/notifications/email.py:4"]);
  });

  it("scan failure on first run stays on the empty screen with an error", () => {
    const s = run([{ type: "scanStarted", repoPath: "nope" }, { type: "scanFailed", error: "400: Not a directory: nope" }]);
    expect(s.phase).toBe("empty");
    expect(s.error).toBe("400: Not a directory: nope");
  });

  it("hover tracks one edge", () => {
    const s = reducer(idleWithViolations(), { type: "hover", edge: "api>db" });
    expect(s.hover).toBe("api>db");
    expect(reducer(s, { type: "hover", edge: null }).hover).toBeNull();
  });
});

describe("Make it so run (driven by task 5 SSE)", () => {
  const started = () => reducer(idleWithViolations(), { type: "runStarted", now: 1000 });

  it("queues every row and starts fixing the first", () => {
    const s = started();
    expect(s.phase).toBe("running");
    expect(s.branch).toBe("etch/make-it-so");
    expect(s.rows.map((r) => r.status)).toEqual(["fixing", "queued", "queued"]);
    expect(s.coins).toBeNull();
    expect(progress(s)).toBe(0);
  });

  it("ticks the clock only while running", () => {
    expect(reducer(started(), { type: "tick", now: 4500 }).elapsedMs).toBe(3500);
    expect(reducer(idleWithViolations(), { type: "tick", now: 4500 }).elapsedMs).toBe(0);
  });

  it("keeps the last 11 log lines", () => {
    let s = started();
    for (let i = 0; i < 14; i++) {
      s = reducer(s, { type: "runLog", line: { t: `00:${String(i).padStart(2, "0")}`, verb: "read", detail: `f${i}`, suf: "", tone: "muted" } });
    }
    expect(s.log).toHaveLength(11);
    expect(s.log[0].detail).toBe("f3");
    expect(s.log[10].detail).toBe("f13");
  });

  it("a rescan mid-run marks vanished rows fixed, moves 'fixing' on, and toasts the path via the drawn middle layer", () => {
    const s = reducer(started(), { type: "runViolations", violations: V.slice(1) });
    expect(s.rows.map((r) => r.status)).toEqual(["fixed", "fixing", "queued"]);
    // the count pill counts down during the run: queued + fixing still break the drawing
    expect(openCount(started())).toBe(3);
    expect(openCount(s)).toBe(2);
    expect(s.toast).toMatchObject({ path: "api/orders.py", msg: "now goes through services" });
    expect(progress(s)).toBeCloseTo(1 / 3);
    expect(edgeCounts(s)).toEqual({ "api>notifications": 1, "notifications>db": 1 });
    expect(knownEdges(s)).toEqual(["api>db", "api>notifications", "notifications>db"]);
    const seq = s.toast!.seq;
    const s2 = reducer(s, { type: "runViolations", violations: V.slice(2) });
    expect(s2.toast!.seq).toBe(seq + 1);
  });

  it("toast falls back when no drawn middle layer connects the two", () => {
    const s = reducer(started(), { type: "runViolations", violations: [V[0], V[1]] });
    expect(s.toast).toMatchObject({ path: "notifications/email.py", msg: "no longer crosses the drawing" });
  });

  it("finishing with zero open rows lands in done; Etch it unlocks", () => {
    const s = run(
      [
        { type: "runViolations", violations: [] },
        { type: "runFinished", coins: 0.64, durationMs: 41000 },
      ],
      started(),
    );
    expect(s.phase).toBe("done");
    expect(s.coins).toBe(0.64);
    expect(s.elapsedMs).toBe(41000);
    expect(canEtch(s)).toBe(true);
    expect(s.rows.every((r) => r.status === "fixed")).toBe(true);
  });

  it("finishing with rows left is an error; unfinished rows go back to open", () => {
    const s = run(
      [
        { type: "runViolations", violations: V.slice(1) },
        { type: "runFinished", coins: 0.3, durationMs: 20000 },
      ],
      started(),
    );
    expect(s.phase).toBe("error");
    expect(s.error).toBe("2 imports still break the drawing");
    expect(s.rows.map((r) => r.status)).toEqual(["fixed", "open", "open"]);
  });

  it("a failed run keeps fixed rows and reopens the rest", () => {
    const s = run(
      [
        { type: "runViolations", violations: V.slice(1) },
        { type: "runFailed", error: "pytest failed" },
      ],
      started(),
    );
    expect(s.phase).toBe("error");
    expect(s.error).toBe("pytest failed");
    expect(s.rows.map((r) => r.status)).toEqual(["fixed", "open", "open"]);
  });

  it("live checks are ignored while running", () => {
    const s = reducer(started(), { type: "checkSucceeded", violations: [] });
    expect(s.rows.map((r) => r.status)).toEqual(["fixing", "queued", "queued"]);
  });
});

describe("Etch it", () => {
  it("moves done -> etched with the written files", () => {
    const done = run(
      [
        { type: "runStarted", now: 0 },
        { type: "runViolations", violations: [] },
        { type: "runFinished", coins: 0.5, durationMs: 1 },
        { type: "etchSucceeded", written: [".importlinter"], importlinter: "[importlinter]\n" },
      ],
      idleWithViolations(),
    );
    expect(done.phase).toBe("etched");
    expect(done.written).toEqual([".importlinter"]);
    expect(canEtch(done)).toBe(false);
  });

  it("reset returns to the first-run screen", () => {
    expect(reducer(idleWithViolations(), { type: "reset" })).toEqual(initialState);
  });
});
