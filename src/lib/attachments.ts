// IndexedDB-backed attachment storage. Keeps Blobs out of localStorage.
// Each attachment has a uuid id; receipts reference these ids by metadata.

const DB_NAME = "sciorio-hq-attachments";
const STORE = "files";
const DB_VERSION = 1;

export interface AttachmentMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  addedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB non disponibile"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid(): string {
  return "att_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function putAttachment(file: File): Promise<AttachmentMeta> {
  const db = await openDb();
  const id = uid();
  const blob = new Blob([await file.arrayBuffer()], { type: file.type });
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return { id, name: file.name, type: file.type, size: file.size, addedAt: new Date().toISOString() };
}

export async function getAttachmentUrl(id: string): Promise<string | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(id);
    r.onsuccess = () => res(r.result as Blob | undefined);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return blob ? URL.createObjectURL(blob) : null;
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function downloadAttachment(meta: AttachmentMeta): Promise<void> {
  const url = await getAttachmentUrl(meta.id);
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = meta.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
