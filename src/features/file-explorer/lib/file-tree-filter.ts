import type { FileEntry } from "@/features/file-system/types/app";

export interface FileTreeFilterResult {
  files: FileEntry[];
  expandedPaths: Set<string>;
  matchCount: number;
}

export function filterFileTree(entries: readonly FileEntry[], query: string): FileTreeFilterResult {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return { files: [...entries], expandedPaths: new Set(), matchCount: 0 };
  }

  const expandedPaths = new Set<string>();
  let matchCount = 0;

  const walk = (items: readonly FileEntry[]): FileEntry[] => {
    const filtered: FileEntry[] = [];

    for (const item of items) {
      const children = item.children ? walk(item.children) : undefined;
      const matches =
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.path.toLowerCase().includes(normalizedQuery);

      if (matches) {
        matchCount += 1;
      }

      if (matches || (children && children.length > 0)) {
        if (item.isDir && children && children.length > 0) {
          expandedPaths.add(item.path);
        }

        filtered.push({
          ...item,
          children,
        });
      }
    }

    return filtered;
  };

  return {
    files: walk(entries),
    expandedPaths,
    matchCount,
  };
}

export function getHighlightedFileTreeNameParts(
  text: string,
  query: string,
): { text: string; isMatch: boolean }[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [{ text, isMatch: false }];
  }

  const lowerText = text.toLowerCase();
  const parts: { text: string; isMatch: boolean }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(normalizedQuery, cursor);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), isMatch: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), isMatch: false });
    }

    parts.push({
      text: text.slice(matchIndex, matchIndex + normalizedQuery.length),
      isMatch: true,
    });
    cursor = matchIndex + normalizedQuery.length;
  }

  return parts.length > 0 ? parts : [{ text, isMatch: false }];
}
