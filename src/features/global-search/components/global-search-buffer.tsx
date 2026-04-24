import { useEffect, useMemo, useRef } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useFileSystemStore } from "@/features/file-system/controllers/store";
import { Button } from "@/ui/button";
import { CommandInput } from "@/ui/command";
import { SEARCH_TOGGLE_ICONS } from "@/ui/search";
import { TabsList } from "@/ui/tabs";
import { cn } from "@/utils/cn";
import { useContentSearch } from "../hooks/use-content-search";
import { useKeyboardNavigation } from "../hooks/use-keyboard-navigation";
import { ContentSearchResult } from "./content-search-result";

const MAX_DISPLAYED_MATCHES = 500;

const GlobalSearchBuffer = () => {
  const handleFileSelect = useFileSystemStore((state) => state.handleFileSelect);
  const inputRef = useRef<HTMLInputElement>(null);
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
      <div className="border-border/70 border-b bg-secondary-bg/55 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/70 bg-primary-bg/65 px-2">
            <MagnifyingGlass className="size-4 shrink-0 text-text-lighter" weight="duotone" />
            <CommandInput
              ref={inputRef}
              value={query}
              onChange={setQuery}
              placeholder="Search in files..."
              className="ui-font min-w-0"
            />
          </div>
          <TabsList variant="segmented" className="shrink-0">
            {searchOptionsButtons.map((option) => (
              <Button
                key={option.id}
                type="button"
                onClick={option.onToggle}
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "h-full w-7 rounded-none border-0 text-text-lighter hover:bg-hover/60 hover:text-text focus-visible:rounded-none",
                  option.active && "bg-hover/80 text-text",
                )}
                tooltip={option.label}
                aria-label={option.label}
                aria-pressed={option.active}
              >
                {option.icon}
              </Button>
            ))}
          </TabsList>
          {resultLabel ? (
            <span className="ui-font ui-text-xs shrink-0 rounded-md border border-border/60 bg-primary-bg/65 px-2 py-1 text-text-lighter">
              {resultLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="custom-scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-primary-bg"
      >
        {!debouncedQuery ? (
          <div className="flex h-full min-h-[320px] items-center justify-center px-6">
            <div className="flex max-w-md flex-col items-center text-center">
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg border border-border bg-secondary-bg text-text-lighter">
                <MagnifyingGlass className="size-6" weight="duotone" />
              </div>
              <div className="ui-text-sm font-medium text-text">Search across your project</div>
              <div className="ui-text-sm mt-1 text-text-lighter">
                Type a query to see matching files and lines in a single vertical result stream.
              </div>
            </div>
          </div>
        ) : null}

        {debouncedQuery && isSearching ? (
          <div className="ui-text-sm flex min-h-[240px] items-center justify-center text-center text-text-lighter">
            Searching...
          </div>
        ) : null}

        {debouncedQuery && !isSearching && !hasResults && !error ? (
          <div className="ui-text-sm flex min-h-[240px] items-center justify-center text-center text-text-lighter">
            No results found for "{debouncedQuery}"
          </div>
        ) : null}

        {error ? (
          <div className="ui-text-sm flex min-h-[240px] items-center justify-center text-center text-red-500">
            {error}
          </div>
        ) : null}

        {hasResults ? (
          <div className="mx-auto w-full max-w-5xl px-3 py-3">
            <div className="space-y-2">
              {results.map((result) => (
                <ContentSearchResult
                  key={result.file_path}
                  result={result}
                  rootFolderPath={rootFolderPath}
                  onFileClick={handleFileClick}
                  selectedMatchKey={selectedMatchKey}
                  getMatchIndex={(lineNumber) =>
                    matchIndexMap.get(`${result.file_path}:${lineNumber}`)
                  }
                />
              ))}
            </div>
            {hasMore ? (
              <div className="ui-text-sm px-3 py-3 text-center text-text-lighter">
                Showing first {displayedCount} of {totalMatches} results
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GlobalSearchBuffer;
