import { describe, expect, it } from "vitest";
import { optimizeOrder, type OptNode } from "@/lib/optimizerCore";
import { haversineMeters } from "@/lib/geo";

function nodes(coords: [string, number, number][]): OptNode[] {
  return coords.map(([id, lat, lng]) => ({ id, lat, lng }));
}

function totalPts(pts: OptNode[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += haversineMeters(pts[i - 1], pts[i]);
  return t;
}

describe("optimizeOrder", () => {
  it("returns every selected stop exactly once, anchored at node 0", () => {
    const n = nodes([
      ["A", 23.78, 90.41],
      ["B", 23.79, 90.42],
      ["C", 23.72, 90.39],
      ["D", 23.75, 90.45],
    ]);
    const r = optimizeOrder(n, { budgetMs: 500 });
    expect(new Set(r.order)).toEqual(new Set(["A", "B", "C", "D"]));
    expect(r.order).toHaveLength(4);
    expect(r.order[0]).toBe("A");
  });

  it("never produces a worse route than the input order (Dhaka zigzag)", () => {
    const n = nodes([
      ["A", 23.72, 90.4],
      ["B", 23.8, 90.41],
      ["C", 23.73, 90.4],
      ["D", 23.81, 90.41],
      ["E", 23.74, 90.4],
    ]);
    const naive = totalPts(n);
    const r = optimizeOrder(n, { budgetMs: 800 });
    const byId = new Map(n.map((x) => [x.id, x]));
    const optimized = totalPts(r.order.map((id) => byId.get(id) as OptNode));
    expect(optimized).toBeLessThanOrEqual(naive);
    expect(r.improved).toBe(true);
  });

  it("pins the final stop when requested", () => {
    const n = nodes([
      ["S", 23.7, 90.4],
      ["B", 23.71, 90.41],
      ["C", 23.72, 90.42],
      ["Z", 23.9, 90.6],
    ]);
    const r = optimizeOrder(n, { pinEnd: true, budgetMs: 500 });
    expect(r.order[r.order.length - 1]).toBe("Z");
    expect(r.order[0]).toBe("S");
  });

  it("handles degenerate inputs", () => {
    expect(optimizeOrder([], {}).order).toEqual([]);
    const single = optimizeOrder(nodes([["X", 1, 1]]), {});
    expect(single.order).toEqual(["X"]);
    expect(single.totalM).toBe(0);
  });

  it("respects bounded execution time", () => {
    const many: [string, number, number][] = [];
    for (let i = 0; i < 40; i++) many.push([`n${i}`, 23.7 + (i % 7) * 0.02, 90.4 + (i % 5) * 0.03]);
    const start = Date.now();
    optimizeOrder(nodes(many), { budgetMs: 300, maxIterations: 100 });
    expect(Date.now() - start).toBeLessThan(1500);
  });
});
