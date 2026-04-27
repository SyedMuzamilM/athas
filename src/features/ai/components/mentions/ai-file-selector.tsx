import { MagnifyingGlass as Search } from "@phosphor-icons/react";
import { useEffect, useMemo, type RefObject } from "react";
import { useDebounce } from "use-debounce";
import { useFileSearch } from "@/features/global-search/hooks/use-file-search";
import { FileListItem } from "@/features/global-search/components/file-list-item";
import type { FileCategory, FileItem } from "@/features/global-search/models/types";
import type { FileEntry } from "@/features/file-system/types/app";
import { CommandEmpty, CommandList } from "@/ui/command";
import Input from "@/ui/input";
import { cn } from "@/utils/cn";
import {
  chatComposerDropdownHeaderClassName,
  chatComposerDropdownListClassName,
} from "../input/chat-composer-control-styles";

interface AIFileSelectorProps {
  files: FileEntry[];
  query: string;
  onQueryChange?: (query: string) => void;
  onSelect: (file: FileItem) => void;
  rootFolderPath: string | null | undefined;
  selectedIndex: number;
  onSelectedIndexChange?: (index: number) => void;
  showSearchInput?: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  listClassName?: string;
  emptyLabel?: string;
}

function flattenFileSearchResults(categorizedFiles: ReturnType<typeof useFileSearch>) {
  const result: Array<{ file: FileItem; category: FileCategory; index: number }> = [];

  for (const file of categorizedFiles.openBufferFiles) {
    result.push({ file, category: "open", index: result.length });
  }
  for (const file of categorizedFiles.recentFilesInResults) {
    result.push({ file, category: "recent", index: result.length });
  }
  for (const file of categorizedFiles.otherFiles) {
    result.push({ file, category: "other", index: result.length });
  }

  return result;
}

export function AIFileSelector({
  files,
  query,
  onQueryChange,
  onSelect,
  rootFolderPath,
  selectedIndex,
  onSelectedIndexChange,
  showSearchInput = true,
  searchInputRef,
  listClassName,
  emptyLabel = "No matching files found",
}: AIFileSelectorProps) {
  const [debouncedQuery] = useDebounce(query, 100);
  const fileItems = useMemo<FileItem[]>(
    () =>
      files
        .filter((file) => !file.isDir)
        .map((file) => ({
          name: file.name,
          path: file.path,
          isDir: false,
        })),
    [files],
  );
  const categorizedFiles = useFileSearch(fileItems, debouncedQuery);
  const results = useMemo(() => flattenFileSearchResults(categorizedFiles), [categorizedFiles]);

  useEffect(() => {
    if (selectedIndex <= results.length - 1) return;
    onSelectedIndexChange?.(Math.max(results.length - 1, 0));
  }, [onSelectedIndexChange, results.length, selectedIndex]);

  return (
    <>
      {showSearchInput && (
        <div className={chatComposerDropdownHeaderClassName}>
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search files..."
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            variant="ghost"
            leftIcon={Search}
            className="w-full"
            aria-label="Search files"
          />
        </div>
      )}

      <CommandList>
        <div
          className={cn("items-container", chatComposerDropdownListClassName, listClassName)}
          role="listbox"
          aria-label="File list"
        >
          {results.length === 0 ? (
            <CommandEmpty>{emptyLabel}</CommandEmpty>
          ) : (
            results.map(({ file, category, index }) => (
              <FileListItem
                key={`${category}-${file.path}`}
                file={file}
                category={category}
                index={index}
                isSelected={index === selectedIndex}
                onClick={() => onSelect(file)}
                onPreview={() => onSelectedIndexChange?.(index)}
                rootFolderPath={rootFolderPath}
              />
            ))
          )}
        </div>
      </CommandList>
    </>
  );
}
