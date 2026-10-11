/**
 * Runs the optimizer in a Web Worker (Blob-based so it survives single-file PWA
 * builds). Falls back to main-thread execution if workers are unavailable or the
 * worker fails — the UI never freezes either way.
 */
import workerRaw from "@/workers/optimizer.worker.js?raw";
import { optimizeOrder, type OptNode, type OptResult } from "@/lib/optimizerCore";

let blobUrl: string | null = null;

function getWorker(): Worker | null {
  try {
    if (!blobUrl) {
      blobUrl = URL.createObjectURL(new Blob([workerRaw], { type: "application/javascript" }));
    }
    return new Worker(blobUrl);
  } catch {
    return null;
  }
}

export function runOptimizer(
  nodes: OptNode[],
  opts: { pinEnd?: boolean; budgetMs?: number } = {}
): Promise<OptResult> {
  return new Promise((resolve) => {
    const worker = getWorker();
    if (!worker) {
      resolve(optimizeOrder(nodes, opts));
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      resolve(optimizeOrder(nodes, { ...opts, budgetMs: 1200 }));
    }, 9000);
    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      worker.terminate();
      const data = event.data as { ok?: boolean; order?: string[]; totalM?: number; iterations?: number; improved?: boolean };
      if (data && data.ok && Array.isArray(data.order)) {
        resolve({
          order: data.order,
          totalM: Number(data.totalM ?? 0),
          iterations: Number(data.iterations ?? 0),
          improved: !!data.improved,
        });
      } else {
        resolve(optimizeOrder(nodes, opts));
      }
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve(optimizeOrder(nodes, opts));
    };
    worker.postMessage({ nodes, pinEnd: !!opts.pinEnd, budgetMs: opts.budgetMs ?? 2500 });
  });
}
