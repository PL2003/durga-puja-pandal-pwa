/**
 * Pure, provider-independent route optimizer (nearest-neighbour seed + 2-Opt).
 * Kept dependency-free so it can run in a Web Worker and in unit tests.
 * Distances are straight-line haversine meters; the routing provider refines the
 * chosen order into road geometry afterwards. Heuristic — no global-optimum claim.
 */

export interface OptNode {
  id: string;
  lat: number;
  lng: number;
}

export interface OptResult {
  order: string[];
  totalM: number;
  iterations: number;
  improved: boolean;
}

const R = 6371000;

function hav(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function optimizeOrder(
  nodes: OptNode[],
  opts: { pinEnd?: boolean; budgetMs?: number; maxIterations?: number } = {}
): OptResult {
  const n = nodes.length;
  const budget = opts.budgetMs ?? 2500;
  const maxIter = opts.maxIterations ?? 250;
  if (n <= 2) {
    return {
      order: nodes.map((x) => x.id),
      totalM: n === 2 ? hav(nodes[0], nodes[1]) : 0,
      iterations: 0,
      improved: false,
    };
  }

  // distance matrix
  const dist: Float64Array[] = [];
  for (let i = 0; i < n; i++) {
    dist[i] = new Float64Array(n);
    for (let j = i + 1; j < n; j++) {
      const d = hav(nodes[i], nodes[j]);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // node 0 is the anchor (start). nearest-neighbour seed.
  const unvisited = new Set<number>();
  for (let i = 1; i < n; i++) unvisited.add(i);
  const order: number[] = [0];
  let current = 0;
  while (unvisited.size > 0) {
    let best = -1;
    let bestD = Infinity;
    for (const c of unvisited) {
      const d = dist[current][c];
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    unvisited.delete(best);
    order.push(best);
    current = best;
  }

  const lastFreeIndex = opts.pinEnd ? n - 2 : n - 1;
  const started = Date.now();
  let iterations = 0;
  let improved = false;
  let anyChange = true;

  // 2-Opt improvements, index 0 pinned (start), optional pinned end.
  while (anyChange && iterations < maxIter && Date.now() - started < budget) {
    anyChange = false;
    for (let i = 1; i < lastFreeIndex && Date.now() - started < budget; i++) {
      for (let j = i + 1; j <= lastFreeIndex; j++) {
        iterations++;
        const a = order[i - 1];
        const b = order[i];
        const c = order[j];
        const afterJ = j + 1 < n ? order[j + 1] : -1;
        const before = dist[a][b] + (afterJ >= 0 ? dist[c][afterJ] : 0);
        const after = dist[a][c] + (afterJ >= 0 ? dist[b][afterJ] : 0);
        if (after + 0.5 < before) {
          // reverse segment [i..j]
          let lo = i;
          let hi = j;
          while (lo < hi) {
            const t = order[lo];
            order[lo] = order[hi];
            order[hi] = t;
            lo++;
            hi--;
          }
          anyChange = true;
          improved = true;
        }
      }
    }
  }

  let totalM = 0;
  for (let i = 1; i < n; i++) totalM += dist[order[i - 1]][order[i]];

  return { order: order.map((idx) => nodes[idx].id), totalM, iterations, improved };
}
