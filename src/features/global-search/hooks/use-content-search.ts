import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { useFileSystemStore } from "@/features/file-system/controllers/store";
import type { FileSearchResult } from "@/features/global-search/lib/rust-api/search";
import { searchFilesContent } from "@/features/global-search/lib/rust-api/search";
import { SEARCH_DEBOUNCE_DELAY } from "../constants/limits";

export interface ContentSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export const useContentSearch = (isVisible: boolean) => {
  const rootFolderPath = useFileSystemStore((state) => state.rootFolderPath);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, SEARCH_DEBOUNCE_DELAY);
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOptions, setSearchOptions] = useState<ContentSearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });
  const requestIdRef = useRef(0);

  const setSearchOption = useCallback(
    <K extends keyof ContentSearchOptions>(key: K, value: ContentSearchOptions[K]) => {
      setSearchOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const performSearch = useCallback(async () => {
    if (!debouncedQuery || !rootFolderPath) {
      setResults([]);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsSearching(true);
    setError(null);

    try {
      const searchResults = await searchFilesContent({
        root_path: rootFolderPath,
        query: debouncedQuery,
        case_sensitive: searchOptions.caseSensitive,
        whole_word: searchOptions.wholeWord,
        use_regex: searchOptions.useRegex,
        max_results: 100,
      });

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      setResults(searchResults);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      console.error("Search error:", err);
      setError(`Search failed: ${err}`);
      setResults([]);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [debouncedQuery, rootFolderPath, searchOptions]);

  useEffect(() => {
    if (isVisible) {
      performSearch();
    }
  }, [debouncedQuery, isVisible, performSearch]);

  // Reset when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [isVisible]);

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    isSearching,
    error,
    rootFolderPath,
    searchOptions,
    setSearchOption,
  };
};
