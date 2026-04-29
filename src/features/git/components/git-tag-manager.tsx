import { Calendar, GitCommit, Plus, Tag, Trash as Trash2 } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/ui/button";
import { CommandEmpty, CommandItem, CommandList } from "@/ui/command";
import Input from "@/ui/input";
import { formatShortDate } from "@/utils/date";
import { matchesSearchQuery } from "@/utils/search-match";
import { createTag, deleteTag, getTags } from "../api/git-tags-api";
import type { GitTag } from "../types/git-types";
import GitCommandSurface from "./git-command-surface";

interface GitTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath?: string;
  onRefresh?: () => void;
}

const GitTagManager = ({ isOpen, onClose, repoPath, onRefresh }: GitTagManagerProps) => {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<GitTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagMessage, setNewTagMessage] = useState("");
  const [newTagCommit, setNewTagCommit] = useState("");
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    void loadTags();
  }, [isOpen, repoPath]);

  const filteredTags = useMemo(() => {
    if (!query.trim()) return tags;
    return tags.filter((tag) =>
      matchesSearchQuery(query, [tag.name, tag.commit, tag.message ?? ""]),
    );
  }, [query, tags]);

  const loadTags = async () => {
    if (!repoPath) return;

    setIsLoading(true);
    try {
      setTags(await getTags(repoPath));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!repoPath || !newTagName.trim()) return;

    setIsLoading(true);
    try {
      const success = await createTag(
        repoPath,
        newTagName.trim(),
        newTagMessage.trim() || undefined,
        newTagCommit.trim() || undefined,
      );
      if (!success) return;
      setNewTagName("");
      setNewTagMessage("");
      setNewTagCommit("");
      await loadTags();
      onRefresh?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!repoPath) return;

    setActionLoading((prev) => new Set(prev).add(tagName));
    try {
      const success = await deleteTag(repoPath, tagName);
      if (!success) return;
      await loadTags();
      onRefresh?.();
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(tagName);
        return next;
      });
    }
  };

  return (
    <GitCommandSurface
      isOpen={isOpen}
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      placeholder="Search tags..."
      meta={`${tags.length} tag${tags.length === 1 ? "" : "s"}`}
    >
      <div className="border-border/70 border-b px-3 py-2">
        <div className="mb-1.5 flex items-center gap-2 text-text">
          <Plus className="size-4 text-text-lighter" />
          <span className="ui-text-sm font-medium">Create tag</span>
        </div>
        <div className="grid gap-1.5">
          <Input
            type="text"
            placeholder="Tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            size="xs"
            className="w-full"
          />
          <Input
            type="text"
            placeholder="Tag message (optional)"
            value={newTagMessage}
            onChange={(e) => setNewTagMessage(e.target.value)}
            size="xs"
            className="w-full"
          />
          <Input
            type="text"
            placeholder="Commit SHA (optional)"
            value={newTagCommit}
            onChange={(e) => setNewTagCommit(e.target.value)}
            size="xs"
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleCreateTag();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => void handleCreateTag()}
              disabled={isLoading || !newTagName.trim()}
              size="xs"
              variant="secondary"
            >
              {isLoading ? "Creating..." : "Create Tag"}
            </Button>
          </div>
        </div>
      </div>

      <CommandList>
        {isLoading && tags.length === 0 ? (
          <CommandEmpty>Loading tags...</CommandEmpty>
        ) : filteredTags.length === 0 ? (
          <CommandEmpty>{query.trim() ? "No matching tags" : "No tags found"}</CommandEmpty>
        ) : (
          filteredTags.map((tag) => {
            const isActionLoading = actionLoading.has(tag.name);

            return (
              <CommandItem
                key={tag.name}
                className="ui-font h-auto min-h-8 items-start whitespace-normal px-2 py-1.5 leading-normal"
              >
                <Tag className="mt-0.5 size-4 shrink-0 text-text-lighter" />
                <div className="min-w-0 flex-1">
                  <div className="ui-text-sm break-words text-text">{tag.name}</div>
                  {tag.message ? (
                    <div className="ui-text-xs mt-0.5 break-words text-text-lighter">
                      {tag.message}
                    </div>
                  ) : null}
                  <div className="ui-text-xs mt-1 flex flex-wrap items-center gap-3 text-text-lighter">
                    <span className="inline-flex items-center gap-1">
                      <GitCommit className="size-3.5" />
                      <span className="ui-font">{tag.commit.substring(0, 7)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {formatShortDate(tag.date)}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDeleteTag(tag.name);
                  }}
                  disabled={isActionLoading}
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  aria-label={`Delete ${tag.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </CommandItem>
            );
          })
        )}
      </CommandList>
    </GitCommandSurface>
  );
};

export default GitTagManager;
