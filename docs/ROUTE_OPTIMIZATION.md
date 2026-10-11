# Route optimization

Implementation: `src/lib/optimizerCore.ts` (pure, unit-tested) executed inside
`src/workers/optimizer.worker.js` (Blob-loaded so it survives the single-file build;
main-thread fallback + 9 s watchdog in `src/lib/optimize.ts`).

## Algorithm

1. **Distance matrix** — haversine meters between all selected stops + start node.
2. **Seed** — nearest-neighbour from the anchor (start location if set, else the
   first selected stop).
3. **Improve** — classic **2-Opt** with the anchor index pinned (and the final stop
   optionally pinned), with a 0.5 m improvement epsilon, ≤250 segment passes and a
   wall-clock budget (2.8 s) — whichever comes first.

## Objective & honesty

- Default objective is total haversine distance; when the routing provider succeeds,
  road-network metrics refine the *estimate*, while the *order* comes from the
  heuristic. Because 2-Opt is a local-search heuristic over a metric approximation,
  the app **never claims global optimality** — the UI labels results as estimates.
- All selected, resolvable stops are guaranteed present **exactly once** in the
  returned order (enforced by construction + tests). Unresolvable records are skipped
  with an explicit warning — never silently dropped from your plan list.

## Limits

- Planner cap: **40 stops** (responsive matrix + UX). Larger selections should be
  split (a staged/k-means split pass is a documented future enhancement).
- Start options: first selected stop, or device GPS (permission-gated). Custom map
  pins and a final destination are supported by the engine/UI seams (`start`,
  `pinEnd`) and exposed progressively.
- Optimization is provider-independent: it runs identically offline.

## Testing hooks

`src/lib/__tests__/optimizer.test.ts` verifies exact-set preservation, anchoring,
end pinning, non-worsening vs naive order on a zigzag case, degenerate inputs and
bounded runtime.
