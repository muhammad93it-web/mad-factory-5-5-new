import { openDB, type IDBPDatabase } from "idb";

export type OutboxItem = {
  id?: number;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB_NAME = "mad-factory-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function addToOutbox(item: Omit<OutboxItem, "id" | "createdAt" | "attempts">) {
  const db = await getDB();
  const full: OutboxItem = { ...item, createdAt: Date.now(), attempts: 0 };
  return db.add("outbox", full);
}

export async function getOutbox(): Promise<OutboxItem[]> {
  const db = await getDB();
  return db.getAll("outbox");
}

export async function removeOutboxItem(id: number) {
  const db = await getDB();
  return db.delete("outbox", id);
}

export async function updateOutboxItem(item: OutboxItem) {
  const db = await getDB();
  return db.put("outbox", item);
}

export async function getOutboxCount(): Promise<number> {
  const db = await getDB();
  return db.count("outbox");
}

export async function setCache(key: string, value: unknown) {
  const db = await getDB();
  return db.put("cache", { key, value, ts: Date.now() });
}

export async function getCache<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = await db.get("cache", key);
  return row?.value as T | undefined;
}
