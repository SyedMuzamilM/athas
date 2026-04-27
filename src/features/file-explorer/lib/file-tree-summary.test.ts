import { describe, expect, test } from "vite-plus/test";
import type { FileEntry } from "@/features/file-system/types/app";
import { getFileTreeSummary } from "./file-tree-summary";

const tree: FileEntry[] = [
  {
    name: "src",
    path: "/workspace/src",
    isDir: true,
    children: [
      {
        name: "main.ts",
        path: "/workspace/src/main.ts",
        isDir: false,
      },
      {
        name: "components",
        path: "/workspace/src/components",
        isDir: true,
        children: [
          {
            name: "button.tsx",
            path: "/workspace/src/components/button.tsx",
            isDir: false,
          },
        ],
      },
    ],
  },
  {
    name: "package.json",
    path: "/workspace/package.json",
    isDir: false,
  },
];

describe("getFileTreeSummary", () => {
  test("counts files and folders recursively", () => {
    expect(getFileTreeSummary(tree)).toEqual({ files: 3, folders: 2 });
  });

  test("handles empty trees", () => {
    expect(getFileTreeSummary([])).toEqual({ files: 0, folders: 0 });
  });
});
