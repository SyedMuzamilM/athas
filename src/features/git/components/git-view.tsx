import { open } from "@tauri-apps/plugin-dialog";
import { ClockCounterClockwise, FolderSimpleStar, TreeStructure } from "@phosphor-icons/react";
import {
  Eye,
  DotsThree as MoreHorizontal,
  ArrowClockwise as RefreshCw,
} from "@phosphor-icons/react";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBufferStore } from "@/features/editor/stores/buffer-store";
import { useSettingsStore } from "@/features/settings/store";
import { Button } from "@/ui/button";
import { CommandEmpty, CommandItem, CommandList } from "@/ui/command";
import { PANE_GROUP_BASE, PaneIconButton, paneHeaderClassName } from "@/ui/pane";
import {
  EQUAL_WIDTH_SEGMENTED_TAB_ITEM_CLASS_NAME,
  EQUAL_WIDTH_SEGMENTED_TABS_CLASS_NAME,
  Tabs,
} from "@/ui/tabs";
import { cn } from "@/utils/cn";
import { formatRelativeDate } from "@/utils/date";
import { getBranches } from "../api/git-branches-api";
import { getGitLog } from "../api/git-commits-api";
import { getCommitDiff, getFileDiff, getStashDiff } from "../api/git-diff-api";
import { resolveRepositoryPath } from "../api/git-repo-api";
import { getStashes } from "../api/git-stash-api";
import { getGitStatus } from "../api/git-status-api";
import { useRepositoryStore } from "../stores/git-repository-store";
import { useGitStore } from "../stores/git-store";
import type { MultiFileDiff } from "../types/git-diff-types";
import type { GitFile } from "../types/git-types";
import type { GitActionsMenuAnchorRect } from "../utils/git-actions-menu-position";
import { countDiffStats } from "../utils/git-diff-helpers";
import GitActionsMenu from "./git-actions-menu";
import GitBranchManager from "./git-branch-manager";
import GitCommitHistory from "./git-commit-history";
import GitCommitPanel from "./git-commit-panel";
import GitCommandSurface from "./git-command-surface";
import GitProjectSelector from "./git-project-selector";
import GitRemoteManager from "./git-remote-manager";
import GitTagManager from "./git-tag-manager";
import GitWorktreeManager from "./git-worktree-manager";
import GitStatusPanel from "./status/git-status-panel";

interface GitViewProps {
  repoPath?: string;
  onFileSelect?: (path: string, isDir: boolean) => void;
  isActive?: boolean;
}

interface GitFileDiffStats {
  additions: number;
  deletions: number;
}

type GitSidebarTab = "changes" | "history" | "worktrees";

const GitView = ({ repoPath, onFileSelect, isActive }: GitViewProps) => {
  const MAX_STATUS_DIFF_STATS_FILES = 40;
  const { gitStatus, isLoadingGitData, isRefreshing, actions } = useGitStore();
  const stashes = useGitStore((state) => state.stashes);
  const { setIsLoadingGitData, setIsRefreshing } = actions;
  const activeRepoPath = useRepositoryStore.use.activeRepoPath();
  const {
    syncWorkspaceRepositories,
    selectRepository,
    setManualRepository,
    refreshWorkspaceRepositories,
  } = useRepositoryStore.use.actions();
  const [showGitActionsMenu, setShowGitActionsMenu] = useState(false);
  const [showStashList, setShowStashList] = useState(false);
  const [isSelectingRepo, setIsSelectingRepo] = useState(false);
  const [repoSelectionError, setRepoSelectionError] = useState<string | null>(null);
  const [gitActionsMenuAnchor, setGitActionsMenuAnchor] = useState<GitActionsMenuAnchorRect | null>(
    null,
  );

  const [showRemoteManager, setShowRemoteManager] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const settings = useSettingsStore((state) => state.settings);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const [activeTab, setActiveTab] = useState<GitSidebarTab>("changes");
  const [fileDiffStats, setFileDiffStats] = useState<Record<string, GitFileDiffStats>>({});

  const wasActiveRef = useRef(isActive);
  const [stashSearchQuery, setStashSearchQuery] = useState("");

  const visibleGitFiles = useMemo(
    () =>
      settings.showUntrackedFiles
        ? (gitStatus?.files ?? [])
        : (gitStatus?.files ?? []).filter((file) => file.status !== "untracked"),
    [gitStatus?.files, settings.showUntrackedFiles],
  );

  const handleSelectRepository = useCallback(async () => {
    setIsSelectingRepo(true);
    setRepoSelectionError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const resolvedRepoPath = await resolveRepositoryPath(selected);
      if (!resolvedRepoPath) {
        const message = "Selected folder is not inside a Git repository.";
        setRepoSelectionError(message);
        alert(message);
        return;
      }

      setManualRepository(resolvedRepoPath);
    } catch (error) {
      console.error("Failed to select repository:", error);
      const message = "Failed to select repository";
      setRepoSelectionError(message);
      alert(`${message}:\n${error}`);
    } finally {
      setIsSelectingRepo(false);
    }
  }, [setManualRepository]);

  const loadInitialGitData = useCallback(async () => {
    if (!activeRepoPath) return;

    setIsLoadingGitData(true);
    try {
      const [status, commits, branches, stashes] = await Promise.all([
        getGitStatus(activeRepoPath),
        getGitLog(activeRepoPath, 50, 0),
        getBranches(activeRepoPath),
        getStashes(activeRepoPath),
      ]);

      actions.loadFreshGitData({
        gitStatus: status,
        commits,
        branches,
        stashes,
        repoPath: activeRepoPath,
      });
    } catch (error) {
      console.error("Failed to load initial git data:", error);
    } finally {
      setIsLoadingGitData(false);
    }
  }, [activeRepoPath, actions, setIsLoadingGitData]);

  const refreshGitData = useCallback(async () => {
    if (!activeRepoPath) return;

    try {
      const [status, branches] = await Promise.all([
        getGitStatus(activeRepoPath),
        getBranches(activeRepoPath),
      ]);

      await actions.refreshGitData({
        gitStatus: status,
        branches,
        repoPath: activeRepoPath,
      });
    } catch (error) {
      console.error("Failed to refresh git data:", error);
    }
  }, [activeRepoPath, actions]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshGitData(),
        refreshWorkspaceRepositories(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshGitData, refreshWorkspaceRepositories, setIsRefreshing]);

  useEffect(() => {
    void syncWorkspaceRepositories(repoPath ?? null);
  }, [repoPath, syncWorkspaceRepositories]);

  useEffect(() => {
    loadInitialGitData();
  }, [loadInitialGitData]);

  useEffect(() => {
    setRepoSelectionError(null);
  }, [repoPath]);

  useEffect(() => {
    if (settings.autoRefreshGitStatus && isActive && !wasActiveRef.current && gitStatus) {
      refreshGitData();
    }
    wasActiveRef.current = isActive;
  }, [settings.autoRefreshGitStatus, isActive, gitStatus, refreshGitData]);

  useEffect(() => {
    if (!settings.autoRefreshGitStatus) return;

    const handleGitStatusChanged = () => {
      refreshGitData();
    };

    window.addEventListener("git-status-changed", handleGitStatusChanged);
    return () => {
      window.removeEventListener("git-status-changed", handleGitStatusChanged);
    };
  }, [settings.autoRefreshGitStatus, refreshGitData]);

  useEffect(() => {
    if (!settings.autoRefreshGitStatus) return;

    let refreshTimeout: NodeJS.Timeout | null = null;
    type FileExternalChangeDetail = {
      event_type: string;
      path: string;
    };

    const handleFileChange = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;

      const { path } = event.detail as FileExternalChangeDetail;

      if (activeRepoPath && path.startsWith(activeRepoPath)) {
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }

        refreshTimeout = setTimeout(() => {
          refreshGitData();
        }, 300);
      }
    };

    window.addEventListener("file-external-change", handleFileChange);

    return () => {
      window.removeEventListener("file-external-change", handleFileChange);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [settings.autoRefreshGitStatus, activeRepoPath, refreshGitData]);

  useEffect(() => {
    if (!settings.rememberLastGitPanelMode) return;
    setActiveTab(settings.gitLastPanelMode);
  }, [settings.rememberLastGitPanelMode, settings.gitLastPanelMode]);

  useEffect(() => {
    if (!settings.rememberLastGitPanelMode) return;
    if (settings.gitLastPanelMode !== activeTab) {
      void updateSetting("gitLastPanelMode", activeTab);
    }
  }, [activeTab, settings.rememberLastGitPanelMode, settings.gitLastPanelMode, updateSetting]);

  useEffect(() => {
    if (!activeRepoPath || !visibleGitFiles.length) {
      setFileDiffStats({});
      return;
    }

    let isCancelled = false;

    const loadFileDiffStats = async () => {
      const uniqueFiles = Array.from(
        new Map(
          visibleGitFiles.map((file) => [
            `${file.staged ? "staged" : "unstaged"}:${file.path}`,
            file,
          ]),
        ).values(),
      );
      const filesToMeasure = uniqueFiles.slice(0, MAX_STATUS_DIFF_STATS_FILES);

      const statsEntries = await Promise.all(
        filesToMeasure.map(async (file) => {
          const diff = await getFileDiff(activeRepoPath, file.path, file.staged);
          const { additions, deletions } = diff
            ? countDiffStats([diff])
            : { additions: 0, deletions: 0 };
          return [
            `${file.staged ? "staged" : "unstaged"}:${file.path}`,
            { additions, deletions },
          ] as const;
        }),
      );

      if (!isCancelled) {
        setFileDiffStats(Object.fromEntries(statsEntries));
      }
    };

    void loadFileDiffStats();

    return () => {
      isCancelled = true;
    };
  }, [activeRepoPath, visibleGitFiles]);

  const handleOpenOriginalFile = async (filePath: string) => {
    if (!activeRepoPath || !onFileSelect) return;

    try {
      let actualFilePath = filePath;

      if (filePath.includes(" -> ")) {
        const parts = filePath.split(" -> ");
        actualFilePath = parts[1].trim();
      }

      if (actualFilePath.startsWith('"') && actualFilePath.endsWith('"')) {
        actualFilePath = actualFilePath.slice(1, -1);
      }

      const fullPath = `${activeRepoPath}/${actualFilePath}`;

      onFileSelect(fullPath, false);
    } catch (error) {
      console.error("Error opening file:", error);
      alert(`Failed to open file ${filePath}:\n${error}`);
    }
  };

  const handleViewFileDiff = async (filePath: string, staged: boolean = false) => {
    if (!activeRepoPath || !onFileSelect) return;

    try {
      let actualFilePath = filePath;

      if (filePath.includes(" -> ")) {
        const parts = filePath.split(" -> ");
        if (staged) {
          actualFilePath = parts[1].trim();
        } else {
          actualFilePath = parts[0].trim();
        }
      }

      if (actualFilePath.startsWith('"') && actualFilePath.endsWith('"')) {
        actualFilePath = actualFilePath.slice(1, -1);
      }

      const file = gitStatus?.files.find((f: GitFile) => f.path === actualFilePath);

      if (file && file.status === "untracked" && !staged) {
        handleOpenOriginalFile(actualFilePath);
        return;
      }

      const diff = await getFileDiff(activeRepoPath, actualFilePath, staged);

      if (diff && (diff.lines.length > 0 || diff.is_image)) {
        const selectedFileKey = `${staged ? "staged" : "unstaged"}:${actualFilePath}`;
        const { additions, deletions } = countDiffStats([diff]);

        // Open buffer immediately with the clicked file's diff
        const initialMultiDiff: MultiFileDiff = {
          title: "Uncommitted Changes",
          commitHash: "working-tree",
          files: [diff],
          totalFiles: 1,
          totalAdditions: additions,
          totalDeletions: deletions,
          fileKeys: [selectedFileKey],
          initiallyExpandedFileKey: selectedFileKey,
          isLoading: true,
        };

        const virtualPath = "diff://working-tree/all-files";
        const bufferId = useBufferStore
          .getState()
          .actions.openBuffer(
            virtualPath,
            "Uncommitted Changes",
            "",
            false,
            undefined,
            true,
            true,
            initialMultiDiff,
          );

        // Load remaining diffs in the background
        const repoPath = activeRepoPath;
        const diffableFiles = (visibleGitFiles ?? []).filter(
          (entry) => entry.status !== "untracked",
        );
        const diffEntries = Array.from(
          new Map(
            diffableFiles.map((entry) => [
              `${entry.staged ? "staged" : "unstaged"}:${entry.path}`,
              entry,
            ]),
          ).entries(),
        ).filter(([fileKey]) => fileKey !== selectedFileKey);

        if (diffEntries.length > 0) {
          void (async () => {
            const accumulatedDiffs = [{ fileKey: selectedFileKey, diff }];

            for (const [fileKey, entry] of diffEntries) {
              const nextDiff = await getFileDiff(repoPath, entry.path, entry.staged);
              if (!nextDiff || (nextDiff.lines.length === 0 && nextDiff.is_image !== true)) {
                continue;
              }

              accumulatedDiffs.push({
                fileKey,
                diff: nextDiff,
              });

              const stats = countDiffStats(accumulatedDiffs.map((item) => item.diff));
              useBufferStore.getState().actions.updateBufferContent(bufferId, "", false, {
                title: "Uncommitted Changes",
                commitHash: "working-tree",
                files: accumulatedDiffs.map((item) => item.diff),
                totalFiles: accumulatedDiffs.length,
                totalAdditions: stats.additions,
                totalDeletions: stats.deletions,
                fileKeys: accumulatedDiffs.map((item) => item.fileKey),
                initiallyExpandedFileKey: selectedFileKey,
                isLoading: true,
              } satisfies MultiFileDiff);
              await Promise.resolve();
            }

            const allStats = countDiffStats(accumulatedDiffs.map((item) => item.diff));
            useBufferStore.getState().actions.updateBufferContent(bufferId, "", false, {
              title: "Uncommitted Changes",
              commitHash: "working-tree",
              files: accumulatedDiffs.map((item) => item.diff),
              totalFiles: accumulatedDiffs.length,
              totalAdditions: allStats.additions,
              totalDeletions: allStats.deletions,
              fileKeys: accumulatedDiffs.map((item) => item.fileKey),
              initiallyExpandedFileKey: selectedFileKey,
              isLoading: false,
            } satisfies MultiFileDiff);
          })();
        } else {
          // No other files to load, mark as done
          useBufferStore.getState().actions.updateBufferContent(bufferId, "", false, {
            ...initialMultiDiff,
            isLoading: false,
          });
        }
      } else {
        handleOpenOriginalFile(actualFilePath);
      }
    } catch (error) {
      console.error("Error getting file diff:", error);
      alert(`Failed to get diff for ${filePath}:\n${error}`);
    }
  };

  const handleViewCommitDiff = async (commitHash: string, filePath?: string) => {
    if (!activeRepoPath || !onFileSelect) return;

    try {
      const diffs = await getCommitDiff(activeRepoPath, commitHash);
      const commit = useGitStore.getState().commits.find((entry) => entry.hash === commitHash);

      if (diffs && diffs.length > 0) {
        if (filePath) {
          const diff = diffs.find((d) => d.file_path === filePath) || diffs[0];
          const diffFileName = `${diff.file_path.split("/").pop()}.diff`;
          const virtualPath = `diff://commit/${commitHash}/${diffFileName}`;

          useBufferStore
            .getState()
            .actions.openBuffer(virtualPath, diffFileName, "", false, undefined, true, true, diff);
        } else {
          const { additions, deletions } = countDiffStats(diffs);

          const multiDiff: MultiFileDiff = {
            title: `Commit ${commitHash.substring(0, 7)}`,
            repoPath: activeRepoPath,
            commitHash,
            commitMessage: commit?.message,
            commitDescription: commit?.description,
            commitAuthor: commit?.author,
            commitDate: commit?.date,
            files: diffs,
            totalFiles: diffs.length,
            totalAdditions: additions,
            totalDeletions: deletions,
          };

          const virtualPath = `diff://commit/${commitHash}/all-files`;
          const displayName = `Commit ${commitHash.substring(0, 7)} (${diffs.length} files)`;

          useBufferStore
            .getState()
            .actions.openBuffer(
              virtualPath,
              displayName,
              "",
              false,
              undefined,
              true,
              true,
              multiDiff,
            );
        }
      } else {
        alert(`No changes in this commit${filePath ? ` for file ${filePath}` : ""}.`);
      }
    } catch (error) {
      console.error("Error getting commit diff:", error);
      alert(`Failed to get diff for commit ${commitHash}:\n${error}`);
    }
  };

  const handleViewStashDiff = async (stashIndex: number) => {
    if (!activeRepoPath || !onFileSelect) return;

    try {
      const diffs = await getStashDiff(activeRepoPath, stashIndex);

      if (diffs && diffs.length > 0) {
        const { additions, deletions } = countDiffStats(diffs);

        const multiDiff: MultiFileDiff = {
          repoPath: activeRepoPath,
          commitHash: `stash@{${stashIndex}}`,
          files: diffs,
          totalFiles: diffs.length,
          totalAdditions: additions,
          totalDeletions: deletions,
        };

        const virtualPath = `diff://stash/${stashIndex}/all-files`;
        const displayName = `Stash @{${stashIndex}} (${diffs.length} files)`;

        useBufferStore
          .getState()
          .actions.openBuffer(
            virtualPath,
            displayName,
            "",
            false,
            undefined,
            true,
            true,
            multiDiff,
          );
      } else {
        alert("No changes in this stash.");
      }
    } catch (error) {
      console.error("Error getting stash diff:", error);
      alert(`Failed to get diff for stash@{${stashIndex}}:\n${error}`);
    }
  };

  const renderActionsButton = () => (
    <PaneIconButton
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setGitActionsMenuAnchor({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        });
        setShowGitActionsMenu(!showGitActionsMenu);
        setShowStashList(false);
      }}
      tooltip="Git Actions"
    >
      <MoreHorizontal />
    </PaneIconButton>
  );

  const renderSelectRepositoryButton = () => (
    <Button
      onClick={handleSelectRepository}
      disabled={isSelectingRepo}
      variant="ghost"
      size="sm"
      className={cn(
        "mt-1.5 ui-font ui-text-sm text-accent transition-colors hover:text-accent/80",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      tooltip="Select repository folder"
    >
      {isSelectingRepo ? "Selecting..." : "Browse Repository"}
    </Button>
  );

  const filteredStashes = useMemo(() => {
    const query = stashSearchQuery.trim().toLowerCase();
    if (!query) {
      return stashes;
    }

    return stashes.filter(
      (stash) =>
        stash.message.toLowerCase().includes(query) || `stash@{${stash.index}}`.includes(query),
    );
  }, [stashSearchQuery, stashes]);

  const gitTabs: Array<{
    id: GitSidebarTab;
    label: string;
    icon: ReactNode;
  }> = settings.gitSidebarTabOrder
    .map((id) => {
      const tabMap: Record<GitSidebarTab, { id: GitSidebarTab; label: string; icon: ReactNode }> = {
        changes: {
          id: "changes",
          label: "Changes",
          icon: <FolderSimpleStar size={16} weight="duotone" />,
        },
        history: {
          id: "history",
          label: "History",
          icon: <ClockCounterClockwise size={16} weight="duotone" />,
        },
        worktrees: {
          id: "worktrees",
          label: "Worktrees",
          icon: <TreeStructure size={16} weight="duotone" />,
        },
      };

      return tabMap[id];
    })
    .filter(Boolean);

  if (!activeRepoPath) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className={paneHeaderClassName("justify-between rounded-lg")}>
          <div className="flex items-center gap-2">{renderActionsButton()}</div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="ui-font flex flex-col items-center text-center">
            <span className="ui-text-sm text-text-lighter">No repository selected</span>
            {renderSelectRepositoryButton()}
            {repoSelectionError && (
              <span className="ui-text-sm mt-1.5 text-red-400">{repoSelectionError}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingGitData && !gitStatus) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className={paneHeaderClassName("justify-between rounded-lg")}>
          <div className="flex items-center gap-2">{renderActionsButton()}</div>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="ui-font ui-text-sm text-center text-text-lighter">
            Loading Git status...
          </div>
        </div>
      </div>
    );
  }

  if (!gitStatus) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className={paneHeaderClassName("justify-between rounded-lg")}>
          <div className="flex items-center gap-2">{renderActionsButton()}</div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="ui-font flex flex-col items-center text-center">
            <span className="ui-text-sm text-text-lighter">Not a Git repository</span>
            {renderSelectRepositoryButton()}
            {repoSelectionError && (
              <span className="ui-text-sm mt-1.5 text-red-400">{repoSelectionError}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const stagedFiles = visibleGitFiles.filter((f) => f.staged);
  const refreshAfterAction = settings.autoRefreshGitStatus ? handleManualRefresh : undefined;
  const handleGitFileClick = settings.openDiffOnClick ? handleViewFileDiff : handleOpenOriginalFile;

  return (
    <>
      <div className="ui-font ui-text-sm flex h-full select-none flex-col gap-2 p-2">
        <div className={paneHeaderClassName("rounded-lg")}>
          <div className={cn(PANE_GROUP_BASE, "min-w-0 flex-1")}>
            <GitProjectSelector onRepositoryChange={() => setRepoSelectionError(null)} />
            <GitBranchManager
              currentBranch={gitStatus.branch}
              repoPath={activeRepoPath}
              onBranchChange={refreshAfterAction}
            />
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <span className="ui-text-sm shrink-0 text-text-lighter">
                {gitStatus.ahead > 0 && <span className="text-git-added">↑{gitStatus.ahead}</span>}
                {gitStatus.behind > 0 && (
                  <span className="text-git-deleted">↓{gitStatus.behind}</span>
                )}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <PaneIconButton
              onClick={handleManualRefresh}
              disabled={isLoadingGitData || isRefreshing}
              className="disabled:opacity-50"
              tooltip="Refresh"
              aria-label="Refresh git status"
            >
              <RefreshCw className={isLoadingGitData || isRefreshing ? "animate-spin" : ""} />
            </PaneIconButton>
            {renderActionsButton()}
          </div>
        </div>

        <div className="@container flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <Tabs
            variant="segmented"
            size="md"
            contentLayout="stacked"
            reorderable
            onReorder={(orderedIds) =>
              updateSetting("gitSidebarTabOrder", orderedIds as typeof settings.gitSidebarTabOrder)
            }
            className={EQUAL_WIDTH_SEGMENTED_TABS_CLASS_NAME}
            items={gitTabs.map((tab) => ({
              id: tab.id,
              isActive: activeTab === tab.id,
              onClick: () => setActiveTab(tab.id),
              role: "tab",
              tabIndex: 0,
              icon: <div className="relative flex items-center justify-center">{tab.icon}</div>,
              label: <span className="ui-text-sm text-center leading-none">{tab.label}</span>,
              tooltip: {
                content: tab.label,
                side: "bottom",
              },
              className: EQUAL_WIDTH_SEGMENTED_TAB_ITEM_CLASS_NAME,
            }))}
          />

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === "changes" && (
              <div className="h-full overflow-hidden">
                <GitStatusPanel
                  files={visibleGitFiles}
                  fileDiffStats={fileDiffStats}
                  onFileSelect={handleGitFileClick}
                  onOpenFile={handleOpenOriginalFile}
                  onRefresh={refreshAfterAction}
                  repoPath={activeRepoPath}
                />
              </div>
            )}

            {activeTab === "history" && (
              <div className="h-full overflow-hidden">
                <GitCommitHistory
                  isCollapsed={false}
                  onToggle={() => {}}
                  onViewCommitDiff={handleViewCommitDiff}
                  repoPath={activeRepoPath}
                  showHeader={false}
                />
              </div>
            )}

            {activeTab === "worktrees" && (
              <div className="h-full overflow-hidden">
                <GitWorktreeManager
                  embedded
                  repoPath={activeRepoPath}
                  onRefresh={refreshAfterAction}
                  onSelectWorktree={(worktreePath) => {
                    selectRepository(worktreePath);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <GitCommitPanel
            stagedFilesCount={stagedFiles.length}
            stagedFiles={stagedFiles}
            currentBranch={gitStatus.branch}
            repoPath={activeRepoPath}
            onCommitSuccess={refreshAfterAction}
          />
        </div>
      </div>

      <GitActionsMenu
        isOpen={showGitActionsMenu}
        anchorRect={gitActionsMenuAnchor}
        onClose={() => {
          setShowGitActionsMenu(false);
          setGitActionsMenuAnchor(null);
        }}
        hasGitRepo={!!gitStatus}
        repoPath={activeRepoPath}
        onRefresh={refreshAfterAction}
        onOpenRemoteManager={() => setShowRemoteManager(true)}
        onOpenTagManager={() => setShowTagManager(true)}
        onViewStashes={() => {
          setShowStashList(true);
          setStashSearchQuery("");
        }}
        onSelectRepository={handleSelectRepository}
        isSelectingRepository={isSelectingRepo}
      />
      <GitCommandSurface
        isOpen={showStashList}
        onClose={() => {
          setShowStashList(false);
          setStashSearchQuery("");
        }}
        query={stashSearchQuery}
        onQueryChange={setStashSearchQuery}
        placeholder="Search stashes..."
        meta={`${stashes.length} stash${stashes.length === 1 ? "" : "es"}`}
      >
        <CommandList>
          {filteredStashes.length === 0 ? (
            <CommandEmpty>
              {stashSearchQuery.trim() ? "No matching stashes" : "No stashes"}
            </CommandEmpty>
          ) : (
            filteredStashes.map((stash) => (
              <CommandItem
                key={stash.index}
                className="ui-font h-auto min-h-8 items-start whitespace-normal px-2 py-1.5 leading-normal"
                onClick={() => {
                  void handleViewStashDiff(stash.index);
                  setShowStashList(false);
                  setStashSearchQuery("");
                }}
              >
                <Eye className="mt-0.5 size-4 shrink-0 text-text-lighter" />
                <div className="min-w-0 flex-1">
                  <div className="ui-text-sm text-text">{`stash@{${stash.index}}`}</div>
                  <div className="ui-text-xs mt-0.5 break-words text-text-lighter">
                    {stash.message || "Stashed changes"}
                  </div>
                  <div className="ui-text-xs mt-1 inline-flex items-center gap-1 text-text-lighter/80">
                    <ClockCounterClockwise className="size-3.5" />
                    {formatRelativeDate(stash.date)}
                  </div>
                </div>
              </CommandItem>
            ))
          )}
        </CommandList>
      </GitCommandSurface>

      <GitRemoteManager
        isOpen={showRemoteManager}
        onClose={() => setShowRemoteManager(false)}
        repoPath={activeRepoPath}
        onRefresh={refreshAfterAction}
      />

      <GitTagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        repoPath={activeRepoPath}
        onRefresh={refreshAfterAction}
      />
    </>
  );
};

export default memo(GitView);
