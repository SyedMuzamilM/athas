import type { FileEntry } from "@/features/file-system/types/app";

export interface FileTreeSummary {
  files: number;
  folders: number;
}

export function getFileTreeSummary(entries: readonly FileEntry[]): FileTreeSummary {
  let files = 0;
  let folders = 0;

  const walk = (items: readonly FileEntry[]) => {
    for (const item of items) {
      if (item.isDir) {
        folders += 1;
        if (item.children) {
          walk(item.children);
        }
      } else {
        files += 1;
      }
    }
  };

  walk(entries);
  return { files, folders };
}
