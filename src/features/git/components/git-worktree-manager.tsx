import { Copy, GitBranch, GitCommit, GitFork, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useContextMenu } from "@/hooks/use-context-menu";
import { Button } from "@/ui/button";
import Checkbox from "@/ui/checkbox";
import { ContextMenu, type ContextMenuItem } from "@/ui/context-menu";
import Dialog from "@/ui/dialog";
import Input from "@/ui/input";
import { cn } from "@/utils/cn";
import { getFolderName, getRelativePath } from "@/utils/path-helpers";
import {
  addWorktree,
  getWorktrees,
  pruneWorktrees,
  removeWorktree,
} from "../api/git-worktrees-api";
import type { GitWorktree } from "../types/git-types";

interface GitWorktreeManagerProps {
  isOpen?: boolean;
  onClose?: () => void;
  repoPath?: string;
  onRefresh?: () => void;
  onSelectWorktree?: (repoPath: string) => void;
  embedded?: boolean;
}

interface WorktreeContextMenuData {
  path: string;
  isCurrent: boolean;
}

const GitWorktreeManager = ({
  isOpen = true,
  onClose,
  repoPath,
  onRefresh,
  onSelectWorktree,
  embedded = false,
}: GitWorktreeManagerProps) => {
  const [worktrees, setWorktrees] = useState<GitWorktree[]>([]);
  const [path, setPath] = useState("");
  const [branch, setBranch] = useState("");
  const [createBranch, setCreateBranch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const contextMenu = useContextMenu<WorktreeContextMenuData>();

  useEffect(() => {
    if (isOpen) {
      void loadWorktrees();
    }
  }, [isOpen, repoPath]);

  useEffect(() => {
    if (!isOpen) {
      setIsAddFormOpen(false);
    }
  }, [isOpen]);

  const loadWorktrees = async () => {
    if (!repoPath) return;

    setIsLoading(true);
    try {
      const nextWorktrees = await getWorktrees(repoPath);
      setWorktrees(nextWorktrees);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWorktree = async () => {
    if (!repoPath || !path.trim()) return;

    setIsLoading(true);
    try {
      const success = await addWorktree(
        repoPath,
        path.trim(),
        branch.trim() || undefined,
        createBranch,
      );
      if (success) {
        setPath("");
        setBranch("");
        setCreateBranch(false);
        setIsAddFormOpen(false);
        await loadWorktrees();
        onRefresh?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveWorktree = async (worktreePath: string) => {
    if (!repoPath) return;
    const confirmed = confirm(`Remove worktree at "${worktreePath}"?`);
    if (!confirmed) return;

    setActionLoading((prev) => new Set(prev).add(worktreePath));
    try {
      const success = await removeWorktree(repoPath, worktreePath, true);
      if (success) {
        await loadWorktrees();
        onRefresh?.();
      }
    } finally {
      setActionLoading((prev) => {
        const next = new Set(prev);
        next.delete(worktreePath);
        return next;
      });
    }
  };

  const handlePruneWorktrees = async () => {
    if (!repoPath) return;
    setIsLoading(true);
    try {
      const success = await pruneWorktrees(repoPath);
      if (success) {
        await loadWorktrees();
        onRefresh?.();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPath = async (worktreePath: string) => {
    try {
      await navigator.clipboard.writeText(worktreePath);
    } catch (error) {
      console.error("Failed to copy worktree path:", error);
    }
  };

  if (!embedded && !isOpen) {
    return null;
  }

  const contextMenuItems: ContextMenuItem[] = contextMenu.data
    ? [
        {
          id: "open-worktree",
          label: "Open",
          onClick: () => onSelectWorktree?.(contextMenu.data!.path),
        },
        {
          id: "copy-worktree-path",
          label: "Copy Path",
          icon: <Copy />,
          onClick: () => void handleCopyPath(contextMenu.data!.path),
        },
        ...(!contextMenu.data.isCurrent
          ? [
              {
                id: "sep-1",
                label: "",
                separator: true,
                onClick: () => {},
              },
              {
                id: "remove-worktree",
                label: "Remove",
                icon: <Trash2 />,
                className: "text-error hover:!bg-error/10 hover:!text-error",
                onClick: () => void handleRemoveWorktree(contextMenu.data!.path),
              },
            ]
          : []),
      ]
    : [];

  const content = (
    <div
      className={
        embedded ? "ui-font flex h-full min-h-0 flex-col" : "ui-font flex max-h-[70vh] flex-col"
      }
    >
      <div className="flex items-center justify-end gap-1 px-1 py-1">
        <Button
          onClick={() => setIsAddFormOpen((value) => !value)}
          variant={isAddFormOpen ? "secondary" : "ghost"}
          size="icon-sm"
          data-active={isAddFormOpen}
          aria-label={isAddFormOpen ? "Hide add form" : "Add worktree"}
        >
          <Plus />
        </Button>
        <Button
          onClick={() => void handlePruneWorktrees()}
          disabled={isLoading}
          variant="ghost"
          size="icon-sm"
          aria-label="Prune worktrees"
        >
          <RefreshCw className={cn(isLoading && "animate-spin")} />
        </Button>
      </div>

      {isAddFormOpen && (
        <div className="mx-1 mb-1 rounded-lg border border-border/60 bg-secondary-bg/25 px-2.5 py-2">
          <div className="mb-2">
            <div className="ui-text-sm font-medium text-text">Create worktree</div>
            <div className="ui-text-sm text-text-lighter">
              Add another checkout for this repository.
            </div>
          </div>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Path to new worktree"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="w-full"
            />
            <Input
              type="text"
              placeholder={createBranch ? "New branch name" : "Branch or commit (optional)"}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleAddWorktree();
                }
              }}
            />
            <label className="ui-text-sm flex items-center gap-2 rounded-lg px-1 py-0.5 text-text-lighter">
              <Checkbox checked={createBranch} onChange={setCreateBranch} />
              <span>Create a new branch for this worktree</span>
            </label>
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                onClick={() => setIsAddFormOpen(false)}
                variant="ghost"
                size="sm"
                className="h-7 px-2"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleAddWorktree()}
                disabled={isLoading || !path.trim() || (createBranch && !branch.trim())}
                variant="secondary"
                size="sm"
                className="h-7 px-2"
              >
                {isLoading ? "Adding..." : "Create Worktree"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {isLoading && worktrees.length === 0 ? (
          <div className="ui-text-sm flex h-full min-h-[160px] items-center justify-center px-4 text-center text-text-lighter">
            Loading worktrees...
          </div>
        ) : worktrees.length === 0 ? (
          <div className="ui-text-sm flex h-full min-h-[160px] items-center justify-center px-4 text-center text-text-lighter">
            No worktrees found
          </div>
        ) : (
          worktrees.map((worktree) => {
            const isActionBusy = actionLoading.has(worktree.path);
            const relativePath = getRelativePath(worktree.path, repoPath);
            const worktreeName = getFolderName(worktree.path);
            const branchLabel =
              worktree.branch || (worktree.is_detached ? "Detached HEAD" : "No branch");

            return (
              <div
                key={worktree.path}
                onClick={() => onSelectWorktree?.(worktree.path)}
                onContextMenu={(e) =>
                  contextMenu.open(e, { path: worktree.path, isCurrent: worktree.is_current })
                }
                className={cn(
                  "mb-1 cursor-pointer rounded-lg px-2.5 py-2 transition-colors hover:bg-hover",
                  worktree.is_current && "bg-hover/70",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="truncate ui-text-sm font-medium text-text"
                      title={worktree.path}
                    >
                      {worktreeName}
                    </span>
                    {worktree.is_current && (
                      <span className="ui-text-sm shrink-0 rounded-full bg-primary-bg px-1.5 py-0.5 text-text">
                        Current
                      </span>
                    )}
                    {isActionBusy && (
                      <span className="ui-text-sm shrink-0 text-text-lighter">Removing...</span>
                    )}
                  </div>
                  <div className="ui-text-sm mt-1 truncate text-text-lighter">
                    {relativePath === worktree.path ? worktree.path : relativePath}
                  </div>

                  <div className="ui-text-sm mt-1 flex flex-wrap items-center gap-2 text-text-lighter">
                    <span className="inline-flex items-center gap-1">
                      <GitBranch />
                      <span>{branchLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitCommit />
                      <span>{worktree.head.slice(0, 7)}</span>
                    </span>
                    {worktree.prunable_reason && <span>Prunable</span>}
                    {worktree.locked_reason && <span>Locked</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={contextMenu.close}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Dialog
      onClose={onClose ?? (() => {})}
      title="Worktrees"
      icon={GitFork}
      size="lg"
      classNames={{ content: "p-0" }}
    >
      {content}
    </Dialog>
  );
};

export default GitWorktreeManager;
