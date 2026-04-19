import { Folder, GitBranch, GitPullRequest, MagnifyingGlass } from "@phosphor-icons/react";
import { Fragment, useMemo } from "react";
import type { CoreFeaturesState } from "@/features/settings/types/feature";
import { useExtensionViews } from "@/extensions/ui/hooks/use-extension-views";
import { DynamicIcon } from "@/extensions/ui/components/dynamic-icon";
import { normalizeItemOrder } from "@/features/layout/config/item-order";
import { useSettingsStore } from "@/features/settings/store";
import { Tab, TabsList, type TabsItem } from "@/ui/tabs";
import Tooltip from "@/ui/tooltip";
import type { SidebarView } from "../../utils/sidebar-pane-utils";

function orderItems<T extends { id: string }>(items: T[], orderedIds: string[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const orderedItems = orderedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is T => Boolean(item));
  const missingItems = items.filter((item) => !orderedIds.includes(item.id));
  return [...orderedItems, ...missingItems];
}

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

  const items: TabsItem[] = [
    {
      id: "files",
      icon: <Folder className={compact ? "size-4" : undefined} weight="duotone" />,
      isActive: isFilesActive,
      onClick: () => onViewChange("files"),
      role: "tab",
      ariaLabel: "Files",
      className: compact ? "min-w-7 [&_svg]:size-4" : "w-8 rounded-md",
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
            icon: <MagnifyingGlass className={compact ? "size-4" : undefined} weight="duotone" />,
            onClick: onSearchClick,
            ariaLabel: "Search",
            className: compact ? "min-w-7 [&_svg]:size-4" : "w-8 rounded-md",
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
            icon: <GitBranch className={compact ? "size-4" : undefined} weight="duotone" />,
            isActive: isGitViewActive,
            onClick: () => onViewChange("git"),
            role: "tab",
            ariaLabel: "Git Source Control",
            className: compact ? "min-w-7 [&_svg]:size-4" : "w-8 rounded-md",
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
            icon: <GitPullRequest className={compact ? "size-4" : undefined} weight="duotone" />,
            isActive: isGitHubPRsViewActive,
            onClick: () => onViewChange("github-prs"),
            role: "tab",
            ariaLabel: "GitHub Pull Requests",
            className: compact ? "min-w-7 [&_svg]:size-4" : "w-8 rounded-md",
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
          className: compact ? "min-w-7 [&_svg]:size-4" : "w-8 rounded-md",
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

  const orderedItems = orderItems(items, orderedIds);

  const renderedItems = orderedItems.map((item) => {
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
      {renderedItems.map((item) => (
        <Fragment key={item.id}>{item.content}</Fragment>
      ))}
    </TabsList>
  );
};
