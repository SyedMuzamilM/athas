import { Folder, GitBranch, GitPullRequest, Search } from "lucide-react";
import { useMemo } from "react";
import type { CoreFeaturesState } from "@/features/settings/types/feature";
import { useExtensionViews } from "@/extensions/ui/hooks/use-extension-views";
import { DynamicIcon } from "@/extensions/ui/components/dynamic-icon";
import { ReorderableItemStrip } from "@/features/layout/components/reorderable-item-strip";
import { normalizeItemOrder } from "@/features/layout/config/item-order";
import { useSettingsStore } from "@/features/settings/store";
import { Tab, TabsList, type TabsItem } from "@/ui/tabs";
import Tooltip from "@/ui/tooltip";
import type { SidebarView } from "../../utils/sidebar-pane-utils";

interface SidebarPaneSelectorProps {
  activeSidebarView: SidebarView;
  isGitViewActive: boolean;
  isGitHubPRsViewActive: boolean;
  coreFeatures: CoreFeaturesState;
  onViewChange: (view: SidebarView) => void;
  onSearchClick?: () => void;
  compact?: boolean;
}

export const SidebarPaneSelector = ({
  activeSidebarView,
  isGitViewActive,
  isGitHubPRsViewActive,
  coreFeatures,
  onViewChange,
  onSearchClick,
  compact = false,
}: SidebarPaneSelectorProps) => {
  const tooltipSide = compact ? "bottom" : "right";
  const isFilesActive = !isGitViewActive && !isGitHubPRsViewActive && activeSidebarView === "files";
  const extensionViews = useExtensionViews();
  const sidebarActivityItemsOrder = useSettingsStore(
    (state) => state.settings.sidebarActivityItemsOrder,
  );
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  const items: TabsItem[] = [
    {
      id: "files",
      icon: <Folder />,
      isActive: isFilesActive,
      onClick: () => onViewChange("files"),
      role: "tab",
      ariaLabel: "Files",
      className: compact ? undefined : "w-8 rounded-md",
      tooltip: {
        content: "Files",
        shortcut: "Mod+Shift+E",
        side: tooltipSide,
      },
    },
    ...(coreFeatures.search && onSearchClick
      ? [
          {
            id: "search",
            icon: <Search />,
            onClick: onSearchClick,
            ariaLabel: "Search",
            className: compact ? undefined : "w-8 rounded-md",
            tooltip: {
              content: "Search",
              shortcut: "Mod+Shift+F",
              side: tooltipSide,
            },
          } satisfies TabsItem,
        ]
      : []),
    ...(coreFeatures.git
      ? [
          {
            id: "git",
            icon: <GitBranch />,
            isActive: isGitViewActive,
            onClick: () => onViewChange("git"),
            role: "tab",
            ariaLabel: "Git Source Control",
            className: compact ? undefined : "w-8 rounded-md",
            tooltip: {
              content: "Source Control",
              shortcut: "Mod+Shift+G",
              side: tooltipSide,
            },
          } satisfies TabsItem,
        ]
      : []),
    ...(coreFeatures.github
      ? [
          {
            id: "github-prs",
            icon: <GitPullRequest />,
            isActive: isGitHubPRsViewActive,
            onClick: () => onViewChange("github-prs"),
            role: "tab",
            ariaLabel: "GitHub Pull Requests",
            className: compact ? undefined : "w-8 rounded-md",
            tooltip: {
              content: "Pull Requests",
              side: tooltipSide,
            },
          } satisfies TabsItem,
        ]
      : []),
    ...Array.from(extensionViews.values()).map(
      (view) =>
        ({
          id: view.id,
          icon: <DynamicIcon name={view.icon} />,
          isActive: activeSidebarView === view.id,
          onClick: () => onViewChange(view.id),
          role: "tab",
          ariaLabel: view.title,
          className: compact ? undefined : "w-8 rounded-md",
          tooltip: {
            content: view.title,
            side: tooltipSide,
          },
        }) satisfies TabsItem,
    ),
  ];

  const orderedIds = useMemo(
    () =>
      normalizeItemOrder(
        sidebarActivityItemsOrder,
        items.map((item) => item.id),
      ),
    [items, sidebarActivityItemsOrder],
  );

  const reorderableItems = items.map((item) => {
    const tabNode = (
      <Tab
        role={item.role}
        aria-selected={item.isActive}
        aria-label={item.ariaLabel}
        tabIndex={item.tabIndex}
        title={item.title}
        isActive={!!item.isActive}
        size={compact ? "xs" : "sm"}
        variant={compact ? "segmented" : "default"}
        className={item.className}
        onClick={item.onClick}
      >
        {item.icon}
        {item.label}
      </Tab>
    );

    const content = item.tooltip ? (
      <Tooltip
        content={item.tooltip.content}
        shortcut={item.tooltip.shortcut}
        side={item.tooltip.side}
        className={item.tooltip.className}
      >
        {tabNode}
      </Tooltip>
    ) : (
      tabNode
    );

    return {
      id: item.id,
      label: item.tooltip?.content ?? item.ariaLabel ?? item.title ?? item.id,
      content,
    };
  });

  return (
    <TabsList
      variant={compact ? "segmented" : "default"}
      className={compact ? undefined : "gap-0.5 p-1"}
    >
      <ReorderableItemStrip
        items={reorderableItems}
        orderedIds={orderedIds}
        onReorder={(nextOrderedIds) => {
          void updateSetting("sidebarActivityItemsOrder", nextOrderedIds);
        }}
        className="gap-0.5"
      />
    </TabsList>
  );
};
