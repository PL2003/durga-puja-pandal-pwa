/**
 * Local-first persistence: IndexedDB is the only home of imported mandap records,
 * saved routes, source configuration and preferences. Nothing is uploaded anywhere.
 */
import type { Mandap, SavedRoute, SourceMeta } from "@/types";

const DB_NAME = "pandal-hop";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export class StorageError extends Error {}

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("sources")) {
        db.createObjectStore("sources", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("mandaps")) {
        const store = db.createObjectStore("mandaps", { keyPath: "id" });
        store.createIndex("by-source", "sourceId", { unique: false });
        store.createIndex("by-name", "nameKey", { unique: false });
        store.createIndex("by-record", ["sourceId", "recordKey"], { unique: true });
        store.createIndex("by-lat", "lat", { unique: false });
      }
      if (!db.objectStoreNames.contains("routes")) {
        db.createObjectStore("routes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("prefs")) {
        db.createObjectStore("prefs", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new StorageError(req.error?.message || "Failed to open local database"));
    req.onblocked = () => reject(new StorageError("Database blocked by another tab. Close other tabs and retry."));
  });
  return dbPromise;
}

function isQuota(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function wrapTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(isQuota(tx.error) ? new StorageError("Device storage is full. Free up space and retry the import.") : new StorageError(tx.error?.message || "Transaction aborted"));
    tx.onerror = () =>
      reject(isQuota(tx.error) ? new StorageError("Device storage is full. Free up space and retry the import.") : new StorageError(tx.error?.message || "Database error"));
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new StorageError(req.error?.message || "Database request failed"));
  });
}

/* ---------------- sources ---------------- */

export async function listSources(): Promise<SourceMeta[]> {
  const db = await open();
  const all = await reqAsPromise(db.transaction("sources", "readonly").objectStore("sources").getAll() as IDBRequest<SourceMeta[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putSource(meta: SourceMeta): Promise<void> {
  const db = await open();
  const tx = db.transaction("sources", "readwrite");
  tx.objectStore("sources").put(meta);
  await wrapTx(tx);
}

export async function deleteSource(id: string, deleteRecords: boolean): Promise<void> {
  const db = await open();
  const stores = deleteRecords ? ["sources", "mandaps"] : ["sources"];
  const tx = db.transaction(stores, "readwrite");
  tx.objectStore("sources").delete(id);
  if (deleteRecords) {
    const idx = tx.objectStore("mandaps").index("by-source");
    const keys = await reqAsPromise(idx.getAllKeys(id));
    for (const key of keys) tx.objectStore("mandaps").delete(key);
  }
  await wrapTx(tx);
}

/* ---------------- mandaps ---------------- */

export async function listAllMandaps(): Promise<Mandap[]> {
  const db = await open();
  return reqAsPromise(db.transaction("mandaps", "readonly").objectStore("mandaps").getAll() as IDBRequest<Mandap[]>);
}

export async function countMandapsFor(sourceId: string): Promise<number> {
  const db = await open();
  return reqAsPromise(db.transaction("mandaps", "readonly").objectStore("mandaps").index("by-source").count(sourceId));
}

export async function mandapKeysFor(sourceId: string): Promise<{
  keys: IDBValidKey[];
  records: string[];
}> {
  const db = await open();
  const idx = db.transaction("mandaps", "readonly").objectStore("mandaps").index("by-source");
  const keys = await reqAsPromise(idx.getAllKeys(sourceId));
  const recs = await reqAsPromise(idx.getAll(sourceId) as IDBRequest<Mandap[]>);
  return { keys, records: recs.map((m) => m.recordKey) };
}

/**
 * Transactionally replace every record owned by a source with a freshly validated
 * dataset, and update the source metadata in the same transaction.
 */
export async function replaceSourceMandaps(sourceId: string, mandaps: Mandap[], meta: SourceMeta): Promise<{ added: number; updated: number; removed: number }> {
  const db = await open();
  const { keys, records } = await mandapKeysFor(sourceId);
  const oldByRecord = new Map(records.map((r, i) => [r, keys[i]]));
  const newKeys = new Set(mandaps.map((m) => m.recordKey));

  const tx = db.transaction(["mandaps", "sources"], "readwrite");
  const store = tx.objectStore("mandaps");
  // removals: old records absent from the new dataset
  let removed = 0;
  for (const [recordKey, idbKey] of oldByRecord) {
    if (!newKeys.has(recordKey)) {
      store.delete(idbKey);
      removed++;
    }
  }
  let updated = 0;
  for (const m of mandaps) {
    if (oldByRecord.has(m.recordKey)) updated++;
    store.put(m);
  }
  tx.objectStore("sources").put(meta);
  await wrapTx(tx);
  return { added: mandaps.length - updated, updated, removed };
}

export async function clearDbMandaps(): Promise<void> {
  const db = await open();
  const tx = db.transaction("mandaps", "readwrite");
  tx.objectStore("mandaps").clear();
  await wrapTx(tx);
}

/* ---------------- routes ---------------- */

export async function listRoutes(): Promise<SavedRoute[]> {
  const db = await open();
  const all = await reqAsPromise(db.transaction("routes", "readonly").objectStore("routes").getAll() as IDBRequest<SavedRoute[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putRoute(route: SavedRoute): Promise<void> {
  const db = await open();
  const tx = db.transaction("routes", "readwrite");
  tx.objectStore("routes").put(route);
  await wrapTx(tx);
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction("routes", "readwrite");
  tx.objectStore("routes").delete(id);
  await wrapTx(tx);
}

/* ---------------- preferences ---------------- */

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const db = await open();
  const row = await reqAsPromise(db.transaction("prefs", "readonly").objectStore("prefs").get(key) as IDBRequest<{ key: string; value: T } | undefined>);
  return row ? row.value : fallback;
}

export async function setPref<T>(key: string, value: T): Promise<void> {
  const db = await open();
  const tx = db.transaction("prefs", "readwrite");
  tx.objectStore("prefs").put({ key, value });
  await wrapTx(tx);
}
