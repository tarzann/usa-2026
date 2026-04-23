"use client";

export type DayAttachment = {
  id: string;
  dayDate: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  file: Blob;
};

const DB_NAME = "trip-planner-files";
const STORE_NAME = "attachments";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("dayDate", "dayDate", { unique: false });
      }
    };
  });
}

export async function listAttachments(dayDate: string): Promise<DayAttachment[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("dayDate");
    const request = index.getAll(dayDate);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve((request.result as DayAttachment[]).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
    };
  });
}

export async function saveAttachments(dayDate: string, files: File[]) {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    files.forEach((file) => {
      const attachment: DayAttachment = {
        id: `${dayDate}-${crypto.randomUUID()}`,
        dayDate,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
        file,
      };
      store.put(attachment);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAttachment(id: string) {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
