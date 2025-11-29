// public/fs/fs_bridge.js
// ====================================================================
// File System Access Bridge – runs ONLY in browser
// ====================================================================

if (typeof window !== "undefined") {

  let rootHandle = null;
  let currentDirHandle = null;

  // Undo/redo stacks
  const undoStack = [];
  const redoStack = [];

  function triggerRefresh() {
    try { window.onFSChange?.(); } catch (e) { console.error(e); }
  }

  // Helpers
  function clean(p) {
    return (p || "").replace(/^\/+|\/+$/g, "");
  }

  function splitParent(path) {
    path = clean(path);
    const idx = path.lastIndexOf("/");
    if (idx === -1) return { dir: "", name: path };
    return { dir: path.slice(0, idx), name: path.slice(idx + 1) };
  }

  async function getDirectoryHandleForPath(path = "", createMissing = false) {
    if (!currentDirHandle) throw new Error("No folder selected");
    path = clean(path);
    if (!path) return currentDirHandle;

    const parts = path.split("/").filter(Boolean);
    let dir = currentDirHandle;

    for (const p of parts) {
      dir = await dir.getDirectoryHandle(p, { create: createMissing });
    }
    return dir;
  }

  // ====================================================================
  // Open folder
  // ====================================================================
  window.initFileSystemAccess = async function () {
    rootHandle = await window.showDirectoryPicker();
    currentDirHandle = rootHandle;
    window.__FS_ROOT_NAME__ = rootHandle?.name || "root";
    triggerRefresh();
  };

  // ====================================================================
  // List directory
  // ====================================================================
  window.listDirectory = async function (path = "") {
    if (!currentDirHandle) return [];
    try {
      const dir = await getDirectoryHandleForPath(path);
      const items = [];

      for await (const entry of dir.values()) {
        items.push({
          name: entry.name,
          type: entry.kind === "directory" ? "dir" : "file",
          path: (path ? clean(path) + "/" : "") + entry.name,
        });
      }

      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return items;
    } catch {
      return [];
    }
  };

  // ====================================================================
  // Read file
  // ====================================================================
  window.readFile = async function (path) {
    const { dir, name } = splitParent(path);
    const d = await getDirectoryHandleForPath(dir);
    const fh = await d.getFileHandle(name);
    const file = await fh.getFile();
    return file.text();
  };

  // ====================================================================
  // Write file
  // ====================================================================
  window.writeFile = async function (path, content) {
    const { dir, name } = splitParent(path);
    const d = await getDirectoryHandleForPath(dir, true);

    let prev = null;
    try {
      const old = await d.getFileHandle(name);
      prev = await (await old.getFile()).text();
    } catch {}

    const fh = await d.getFileHandle(name, { create: true });
    const writable = await fh.createWritable();
    await writable.write(content);
    await writable.close();

    undoStack.push({ op: "write", path, prev, next: content });
    redoStack.length = 0;
    triggerRefresh();
  };

  // ====================================================================
  // Create directory
  // ====================================================================
  window.createDirectory = async function (path) {
    await getDirectoryHandleForPath(path, true);
    undoStack.push({ op: "mkdir", path });
    redoStack.length = 0;
    triggerRefresh();
  };

  // ====================================================================
  // Delete file/folder
  // ====================================================================
  window.deletePath = async function (path) {
    const { dir, name } = splitParent(path);
    const d = await getDirectoryHandleForPath(dir);
    let snapshot = null;

    try {
      const fh = await d.getFileHandle(name);
      snapshot = {
        type: "file",
        content: await (await fh.getFile()).text(),
      };
    } catch {
      try {
        snapshot = {
          type: "dir",
          listing: await window.listDirectory(path),
        };
      } catch {}
    }

    await d.removeEntry(name, { recursive: true });
    undoStack.push({ op: "delete", path, snapshot });
    redoStack.length = 0;
    triggerRefresh();
  };

  // ====================================================================
  // Rename
  // ====================================================================
  window.renamePath = async function (oldPath, newName) {
    const { dir, name } = splitParent(oldPath);
    const d = await getDirectoryHandleForPath(dir);

    try {
      const fh = await d.getFileHandle(name);
      const text = await (await fh.getFile()).text();

      const newF = await d.getFileHandle(newName, { create: true });
      const w = await newF.createWritable();
      await w.write(text);
      await w.close();
      await d.removeEntry(name);

      undoStack.push({ op: "rename", oldPath, newPath: (dir ? dir + "/" : "") + newName });
      redoStack.length = 0;
      triggerRefresh();
      return;
    } catch {}

    try {
      const srcDir = await d.getDirectoryHandle(name);
      const destDir = await d.getDirectoryHandle(newName, { create: true });

      async function copyDir(s, dest) {
        for await (const entry of s.values()) {
          if (entry.kind === "file") {
            const fh = await s.getFileHandle(entry.name);
            const content = await (await fh.getFile()).text();
            const nf = await dest.getFileHandle(entry.name, { create: true });
            const w = await nf.createWritable();
            await w.write(content);
            await w.close();
          } else {
            const nextS = await s.getDirectoryHandle(entry.name);
            const nextD = await dest.getDirectoryHandle(entry.name, { create: true });
            await copyDir(nextS, nextD);
          }
        }
      }

      await copyDir(srcDir, destDir);
      await d.removeEntry(name, { recursive: true });

      undoStack.push({ op: "rename", oldPath, newPath: (dir ? dir + "/" : "") + newName });
      redoStack.length = 0;
      triggerRefresh();
    } catch (e) {}
  };

  // ====================================================================
  // Move
  // ====================================================================
  window.movePath = async function (path, destDirPath) {
    const { dir, name } = splitParent(path);
    const srcParent = await getDirectoryHandleForPath(dir);
    const destParent = await getDirectoryHandleForPath(destDirPath, true);

    try {
      const fh = await srcParent.getFileHandle(name);
      const text = await (await fh.getFile()).text();

      const nf = await destParent.getFileHandle(name, { create: true });
      const w = await nf.createWritable();
      await w.write(text);
      await w.close();
      await srcParent.removeEntry(name);

      undoStack.push({ op: "move", from: path, to: clean(destDirPath) + "/" + name });
      redoStack.length = 0;
      triggerRefresh();
      return;
    } catch {}

    try {
      const src = await srcParent.getDirectoryHandle(name);
      const dest = await destParent.getDirectoryHandle(name, { create: true });

      async function copyDir(srcH, destH) {
        for await (const entry of srcH.values()) {
          if (entry.kind === "file") {
            const fh = await srcH.getFileHandle(entry.name);
            const content = await (await fh.getFile()).text();
            const nf = await destH.getFileHandle(entry.name, { create: true });
            const w = await nf.createWritable();
            await w.write(content);
            await w.close();
          } else {
            const s = await srcH.getDirectoryHandle(entry.name);
            const d = await destH.getDirectoryHandle(entry.name, { create: true });
            await copyDir(s, d);
          }
        }
      }

      await copyDir(src, dest);
      await srcParent.removeEntry(name, { recursive: true });

      undoStack.push({ op: "move", from: path, to: clean(destDirPath) + "/" + name });
      redoStack.length = 0;
      triggerRefresh();
    } catch {}
  };

  // ====================================================================
  window.fsUndo = async function () {
    const op = undoStack.pop();
    if (!op) return false;
    redoStack.push(op);

    try {
      if (op.op === "write") await window.writeFile(op.path, op.prev ?? "");
      else if (op.op === "mkdir") await window.deletePath(op.path);
      else if (op.op === "delete") {
        if (op.snapshot?.type === "file") await window.writeFile(op.path, op.snapshot.content);
        else if (op.snapshot?.type === "dir") await window.createDirectory(op.path);
      }
      else if (op.op === "rename") {
        const newName = op.oldPath.split("/").pop();
        await window.renamePath(op.newPath, newName);
      }
      else if (op.op === "move") {
        const fromParent = op.from.split("/").slice(0, -1).join("/");
        await window.movePath(op.to, fromParent);
      }
    } catch {}

    triggerRefresh();
    return true;
  };

  window.fsRedo = async function () {
    const op = redoStack.pop();
    if (!op) return false;
    undoStack.push(op);

    try {
      if (op.op === "write") await window.writeFile(op.path, op.next ?? "");
      else if (op.op === "mkdir") await window.createDirectory(op.path);
      else if (op.op === "delete") await window.deletePath(op.path);
      else if (op.op === "rename") {
        const newName = op.newPath.split("/").pop();
        await window.renamePath(op.oldPath, newName);
      }
      else if (op.op === "move") {
        const target = op.to.split("/").slice(0, -1).join("/");
        await window.movePath(op.from, target);
      }
    } catch {}
    triggerRefresh();
    return true;
  };

  window.addEventListener("focus", () => {
    try { triggerRefresh(); } catch {}
  });

  window.dispatchOpenFile = function(path, content) {
    window.dispatchEvent(new CustomEvent("open-file", { detail: { path, content } }));
  };

} // ← END browser-only wrapper
