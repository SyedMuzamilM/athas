import { describe, expect, test } from "vite-plus/test";
import type { FileEntry } from "@/features/file-system/types/app";
import { filterFileTree, getHighlightedFileTreeNameParts } from "./file-tree-filter";

const tree: FileEntry[] = [
  {
    name: "src",
    path: "/workspace/src",
    isDir: true,
    children: [
      {
        name: "components",
        path: "/workspace/src/components",
        isDir: true,
        children: [
          {
            name: "file-tree.tsx",
            path: "/workspace/src/components/file-tree.tsx",
            isDir: false,
          },
        ],
      },
      {
        name: "main.ts",
        path: "/workspace/src/main.ts",
        isDir: false,
      },
    ],
  },
  {
    name: "README.md",
    path: "/workspace/README.md",
    isDir: false,
  },
];

describe("filterFileTree", () => {
  test("keeps matching descendants with their parent folders", () => {
    const result = filterFileTree(tree, "file-tree");

    expect(result.matchCount).toBe(1);
    expect(result.files.map((entry) => entry.path)).toEqual(["/workspace/src"]);
    expect(result.files[0]?.children?.map((entry) => entry.path)).toEqual([
      "/workspace/src/components",
    ]);
    expect(result.files[0]?.children?.[0]?.children?.map((entry) => entry.path)).toEqual([
      "/workspace/src/components/file-tree.tsx",
    ]);
  });

  test("returns folders that should be force-expanded while filtering", () => {
    const result = filterFileTree(tree, "file-tree");

    expect([...result.expandedPaths]).toEqual(["/workspace/src/components", "/workspace/src"]);
  });

  test("returns the original root list for empty queries", () => {
    const result = filterFileTree(tree, " ");

    expect(result.files).toEqual(tree);
    expect(result.matchCount).toBe(0);
    expect(result.expandedPaths.size).toBe(0);
  });
});

describe("getHighlightedFileTreeNameParts", () => {
  test("splits matched text without changing case", () => {
    expect(getHighlightedFileTreeNameParts("FileTree.tsx", "tree")).toEqual([
      { text: "File", isMatch: false },
      { text: "Tree", isMatch: true },
      { text: ".tsx", isMatch: false },
    ]);
  });
});
