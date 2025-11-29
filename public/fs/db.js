// public/fs/db.js
export const DB_NAME = "IDEAL_IDE_FS";
export const STORE = "files";

export async function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "path" });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function dbWrite(path, content) {
  const d = await db();
  const tx = d.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({ path, content });
  return tx.complete;
}

export async function dbRead(path) {
  const d = await db();
  return new Promise((resolve) => {
    const tx = d.transaction(STORE, "readonly").objectStore(STORE).get(path);
    tx.onsuccess = () => resolve(tx.result?.content || null);
    tx.onerror = () => resolve(null);
  });
}

export async function dbDelete(path) {
  const d = await db();
  return d.transaction(STORE, "readwrite").objectStore(STORE).delete(path);
}

export async function dbList(prefix = "") {
  const d = await db();
  return new Promise((resolve) => {
    const arr = [];
    const req = d.transaction(STORE, "readonly").objectStore(STORE).openCursor();

    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) return resolve(arr);

      const path = cur.value.path;

      // Filter within requested directory
      if (!prefix || path.startsWith(prefix)) {
        const rel = prefix ? path.replace(prefix + "/", "") : path;

        // Show only first-level entries like real filesystem
        if (!rel.includes("/")) {
          arr.push({
            name: rel,
            type: "file",
            path
          });
        }
      }
      cur.continue();
    };
  });
}
