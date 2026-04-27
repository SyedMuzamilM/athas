import type { FileEntry } from "@/features/file-system/types/app";

export interface VisibleFileTreeRow {
  file: FileEntry;
  depth: number;
  isExpanded: boolean;
  displayName?: string;
}

export interface BuildVisibleFileTreeRowsOptions {
  compactFolders?: boolean;
}

function getCompactFolderChild(item: FileEntry): FileEntry | null {
  if (!item.isDir || item.isEditing || item.isRenaming || item.isNewItem || !item.children) {
    return null;
  }

  if (item.children.length !== 1) {
    return null;
  }

  const child = item.children[0];
  if (!child.isDir || child.isEditing || child.isRenaming || child.isNewItem) {
    return null;
  }

  return child;
}

export function buildVisibleFileTreeRows(
  files: FileEntry[],
  expandedPaths: ReadonlySet<string>,
  options: BuildVisibleFileTreeRowsOptions = {},
): VisibleFileTreeRow[] {
  const rows: VisibleFileTreeRow[] = [];
  const compactFolders = options.compactFolders === true;

  const walk = (items: FileEntry[], depth: number) => {
    for (const item of items) {
      let rowFile = item;
      const displayNameParts = [item.name];

      if (compactFolders) {
        while (expandedPaths.has(rowFile.path)) {
          const child = getCompactFolderChild(rowFile);
          if (!child) break;

          rowFile = child;
          displayNameParts.push(child.name);
        }
      }

      const isExpanded = rowFile.isDir && expandedPaths.has(rowFile.path);
      rows.push({
        file: rowFile,
        depth,
        isExpanded,
        displayName: displayNameParts.length > 1 ? displayNameParts.join("/") : undefined,
      });

      if (rowFile.isDir && isExpanded && rowFile.children) {
        walk(rowFile.children, depth + 1);
      }
    }
  };

  walk(files, 0);
  return rows;
}

export function getStickyAncestorRow(
  rows: readonly VisibleFileTreeRow[],
  firstVisibleIndex: number,
): VisibleFileTreeRow | null {
  const firstVisibleRow = rows[firstVisibleIndex];
  if (!firstVisibleRow || firstVisibleRow.depth === 0) {
    return null;
  }

  const targetDepth = firstVisibleRow.depth - 1;
  for (let index = firstVisibleIndex - 1; index >= 0; index--) {
    const row = rows[index];
    if (row.depth === targetDepth) {
      return row;
    }
  }

  return null;
}

export function getGuideAncestorRows(
  rows: readonly VisibleFileTreeRow[],
  rowIndex: number,
): Array<VisibleFileTreeRow | null> {
  const row = rows[rowIndex];
  if (!row || row.depth === 0) {
    return [];
  }

  const ancestors: Array<VisibleFileTreeRow | null> = Array.from({ length: row.depth }, () => null);
  let remaining = row.depth;

  for (let index = rowIndex - 1; index >= 0 && remaining > 0; index--) {
    const candidate = rows[index];
    if (candidate.depth < row.depth && ancestors[candidate.depth] === null) {
      ancestors[candidate.depth] = candidate;
      remaining--;
    }
  }

  return ancestors;
}
