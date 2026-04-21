import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useFileSystemStore } from "@/features/file-system/controllers/store";
import { useSettingsStore } from "@/features/settings/store";
import { Button } from "@/ui/button";
import { CommandInput, CommandList } from "@/ui/command";
import { SEARCH_TOGGLE_ICONS } from "@/ui/search";
import { cn } from "@/utils/cn";
import { PREVIEW_DEBOUNCE_DELAY } from "../constants/limits";
import { useContentSearch } from "../hooks/use-content-search";
import { useKeyboardNavigation } from "../hooks/use-keyboard-navigation";
import { ContentSearchResult } from "./content-search-result";
import { FilePreview } from "./file-preview";

const MAX_DISPLAYED_MATCHES = 500;

const GlobalSearchBuffer = () => {
  const handleFileSelect = useFileSystemStore((state) => state.handleFileSelect);
  const quickOpenPreview = useSettingsStore((state) => state.settings.quickOpenPreview);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const {
    query,
    setQuery,
    debouncedQuery,
    results,
    isSearching,
    error,
    rootFolderPath,
    searchOptions,
    setSearchOption,
  } = useContentSearch(true);

  const debouncedSetPreview = useDebouncedCallback(
    (path: string | null) => setPreviewFilePath(path),
    PREVIEW_DEBOUNCE_DELAY,
  );

  const handleFileClick = (filePath: string, lineNumber?: number) => {
    void handleFileSelect(filePath, false, lineNumber);
  };

  const flattenedMatches = useMemo(() => {
    const matches: Array<{
      filePath: string;
      displayPath: string;
      match: {
        line_number: number;
        line_content: string;
        column_start: number;
        column_end: number;
      };
    }> = [];

    for (const result of results) {
      const displayPath = rootFolderPath
        ? result.file_path.replace(rootFolderPath, "").replace(/^\//, "")
        : result.file_path;

      for (const match of result.matches) {
        matches.push({
          filePath: result.file_path,
          displayPath,
          match,
        });

        if (matches.length >= MAX_DISPLAYED_MATCHES) {
          return matches;
        }
      }
    }

    return matches;
  }, [results, rootFolderPath]);

  const navigationItems = useMemo(
    () =>
      flattenedMatches.map((item) => ({
        path: `${item.filePath}:${item.match.line_number}`,
        name: item.filePath.split("/").pop() || "",
        isDir: false,
      })),
    [flattenedMatches],
  );

  const { selectedIndex, scrollContainerRef } = useKeyboardNavigation({
    isVisible: true,
    allResults: navigationItems,
    onClose: () => {},
    onSelect: (path) => {
      const [filePath, lineStr] = path.split(":");
      const lineNumber = parseInt(lineStr, 10);
      handleFileClick(filePath, lineNumber);
    },
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (quickOpenPreview && flattenedMatches.length > 0 && selectedIndex >= 0) {
      const selectedMatch = flattenedMatches[selectedIndex];
      if (selectedMatch) {
        debouncedSetPreview(selectedMatch.filePath);
      }
    }
  }, [selectedIndex, flattenedMatches, quickOpenPreview, debouncedSetPreview]);

  const matchIndexMap = useMemo(
    () => new Map(navigationItems.map((item, index) => [item.path, index])),
    [navigationItems],
  );

  const hasResults = results.length > 0;
  const totalMatches = results.reduce((sum, r) => sum + r.total_matches, 0);
  const displayedCount = flattenedMatches.length;
  const hasMore = totalMatches > displayedCount;
  const resultLabel =
    debouncedQuery && !isSearching
      ? `${displayedCount} ${displayedCount === 1 ? "result" : "results"}${hasMore ? ` (${totalMatches} total)` : ""}`
      : null;
  const selectedMatchKey =
    selectedIndex >= 0 && selectedIndex < navigationItems.length
      ? navigationItems[selectedIndex]?.path
      : null;

  const searchOptionsButtons = [
    {
      id: "case-sensitive",
      label: "Match case",
      icon: SEARCH_TOGGLE_ICONS.caseSensitive,
      active: searchOptions.caseSensitive,
      onToggle: () => setSearchOption("caseSensitive", !searchOptions.caseSensitive),
    },
    {
      id: "whole-word",
      label: "Match whole word",
      icon: SEARCH_TOGGLE_ICONS.wholeWord,
      active: searchOptions.wholeWord,
      onToggle: () => setSearchOption("wholeWord", !searchOptions.wholeWord),
    },
    {
      id: "regex",
      label: "Use regular expression",
      icon: SEARCH_TOGGLE_ICONS.regex,
      active: searchOptions.useRegex,
      onToggle: () => setSearchOption("useRegex", !searchOptions.useRegex),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <CommandInput
            ref={inputRef}
            value={query}
            onChange={setQuery}
            placeholder="Search in files..."
            className="ui-font"
          />
          {resultLabel ? (
            <span className="ui-font ui-text-xs shrink-0 text-text-lighter">{resultLabel}</span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {searchOptionsButtons.map((option) => (
            <Button
              key={option.id}
              type="button"
              onClick={option.onToggle}
              variant="ghost"
              size="icon-xs"
              className={cn(
                "rounded-md border border-transparent text-text-lighter transition-colors",
                option.active
                  ? "border-border/70 bg-hover text-text"
                  : "hover:border-border/70 hover:bg-hover hover:text-text",
              )}
              tooltip={option.label}
              aria-label={option.label}
              aria-pressed={option.active}
            >
              {option.icon}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            quickOpenPreview ? "border-border border-r" : "w-full",
          )}
        >
          <CommandList ref={scrollContainerRef}>
            {!debouncedQuery ? (
              <div className="ui-text-sm flex h-full items-center justify-center text-center text-text-lighter">
                Type to search across all files in your project
              </div>
            ) : null}

            {debouncedQuery && isSearching ? (
              <div className="ui-text-sm flex h-full items-center justify-center text-center text-text-lighter">
                Searching...
              </div>
            ) : null}

            {debouncedQuery && !isSearching && !hasResults && !error ? (
              <div className="ui-text-sm flex h-full items-center justify-center text-center text-text-lighter">
                No results found for "{debouncedQuery}"
              </div>
            ) : null}

            {error ? (
              <div className="ui-text-sm flex h-full items-center justify-center text-center text-red-500">
                {error}
              </div>
            ) : null}

            {hasResults ? (
              <>
                <div className="space-y-1">
                  {results.map((result) => (
                    <ContentSearchResult
                      key={result.file_path}
                      result={result}
                      rootFolderPath={rootFolderPath}
                      onFileClick={handleFileClick}
                      onFileHover={quickOpenPreview ? debouncedSetPreview : undefined}
                      selectedMatchKey={selectedMatchKey}
                      getMatchIndex={(lineNumber) =>
                        matchIndexMap.get(`${result.file_path}:${lineNumber}`)
                      }
                    />
                  ))}
                </div>
                {hasMore ? (
                  <div className="ui-text-sm px-3 py-2 text-center text-text-lighter">
                    Showing first {displayedCount} of {totalMatches} results
                  </div>
                ) : null}
              </>
            ) : null}
          </CommandList>
        </div>

        {quickOpenPreview ? (
          <div className="w-[min(48%,600px)] shrink-0">
            <FilePreview filePath={previewFilePath} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GlobalSearchBuffer;
