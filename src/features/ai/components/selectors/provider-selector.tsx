import { Check, WarningCircle } from "@phosphor-icons/react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ProviderIcon } from "@/features/ai/components/icons/provider-icons";
import { canUseProviderWithoutApiKey } from "@/features/ai/lib/provider-access";
import { useAIChatStore } from "@/features/ai/store/store";
import { getAvailableProviders, getProviderById } from "@/features/ai/types/providers";
import { useAuthStore } from "@/features/window/stores/auth-store";
import { Button, buttonVariants } from "@/ui/button";
import { Dropdown, dropdownItemClassName } from "@/ui/dropdown";
import { cn } from "@/utils/cn";
import {
  chatComposerControlClassName,
  chatComposerDropdownClassName,
} from "../input/chat-composer-control-styles";

interface ProviderSelectorProps {
  providerId: string;
  onChange: (providerId: string) => void;
  appearance?: "settings" | "composer";
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tooltip?: string;
}

export function ProviderSelector({
  providerId,
  onChange,
  appearance = "settings",
  disabled,
  className,
  triggerClassName,
  open,
  onOpenChange,
  tooltip,
}: ProviderSelectorProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const [query, setQuery] = useState("");
  const triggerInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const subscription = useAuthStore((state) => state.subscription);
  const hasProviderApiKey = useAIChatStore((state) => state.hasProviderApiKey);

  const providers = getAvailableProviders();
  const currentProvider = getProviderById(providerId);
  const isComposer = appearance === "composer";

  const setOpen = (nextOpen: boolean) => {
    if (disabled && nextOpen) return;
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }
    requestAnimationFrame(() => triggerInputRef.current?.focus());
  }, [isOpen]);

  const filteredProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return providers.filter((provider) => {
      if (!normalizedQuery) return true;
      return (
        provider.name.toLowerCase().includes(normalizedQuery) ||
        provider.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [providers, query]);

  const firstSelectableProvider = filteredProviders[0];
  const triggerClass = cn(
    isComposer
      ? chatComposerControlClassName("w-fit max-w-[128px]")
      : "ui-font w-[min(220px,100%)] justify-start gap-2 rounded-lg border border-border/70 bg-secondary-bg px-2.5 text-xs",
    triggerClassName,
  );
  const currentProviderName = currentProvider?.name || providerId;
  const triggerInputWidth = `${Math.min(
    Math.max(query.length || currentProviderName.length, 8),
    18,
  )}ch`;

  const handleTriggerInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Enter" && firstSelectableProvider) {
      event.preventDefault();
      onChange(firstSelectableProvider.id);
      setOpen(false);
    }
  };

  return (
    <div className={className}>
      {isOpen ? (
        <div
          ref={(node) => {
            triggerRef.current = node;
          }}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className={cn(
            buttonVariants({
              variant: isComposer ? "ghost" : "secondary",
              size: isComposer ? "xs" : "sm",
            }),
            triggerClass,
            "cursor-text",
          )}
          style={isComposer ? { width: triggerInputWidth } : undefined}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => triggerInputRef.current?.focus()}
        >
          <ProviderIcon
            providerId={providerId}
            size={isComposer ? 12 : 14}
            className="shrink-0 text-text-lighter"
          />
          <input
            ref={triggerInputRef}
            type="text"
            value={query}
            disabled={disabled}
            placeholder={currentProviderName}
            aria-label="Search AI providers"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleTriggerInputKeyDown}
            className="ui-font min-w-0 flex-1 bg-transparent p-0 text-left text-text outline-none placeholder:text-text disabled:pointer-events-none"
          />
        </div>
      ) : (
        <Button
          ref={(node) => {
            triggerRef.current = node;
          }}
          type="button"
          variant={isComposer ? "ghost" : "secondary"}
          size={isComposer ? "xs" : "sm"}
          disabled={disabled}
          tooltip={tooltip}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Select AI provider"
          onClick={() => setOpen(!isOpen)}
          className={triggerClass}
        >
          <ProviderIcon
            providerId={providerId}
            size={isComposer ? 12 : 14}
            className="shrink-0 text-text-lighter"
          />
          <span className="min-w-0 truncate text-text">{currentProviderName}</span>
        </Button>
      )}

      <Dropdown
        isOpen={isOpen}
        anchorRef={triggerRef}
        anchorSide="bottom"
        onClose={() => setOpen(false)}
        className={cn(
          isComposer
            ? chatComposerDropdownClassName("w-[min(260px,calc(100vw-16px))] p-0")
            : "w-[min(320px,calc(100vw-16px))] overflow-hidden rounded-2xl p-0",
        )}
        portalContainer={triggerRef.current?.closest(".ai-chat-container")}
        style={{ maxHeight: "360px" }}
      >
        <div className="custom-scrollbar-thin max-h-72 overflow-y-auto p-1.5">
          {filteredProviders.map((provider) => {
            const isCurrent = provider.id === providerId;
            const hasKey = canUseProviderWithoutApiKey({
              providerId: provider.id,
              subscription,
              hasStoredKey: hasProviderApiKey(provider.id),
              requiresApiKey: provider.requiresApiKey,
            });

            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  onChange(provider.id);
                  setOpen(false);
                }}
                className={cn(
                  dropdownItemClassName(),
                  "mb-1 min-h-8 gap-2 py-2 text-xs last:mb-0",
                  isCurrent && "bg-selected/90 ring-1 ring-accent/10",
                )}
              >
                <ProviderIcon
                  providerId={provider.id}
                  size={14}
                  className="shrink-0 text-text-lighter"
                />
                <span className="min-w-0 flex-1 truncate text-text">{provider.name}</span>
                {provider.requiresApiKey && !hasKey && (
                  <WarningCircle className="shrink-0 text-warning" />
                )}
                {isCurrent && <Check className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </Dropdown>
    </div>
  );
}
