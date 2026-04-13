import type { AriaAttributes, ComponentType, ReactNode } from "react";
import {
  Combobox as ShadcnCombobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { controlFieldSizeVariants, controlFieldSurfaceVariants } from "@/ui/control-field";
import type { SelectOption } from "@/ui/select";
import { cn } from "@/utils/cn";

export interface ComboboxProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
  variant?: "default" | "ghost" | "secondary" | "outline";
  leftIcon?: ReactNode | ComponentType<{ size?: number; className?: string }>;
  id?: string;
  title?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  "aria-label"?: AriaAttributes["aria-label"];
}

function renderTriggerIcon(icon: ComboboxProps["leftIcon"], size: "xs" | "sm" | "md"): ReactNode {
  if (!icon) return null;

  if (
    typeof icon === "function" ||
    (typeof icon === "object" && icon !== null && "render" in icon)
  ) {
    const Icon = icon as ComponentType<{ size?: number; className?: string }>;
    return <Icon size={size === "md" ? 14 : 12} className="shrink-0 text-text-lighter" />;
  }

  return <span className="shrink-0 text-text-lighter">{icon}</span>;
}

export default function Combobox({
  value,
  options,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No matching options",
  className = "",
  menuClassName = "",
  disabled = false,
  size = "sm",
  variant = "ghost",
  leftIcon,
  id,
  title,
  open,
  onOpenChange,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const triggerIcon = renderTriggerIcon(leftIcon, size);

  return (
    <ShadcnCombobox
      items={options}
      value={selectedOption}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      onValueChange={(nextOption) => {
        if (nextOption) {
          onChange(nextOption.value);
        }
      }}
      open={open}
      onOpenChange={(nextOpen) => onOpenChange?.(nextOpen)}
      autoHighlight
    >
      <div className="min-w-0">
        <ComboboxTrigger
          id={id}
          title={title}
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            controlFieldSurfaceVariants({ variant }),
            controlFieldSizeVariants({ size }),
            "ui-font inline-flex w-full min-w-0 items-center justify-between gap-2 px-2 text-left",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {triggerIcon}
            {selectedOption?.icon && (
              <span className="size-3 shrink-0 text-text-lighter">{selectedOption.icon}</span>
            )}
            <span className="block min-w-0 flex-1 truncate text-left">
              <ComboboxValue placeholder={<span className="text-text-lighter">{placeholder}</span>}>
                {(option: SelectOption | null) => (
                  <span className={option ? "text-text" : "text-text-lighter"}>
                    {option?.label ?? placeholder}
                  </span>
                )}
              </ComboboxValue>
            </span>
          </span>
        </ComboboxTrigger>

        <ComboboxContent
          className={cn(
            "ui-font z-[10040] rounded-2xl border border-border bg-secondary-bg/95 shadow-xl backdrop-blur-sm",
            menuClassName,
          )}
        >
          <ComboboxInput
            placeholder={searchPlaceholder}
            disabled={disabled}
            showTrigger={false}
            showClear
            className="ui-font ui-text-sm w-full"
          />
          <ComboboxEmpty className="ui-font ui-text-sm flex p-3 text-center text-text-lighter">
            {emptyText}
          </ComboboxEmpty>
          <ComboboxList className="p-1">
            <ComboboxCollection>
              {(option: SelectOption) => (
                <ComboboxItem
                  key={option.value}
                  value={option}
                  className="ui-font ui-text-sm flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1.5 text-text data-highlighted:bg-hover-bg data-highlighted:text-text"
                >
                  {option.icon && (
                    <span className="size-3 shrink-0 text-text-lighter">{option.icon}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </div>
    </ShadcnCombobox>
  );
}
