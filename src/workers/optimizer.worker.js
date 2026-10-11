/**
 * Self-contained optimizer worker — loaded via `new Worker(Blob)` so it works in
 * single-file PWA builds. Plain JS on purpose. Mirrors src/lib/optimizerCore.ts.
 * Message in:  { nodes: [{id,lat,lng}...], pinEnd, budgetMs }
 * Message out: { order: [ids...], totalM, iterations, improved }
 */
const R = 6371000;

function hav(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function optimize(nodes, pinEnd, budgetMs, maxIterations) {
  const n = nodes.length;
  const budget = budgetMs || 2500;
  const maxIter = maxIterations || 250;
  if (n <= 2) {
    return {
      order: nodes.map((x) => x.id),
      totalM: n === 2 ? hav(nodes[0], nodes[1]) : 0,
      iterations: 0,
      improved: false,
    };
  }
  const dist = [];
  for (let i = 0; i < n; i++) {
    dist[i] = new Float64Array(n);
    for (let j = i + 1; j < n; j++) {
      const d = hav(nodes[i], nodes[j]);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }
  const unvisited = new Set();
  for (let i = 1; i < n; i++) unvisited.add(i);
  const order = [0];
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
  const lastFreeIndex = pinEnd ? n - 2 : n - 1;
  const started = Date.now();
  let iterations = 0;
  let improved = false;
  let anyChange = true;
  while (anyChange && iterations < maxIter && Date.now() - started < budget) {
    anyChange = false;
    for (let i = 1; i < lastFreeIndex && Date.now() - started < budget; i++) {
      for (let j = i + 1; j <= lastFreeIndex; j++) {
        iterations++;
        const a = order[i - 1];
        const b = order[i];
        const c = order[j];
        const nextIdx = j + 1 < order.length ? order[j + 1] : -1;
        const before = dist[a][b] + (nextIdx >= 0 ? dist[c][nextIdx] : 0);
        const after = dist[a][c] + (nextIdx >= 0 ? dist[b][nextIdx] : 0);
        if (after + 0.5 < before) {
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
  for (let i = 1; i < order.length; i++) totalM += dist[order[i - 1]][order[i]];
  return { order: order.map((idx) => nodes[idx].id), totalM, iterations, improved };
}

self.onmessage = (event) => {
  const { nodes, pinEnd, budgetMs } = event.data || {};
  try {
    const result = optimize(nodes || [], !!pinEnd, budgetMs || 2500, 250);
    self.postMessage({ ok: true, ...result });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
