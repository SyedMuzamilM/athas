import { cva } from "class-variance-authority";
import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Tooltip from "@/ui/tooltip";
import { cn } from "@/utils/cn";

export type TabSize = "xs" | "sm" | "md";
export type TabVariant = "default" | "pill" | "segmented";
export type TabLabelPosition = "start" | "center" | "end";
export type TabContentLayout = "inline" | "stacked";

export interface TabProps extends HTMLAttributes<HTMLDivElement> {
  isActive: boolean;
  isDragged?: boolean;
  maxWidth?: number;
  action?: ReactNode;
  size?: TabSize;
  variant?: TabVariant;
  labelPosition?: TabLabelPosition;
  contentLayout?: TabContentLayout;
  children: ReactNode;
}

export interface TabsItem {
  id: string;
  label?: ReactNode;
  icon?: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
  role?: HTMLAttributes<HTMLDivElement>["role"];
  tabIndex?: number;
  disabled?: boolean;
  className?: string;
  tooltip?: {
    content: string;
    shortcut?: string;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
  };
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: TabsItem[];
  size?: TabSize;
  variant?: TabVariant;
  labelPosition?: TabLabelPosition;
  contentLayout?: TabContentLayout;
  reorderable?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}

export const EQUAL_WIDTH_SEGMENTED_TABS_CLASS_NAME =
  "grid h-auto w-full shrink-0 grid-cols-3 gap-1 rounded-xl border border-border/60 bg-secondary-bg/40 p-1";

export const EQUAL_WIDTH_SEGMENTED_TAB_ITEM_CLASS_NAME =
  "h-10 w-full min-w-0 rounded-lg px-2.5 py-2 transition-colors [&>div]:gap-1.5";

const DRAG_THRESHOLD = 4;

interface DragState {
  pointerId: number;
  draggedId: string;
  startX: number;
  startY: number;
  isDragging: boolean;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function areOrdersEqual<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

const tabVariants = cva(
  "group/tab relative shrink-0 cursor-pointer select-none whitespace-nowrap transition-[transform,opacity,color,background-color,border-color] duration-150 ease-out",
  {
    variants: {
      size: {
        xs: "ui-text-sm flex h-5 items-center gap-1 px-2.5",
        sm: "ui-text-sm flex h-7 items-center gap-1 px-2.5",
        md: "ui-text-sm flex h-8 items-center gap-1 px-3",
      },
      variant: {
        default: "rounded-md",
        pill: "rounded-md border border-transparent",
        segmented: "h-full w-full rounded-none border-0",
      },
      active: {
        true: "",
        false: "",
      },
      dragged: {
        true: "opacity-30",
        false: "opacity-100",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
      active: false,
      dragged: false,
    },
    compoundVariants: [
      {
        variant: "default",
        active: true,
        className: "bg-primary-bg/45 text-text",
      },
      {
        variant: "default",
        active: false,
        className: "text-text-lighter/90 hover:bg-hover hover:text-text",
      },
      {
        variant: "pill",
        active: true,
        className: "border-border/70 bg-primary-bg text-text",
      },
      {
        variant: "pill",
        active: false,
        className: "text-text-lighter hover:bg-hover hover:text-text",
      },
      {
        variant: "segmented",
        size: "xs",
        className: "px-2.5",
      },
      {
        variant: "segmented",
        size: "sm",
        className: "px-2.5",
      },
      {
        variant: "segmented",
        size: "md",
        className: "px-3",
      },
      {
        variant: "segmented",
        active: true,
        className: "bg-hover/80 text-text",
      },
      {
        variant: "segmented",
        active: false,
        className: "text-text-lighter hover:bg-hover/50 hover:text-text",
      },
    ],
  },
);

const tabsListVariants = cva("flex rounded-lg border border-border/70 bg-primary-bg/65", {
  variants: {
    variant: {
      default: "items-center gap-0.5 p-0.5",
      pill: "items-center gap-0.5 p-0.5",
      segmented: "h-6 items-stretch overflow-hidden",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const Tab = forwardRef<HTMLDivElement, TabProps>(function Tab(
  {
    isActive,
    isDragged = false,
    maxWidth = 290,
    action,
    size = "md",
    variant = "default",
    labelPosition = "center",
    contentLayout = "inline",
    children,
    className,
    style,
    ...props
  },
  ref,
) {
  const actionInsetClass =
    action == null || variant === "segmented"
      ? ""
      : size === "xs"
        ? "pr-5"
        : size === "sm"
          ? "pr-6"
          : "pr-7";

  const contentAlignmentClass =
    labelPosition === "start"
      ? "justify-start text-left"
      : labelPosition === "end"
        ? "justify-end text-right"
        : "justify-center text-center";

  const contentLayoutClass =
    contentLayout === "stacked" ? "flex-col justify-center gap-1" : "flex-row gap-1.5";

  return (
    <div
      ref={ref}
      className={cn(
        tabVariants({ size, variant, active: isActive, dragged: isDragged }),
        actionInsetClass,
        className,
      )}
      style={{ maxWidth, ...style }}
      {...props}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center",
          contentAlignmentClass,
          contentLayoutClass,
        )}
      >
        {children}
      </div>
      {action}
    </div>
  );
});

export const TabsList = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { variant?: TabVariant }
>(function TabsList({ className, variant = "default", ...props }, ref) {
  return <div ref={ref} className={cn(tabsListVariants({ variant }), className)} {...props} />;
});

export function Tabs({
  items,
  size = "md",
  variant = "default",
  labelPosition = "center",
  contentLayout = "inline",
  reorderable = false,
  onReorder,
  className,
  ...props
}: TabsProps) {
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const orderedIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previewOrderRef = useRef(orderedIds);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState(orderedIds);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    previewOrderRef.current = previewOrder;
  }, [previewOrder]);

  useEffect(() => {
    if (dragStateRef.current) {
      return;
    }

    setPreviewOrder(orderedIds);
  }, [orderedIds]);

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("user-select");
    };
  }, []);

  const commitOrder = (nextOrder: string[]) => {
    if (onReorder && !areOrdersEqual(nextOrder, orderedIds)) {
      onReorder(nextOrder);
    }
  };

  const finishDrag = (cancelled = false) => {
    dragStateRef.current = null;
    document.body.style.removeProperty("user-select");
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);

    const committedOrder = previewOrderRef.current;
    setDraggedId(null);

    if (cancelled) {
      setPreviewOrder(orderedIds);
      previewOrderRef.current = orderedIds;
      return;
    }

    commitOrder(committedOrder);
  };

  const getInsertionIndex = (clientX: number, currentOrder: string[], movingId: string): number => {
    const movableIds = currentOrder.filter((id) => id !== movingId);

    for (let index = 0; index < movableIds.length; index += 1) {
      const element = itemRefs.current[movableIds[index]];
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        return index;
      }
    }

    return movableIds.length;
  };

  const handlePointerMove = (event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (!dragState.isDragging) {
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }

      dragState.isDragging = true;
      document.body.style.setProperty("user-select", "none");
      suppressClickRef.current = dragState.draggedId;
      setDraggedId(dragState.draggedId);
    }

    const currentOrder = previewOrderRef.current;
    const currentIndex = currentOrder.indexOf(dragState.draggedId);
    const insertionIndex = getInsertionIndex(event.clientX, currentOrder, dragState.draggedId);
    const targetIndex = insertionIndex > currentIndex ? insertionIndex - 1 : insertionIndex;
    const nextOrder = moveItem(currentOrder, currentIndex, targetIndex);

    if (!areOrdersEqual(nextOrder, currentOrder)) {
      previewOrderRef.current = nextOrder;
      setPreviewOrder(nextOrder);
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    finishDrag(false);
  };

  const handlePointerCancel = (event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    finishDrag(true);
  };

  const handlePointerDown = (itemId: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!reorderable || !onReorder || event.button !== 0 || items.length < 2) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      draggedId: itemId,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };
    previewOrderRef.current = previewOrder;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  };

  const handleKeyDown = (itemId: string) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!reorderable || !onReorder || items.length < 2 || !event.shiftKey) {
      return;
    }

    const currentIndex = orderedIds.indexOf(itemId);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = Math.min(orderedIds.length - 1, currentIndex + 1);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = orderedIds.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    if (nextIndex === currentIndex) {
      return;
    }

    const nextOrder = moveItem(orderedIds, currentIndex, nextIndex);
    setPreviewOrder(nextOrder);
    previewOrderRef.current = nextOrder;
    commitOrder(nextOrder);
  };

  const handleClickCapture = (itemId: string) => (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current !== itemId) {
      return;
    }

    suppressClickRef.current = null;
    event.preventDefault();
    event.stopPropagation();
  };

  const renderTab = (item: TabsItem, isDragged = false) => {
    const tabNode = (
      <Tab
        key={item.id}
        role={item.role}
        aria-selected={item.isActive}
        aria-label={item.ariaLabel}
        tabIndex={item.tabIndex}
        title={item.title}
        isActive={!!item.isActive}
        isDragged={isDragged}
        size={size}
        variant={variant}
        labelPosition={labelPosition}
        contentLayout={contentLayout}
        className={item.className}
        onClick={item.onClick}
      >
        {item.icon}
        {item.label}
      </Tab>
    );

    if (!item.tooltip) {
      return tabNode;
    }

    return (
      <Tooltip
        key={item.id}
        content={item.tooltip.content}
        shortcut={item.tooltip.shortcut}
        side={item.tooltip.side}
        className={item.tooltip.className}
      >
        {tabNode}
      </Tooltip>
    );
  };

  return (
    <TabsList variant={variant} className={className} {...props}>
      {(reorderable ? previewOrder : orderedIds).map((itemId) => {
        const item = itemMap.get(itemId);
        if (!item) {
          return null;
        }

        return (
          <div
            key={item.id}
            ref={(element) => {
              itemRefs.current[item.id] = element;
            }}
            className={cn(
              "relative flex min-w-0 w-full items-stretch",
              reorderable && onReorder && items.length > 1 && "cursor-grab active:cursor-grabbing",
            )}
            onPointerDown={handlePointerDown(item.id)}
            onKeyDown={handleKeyDown(item.id)}
            onClickCapture={handleClickCapture(item.id)}
          >
            {renderTab(item, draggedId === item.id)}
          </div>
        );
      })}
    </TabsList>
  );
}
