import { memo, useCallback, useMemo, useState } from "react";
import { calculateLineHeight } from "@/features/editor/utils/lines";
import { useEditorSettingsStore } from "@/features/editor/stores/settings-store";
import { useZoomStore } from "@/features/window/stores/zoom-store";
import { useDiffHighlighting } from "../../hooks/use-git-diff-highlight";
import type { TextDiffViewerProps } from "../../types/git-diff-types";
import { groupLinesIntoHunks } from "../../utils/git-diff-helpers";
import DiffHunkHeader from "./git-diff-hunk-header";
import DiffLine from "./git-diff-line";

const TextDiffViewer = memo(
  ({
    diff,
    isStaged,
    viewMode,
    showWhitespace,
    onStageHunk,
    onUnstageHunk,
    isInMultiFileView = false,
  }: TextDiffViewerProps) => {
    const editorFontSize = useEditorSettingsStore.use.fontSize();
    const editorFontFamily = useEditorSettingsStore.use.fontFamily();
    const editorTabSize = useEditorSettingsStore.use.tabSize();
    const zoomLevel = useZoomStore.use.editorZoomLevel();
    const fontSize = editorFontSize * zoomLevel;
    const lineHeight = Math.max(calculateLineHeight(fontSize), Math.ceil(fontSize * 1.6), 22);
    const tabSize = editorTabSize;

    const hunks = useMemo(() => groupLinesIntoHunks(diff.lines), [diff.lines]);
    const tokenMap = useDiffHighlighting(diff.lines, diff.file_path);

    const [collapsedHunks, setCollapsedHunks] = useState<Set<number>>(new Set());

    const toggleHunkCollapse = useCallback((hunkId: number) => {
      setCollapsedHunks((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(hunkId)) {
          newSet.delete(hunkId);
        } else {
          newSet.add(hunkId);
        }
        return newSet;
      });
    }, []);

    if (diff.lines.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-text-lighter text-xs">
          No changes in this file
        </div>
      );
    }

    return (
      <div className="min-w-0 overflow-x-auto overflow-y-hidden">
        <div
          className="editor-font code-editor-font-override min-w-full w-fit"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: editorFontFamily,
            lineHeight: `${lineHeight}px`,
            tabSize,
          }}
        >
          {hunks.map((hunk) => {
            const isCollapsed = collapsedHunks.has(hunk.id);
            return (
              <div key={hunk.id}>
                <DiffHunkHeader
                  hunk={hunk}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleHunkCollapse(hunk.id)}
                  isStaged={isStaged}
                  filePath={diff.file_path}
                  onStageHunk={onStageHunk}
                  onUnstageHunk={onUnstageHunk}
                  isInMultiFileView={isInMultiFileView}
                />
                {!isCollapsed &&
                  hunk.lines.map((line, lineIndex) => (
                    <DiffLine
                      key={`${hunk.id}-${lineIndex}`}
                      line={line}
                      viewMode={viewMode}
                      showWhitespace={showWhitespace}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      tabSize={tabSize}
                      tokens={tokenMap.get(line.diffIndex)}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

TextDiffViewer.displayName = "TextDiffViewer";

export default TextDiffViewer;
