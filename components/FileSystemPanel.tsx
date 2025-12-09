'use client';

import React, { useEffect, useState, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder as FolderIcon,
  FolderPlus,
  FilePlus,
  Trash2,
  RefreshCw,
  Edit3,
  CornerUpRight,
} from "lucide-react";

type NodeType = "file" | "dir";

export interface FileEntry {
  name: string;
  type: NodeType;
  path: string;
  children?: FileEntry[];
  expanded?: boolean;
}


const FILE_TEMPLATES: Record<string, string> = {
  c: "#include <stdio.h>\n\nint main(){ printf(\"Hello, C\\n\"); return 0; }\n",
  py: "print('Hello Python')\n",
  js: "console.log('Hello JS');\n",
  html: "<!doctype html>\n<html>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>\n",
};

export default function FileSystemPanel() {
  const [tree, setTree] = useState<FileEntry | null>(null);
  const [folderName, setFolderName] = useState<string>("No folder selected");
  const [status, setStatus] = useState("Ready");
  const [filter, setFilter] = useState("");
  const [inlineEditPath, setInlineEditPath] = useState<string | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("");

  // Load bridge script once (client-only)
  useEffect(() => {
    const scr = document.createElement("script");
    scr.src = "/fs/fs_bridge.js";
    scr.type = "module";
    scr.async = true;
    scr.onload = () => {
      console.log("fs_bridge loaded");

      // refresh tree on external changes
      window.onFSChange = () => refreshTree();

      // when external component opens a file, set selected path and expand tree
window.onOpenFile = async (path?: string, content?: string) => {
  if (!path) return;

  // Let EditorComponent handle actual open request
  window.dispatchEvent(new CustomEvent("fs-open-file", {
    detail: { path, content }
  }));
};


      refreshTree();
    };

    document.body.appendChild(scr);

    // refresh on focus (external changes)
    const onFocus = () => refreshTree();
    window.addEventListener("focus", onFocus);

    return () => {
      try { document.body.removeChild(scr); } catch {}
      window.removeEventListener("focus", onFocus);
      window.onFSChange = undefined;
      // keep window.onOpenFile so the Editor can override but we avoid orphaning it here
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh tree root
  async function refreshTree() {
    try {
      const entries = await window.listDirectory?.("");
      const rootName = window.__FS_ROOT_NAME__ || "root";
      setTree({
        name: rootName,
        type: "dir",
        path: "",
        children: entries || [],
        expanded: true,
      });
      setFolderName(rootName);

      // If a file was previously selected, ensure it's visible
      if (selectedPath) {
        await expandToPath(selectedPath);
      }
    } catch (err) {
      console.error("refreshTree error", err);
      setTree(null);
      setFolderName("No folder selected");
    }
  }

  // Open folder (picker)
  async function handleOpen() {
    try {
      await window.initFileSystemAccess?.();
      setFolderName(window.__FS_ROOT_NAME__ || "root");
      await refreshTree();
      setStatus("📂 Folder opened");
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed to open");
    }
  }

  async function createFile(dir = "", useTemplate = false) {
    const name = prompt("Enter file name (example: main.c)");
    if (!name) return;
    const full = dir ? `${dir}/${name}` : name;
    try {
      const ext = name.split(".").pop()?.toLowerCase();
      const content = useTemplate && ext && FILE_TEMPLATES[ext] ? FILE_TEMPLATES[ext] : "";
      await window.writeFile?.(full, content);
      setStatus(`🆕 Created ${full}`);
      await refreshTree();
      if (content) {
        const text = await window.readFile?.(full);
        window.onOpenFile?.(full, text);
      }
    } catch (e) {
      console.error(e);
      alert("❌ Failed to create file");
    }
  }

  async function createFolder(dir = "") {
    const name = prompt("Enter folder name:");
    if (!name) return;
    const full = dir ? `${dir}/${name}` : name;
    try {
      await window.createDirectory?.(full);
      setStatus(`📁 Created ${full}`);
      await refreshTree();
    } catch (e) {
      console.error(e);
      alert("❌ Failed to create folder");
    }
  }

  async function openFile(path: string) {
    try {
      const text = await window.readFile?.(path);
      // notify editor + set selected path & expand parents
      if (window.onOpenFile) window.onOpenFile(path, text);
      setSelectedPath(path);
      await expandToPath(path);
    } catch (e) {
      console.error(e);
      alert("❌ Failed to open file");
    }
  }

  async function deleteItem(path: string) {
    if (!confirm(`Delete ${path}? This cannot be undone.`)) return;
    try {
      await window.deletePath?.(path);
      setStatus(`🗑 Deleted ${path}`);
      // if deleted file was selected, clear selection
      if (selectedPath === path) setSelectedPath("");
      await refreshTree();
    } catch (e) {
      console.error(e);
      alert("❌ Delete failed");
    }
  }

  async function renameItem(oldPath: string, newName: string) {
    try {
      await window.renamePath?.(oldPath, newName);
      setStatus(`✏️ Renamed to ${newName}`);
      setInlineEditPath(null);
      // if renamed path was selected, update selectedPath to new path
      if (selectedPath && selectedPath === oldPath) {
        const parts = oldPath.split("/");
        parts[parts.length - 1] = newName;
        const newPath = parts.join("/");
        setSelectedPath(newPath);
      }
      await refreshTree();
    } catch (e) {
      console.error(e);
      alert("❌ Rename failed");
    }
  }

  // Expand tree so that `path` is visible; will lazy-load children as needed.
  async function expandToPath(path: string) {
    if (!path || !tree) return;

    const parts = path.split("/").filter(Boolean);
    const newTree = { ...(tree as FileEntry) };

    async function recurse(node: FileEntry, idx: number): Promise<boolean> {
      if (idx >= parts.length) return false;
      const part = parts[idx];

      if (!node.children) node.children = [];

      let child = node.children.find((c) => c.name === part);
      if (!child) {
        if (node.type === "dir") {
          try {
            const list = await window.listDirectory?.(node.path || "");
            node.children = list || [];
            child = node.children.find((c) => c.name === part);
          } catch (e) {
            // ignore
          }
        }
      }

      if (!child) return false;

      if (child.type === "dir") {
        child.expanded = true;
        if (!child.children) {
          try {
            const list = await window.listDirectory?.(child.path || "");
            child.children = list || [];
          } catch (e) {
            child.children = child.children || [];
          }
        }
        const found = await recurse(child, idx + 1);
        return found || (idx === parts.length - 1);
      } else {
        return idx === parts.length - 1;
      }
    }

    for (const c of newTree.children || []) {
      if (c.name === parts[0]) {
        c.expanded = c.type === "dir" ? true : c.expanded;
        if (c.type === "dir" && !c.children) {
          try {
            c.children = (await window.listDirectory?.(c.path)) || [];
          } catch (e) {
            c.children = c.children || [];
          }
        }
        await recurse(c, 1);
        break;
      }
    }

    setTree({ ...newTree });
  }

  // inline rename focus
  useEffect(() => {
    if (inlineEditPath && inlineInputRef.current) {
      inlineInputRef.current.select();
      inlineInputRef.current.focus();
    }
  }, [inlineEditPath]);

  function renderNode(node: FileEntry, level = 0): React.ReactNode {
    const pad = { paddingLeft: `${level * 12}px` };
    const isFileHiddenByFilter = filter && node.type === "file" && !node.name.toLowerCase().includes(filter.toLowerCase());
    if (isFileHiddenByFilter) return null;

    const isSelected = selectedPath && node.path === selectedPath;

    return (
      <div key={node.path || node.name}>
        <div
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-[#2b2b40] ${isSelected ? "bg-[#2b3448]" : ""}`}
          style={pad}
          onDoubleClick={() => (node.type === "dir" ? toggleNode(node) : openFile(node.path))}
          onClick={() => {
            setSelectedPath(node.path);
            if (node.type === "file") {
              openFile(node.path);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            const choice = prompt("Action: open / newfile / newfolder / rename / delete (type exactly)");
            if (!choice) return;
            if (choice === "open") {
              node.type === "dir" ? toggleNode(node) : openFile(node.path);
            } else if (choice === "newfile" && node.type === "dir") {
              createFile(node.path);
            } else if (choice === "newfolder" && node.type === "dir") {
              createFolder(node.path);
            } else if (choice === "rename") {
              setInlineEditPath(node.path);
            } else if (choice === "delete") {
              deleteItem(node.path);
            }
          }}
        >
          {node.type === "dir" ? (
            <>
              {node.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <FolderIcon className="w-4 h-4 text-yellow-400" />
            </>
          ) : (
            <FileIcon className="w-4 h-4" />
          )}

          {inlineEditPath === node.path ? (
            <input
              ref={inlineInputRef}
              defaultValue={node.name}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) await renameItem(node.path, val);
                } else if (e.key === "Escape") {
                  setInlineEditPath(null);
                }
              }}
              onBlur={() => setInlineEditPath(null)}
              className="bg-transparent border-b border-gray-600 text-sm text-white px-1 py-0"
            />
          ) : (
            <span className="truncate text-sm">{node.name}</span>
          )}

          <div className="ml-auto flex items-center gap-1 opacity-80">
            {node.type === "file" && (
              <button
                title="Open in editor"
                onClick={(e) => {
                  e.stopPropagation();
                  openFile(node.path);
                }}
                className="btn-mini"
              >
                <CornerUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setInlineEditPath(node.path);
              }}
              className="btn-mini"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                deleteItem(node.path);
              }}
              className="btn-mini"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {node.type === "dir" && node.expanded && node.children && (
          <div>{node.children.map((c) => renderNode(c, level + 1))}</div>
        )}
      </div>
    );
  }

  // toggle folder expansion and lazy load children
  async function toggleNode(node: FileEntry) {
    if (node.type !== "dir") return;
    if (!node.expanded) {
      try {
        const list = await window.listDirectory?.(node.path);
        node.children = list || [];
      } catch (e) {
        node.children = [];
      }
    }
    node.expanded = !node.expanded;
    setTree((t) => ({ ...(t as FileEntry) }));
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e2f] text-gray-200 font-mono">
      <div className="flex items-center gap-2 p-2 bg-[#2a2a40] border-b border-gray-700">
        <span className="text-xs text-gray-300 bg-black/20 px-2 py-1 rounded">
          📁 {folderName}
        </span>

        <button className="btn" onClick={handleOpen}>
          📂
        </button>
        <button className="btn" onClick={() => createFile("")}>
          <FilePlus className="w-4 h-4" />
        </button>
        <button className="btn" onClick={() => createFolder("")}>
          <FolderPlus className="w-4 h-4" />
        </button>
        <button className="btn" onClick={refreshTree}>
          <RefreshCw className="w-4 h-4" />
        </button>

        <input
          placeholder="Search..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-2 bg-transparent border border-gray-600 rounded px-2 py-1 text-xs text-gray-300"
        />

        
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-white dark:bg-slate-900">
        {!tree && <div className="text-gray-500 text-sm">Click <b>Open</b> to choose a folder.</div>}
        {tree?.children && tree.children.length === 0 && <div className="text-gray-500 text-sm">Open a folder</div>}
        {tree?.children?.map((child) => renderNode(child))}
      </div>

      <style jsx>{`
        .btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.06);
          color: #e6e6e6;
          padding: 6px 8px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }
        .btn-mini {
          background: transparent;
          border: none;
          padding: 4px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn:hover { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  );
}
