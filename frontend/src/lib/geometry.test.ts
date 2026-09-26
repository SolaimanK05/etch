import { describe, expect, it } from "vitest";
import { center, edgeGeometry, exitPoint } from "./geometry";

const A = { x: 0, y: 0, width: 100, height: 50 };
const B = { x: 300, y: 0, width: 100, height: 50 };

describe("exitPoint", () => {
  it("leaves through the side facing the target", () => {
    expect(exitPoint(A, { x: 350, y: 25 })).toEqual({ x: 100, y: 25 });
  });
  it("handles diagonals by hitting the nearer edge", () => {
    expect(exitPoint(A, { x: 150, y: 125 })).toEqual({ x: 75, y: 50 });
  });
  it("returns the centre when the target is the centre", () => {
    expect(exitPoint(A, center(A))).toEqual({ x: 50, y: 25 });
  });
});

describe("edgeGeometry", () => {
  it("builds a quadratic path from border to border with gaps and a left bend", () => {
    const g = edgeGeometry(A, B);
    expect(g.start).toEqual({ x: 106, y: 25 });
    expect(g.end).toEqual({ x: 290, y: 25 });
    expect(g.control.x).toBeCloseTo(198);
    expect(g.control.y).toBeCloseTo(58.12);
    expect(g.mid.x).toBeCloseTo(198);
    expect(g.mid.y).toBeCloseTo(41.56);
    expect(g.d).toBe("M106 25 Q198 58.1 290 25");
  });
  it("bends the reverse edge to the other side so A->B and B->A never overlap", () => {
    const g = edgeGeometry(B, A);
    expect(g.control.y).toBeCloseTo(25 - 33.12);
  });
  it("respects custom bend and gaps", () => {
    const g = edgeGeometry(A, B, { bend: 0, startGap: 0, endGap: 0 });
    expect(g.d).toBe("M100 25 Q200 25 300 25");
  });
});
