export {};

declare global {
  interface Window {
    initFileSystemAccess?: () => Promise<void>;
    listDirectory?: (path?: string) => Promise<any[] | FileEntry[]>; // FIXED ✔
    readFile?: (path: string) => Promise<string>;
    writeFile?: (path: string, content: string) => Promise<void>;
    createDirectory?: (path: string) => Promise<void>;
    deletePath?: (path: string) => Promise<void>;
    renamePath?: (oldPath: string, newName: string) => Promise<void>;
    movePath?: (path: string, destDirPath: string) => Promise<void>;
    fsUndo?: () => Promise<boolean>;
    fsRedo?: () => Promise<boolean>;
    onFSChange?: () => void;
    onOpenFile?: (path: string, content?: string) => void;

    __FS_ROOT_NAME__?: string;
  }
}

export interface FileEntry {
  name: string;
  type: "file" | "dir";
  path: string;
  children?: FileEntry[];
  expanded?: boolean;
}
