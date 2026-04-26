import { Check, Lock, WarningCircle } from "@phosphor-icons/react";
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProBadge } from "@/extensions/ui/components/pro-badge";
import { useProFeature } from "@/extensions/ui/hooks/use-pro-feature";
import { canUseProviderWithoutApiKey } from "@/features/ai/lib/provider-access";
import { getProviderApiToken } from "@/features/ai/services/ai-token-service";
import { getProvider } from "@/features/ai/services/providers/ai-provider-registry";
import { useAIChatStore } from "@/features/ai/store/store";
import { getProviderById } from "@/features/ai/types/providers";
import { useAuthStore } from "@/features/window/stores/auth-store";
import { Button, buttonVariants } from "@/ui/button";
import { Dropdown, dropdownItemClassName } from "@/ui/dropdown";
import { cn } from "@/utils/cn";
import {
  chatComposerControlClassName,
  chatComposerDropdownClassName,
} from "../input/chat-composer-control-styles";

interface ModelSelectorProps {
  providerId: string;
  modelId: string;
  onChange: (modelId: string) => void;
  appearance?: "settings" | "composer";
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tooltip?: string;
}

export function ModelSelector({
  providerId,
  modelId,
  onChange,
  appearance = "settings",
  disabled,
  className,
  triggerClassName,
  open,
  onOpenChange,
  tooltip,
}: ModelSelectorProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const [query, setQuery] = useState("");
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  const triggerInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { isPro } = useProFeature();
  const subscription = useAuthStore((state) => state.subscription);
  const { dynamicModels, setDynamicModels } = useAIChatStore();

  const provider = getProviderById(providerId);
  const isComposer = appearance === "composer";

  const setOpen = (nextOpen: boolean) => {
    if (disabled && nextOpen) return;
    if (open === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  const fetchDynamicModels = useCallback(async () => {
    const config = getProviderById(providerId);
    const instance = getProvider(providerId);

    setModelFetchError(null);
    if (!instance?.getModels) return;

    const apiKey = config?.requiresApiKey ? await getProviderApiToken(providerId) : undefined;
    const canFetchWithoutApiKey = providerId === "openrouter";
    const canUseWithoutApiKey = canUseProviderWithoutApiKey({
      providerId,
      subscription,
      hasStoredKey: !!apiKey,
      requiresApiKey: config?.requiresApiKey ?? true,
    });
    if (config?.requiresApiKey && !canUseWithoutApiKey && !canFetchWithoutApiKey) {
      return;
    }

    setIsLoadingModels(true);
    try {
      const models = await instance.getModels(apiKey || undefined);
      setDynamicModels(providerId, models);
      if (models.length === 0) {
        setModelFetchError(
          providerId === "ollama"
            ? "No models detected. Please install a model in Ollama."
            : "No models found.",
        );
      }
    } catch {
      setModelFetchError("Failed to fetch models");
    } finally {
      setIsLoadingModels(false);
    }
  }, [providerId, setDynamicModels, subscription]);

  useEffect(() => {
    void fetchDynamicModels();
  }, [fetchDynamicModels]);

  const availableModels = useMemo(() => {
    const staticModels = provider?.models || [];
    const fetchedModels = dynamicModels[providerId] || [];
    if (fetchedModels.length === 0) {
      return staticModels;
    }

    const mergedModels = new Map(staticModels.map((model) => [model.id, model]));
    for (const model of fetchedModels) {
      const existingModel = mergedModels.get(model.id);
      mergedModels.set(model.id, {
        id: model.id,
        name: model.name,
        proOnly: existingModel?.proOnly,
        maxTokens: model.maxTokens ?? existingModel?.maxTokens ?? 4096,
      });
    }

    return Array.from(mergedModels.values());
  }, [dynamicModels, provider?.models, providerId]);

  useEffect(() => {
    if (availableModels.length === 0) return;
    if (!availableModels.some((model) => model.id === modelId)) {
      onChange(availableModels[0].id);
    }
  }, [availableModels, modelId, onChange]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }
    requestAnimationFrame(() => triggerInputRef.current?.focus());
  }, [isOpen]);

  const currentModelName = useMemo(() => {
    const selectedModel = availableModels.find((model) => model.id === modelId);
    if (selectedModel) return selectedModel.name;
    if (isLoadingModels) return "Loading models...";
    if (providerId === "openrouter" && modelId.trim().length > 0) return modelId;
    return "Select model";
  }, [availableModels, isLoadingModels, modelId, providerId]);

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return availableModels.filter((model) => {
      if (!normalizedQuery) return true;
      return (
        model.name.toLowerCase().includes(normalizedQuery) ||
        model.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [availableModels, query]);

  const firstSelectableModel = filteredModels.find((model) => !(model.proOnly && !isPro));
  const triggerClass = cn(
    isComposer
      ? chatComposerControlClassName("w-fit max-w-[176px]")
      : "ui-font w-[min(260px,100%)] justify-start rounded-lg border border-border/70 bg-secondary-bg px-2.5 text-xs",
    triggerClassName,
  );
  const triggerInputWidth = `${Math.min(
    Math.max(query.length || currentModelName.length, 10),
    24,
  )}ch`;

  const handleTriggerInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "Enter" && firstSelectableModel) {
      event.preventDefault();
      onChange(firstSelectableModel.id);
      setOpen(false);
    }
  };

  return (
    <div className={className}>
      {isOpen ? (
        <input
          ref={(node) => {
            triggerInputRef.current = node;
            triggerRef.current = node;
          }}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={currentModelName}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Search AI models"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleTriggerInputKeyDown}
          onMouseDown={(event) => event.stopPropagation()}
          className={cn(
            buttonVariants({
              variant: isComposer ? "ghost" : "secondary",
              size: isComposer ? "xs" : "sm",
            }),
            triggerClass,
            "cursor-text text-left outline-none placeholder:text-text",
          )}
          style={isComposer ? { width: triggerInputWidth } : undefined}
        />
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
          aria-label="Select AI model"
          onClick={() => setOpen(!isOpen)}
          className={triggerClass}
        >
          <span className="min-w-0 truncate text-text">{currentModelName}</span>
        </Button>
      )}

      <Dropdown
        isOpen={isOpen}
        anchorRef={triggerRef}
        anchorSide="bottom"
        onClose={() => setOpen(false)}
        className={cn(
          isComposer
            ? chatComposerDropdownClassName("w-[min(320px,calc(100vw-16px))] p-0")
            : "w-[min(360px,calc(100vw-16px))] overflow-hidden rounded-2xl p-0",
        )}
        portalContainer={triggerRef.current?.closest(".ai-chat-container")}
        style={{ maxHeight: "420px" }}
      >
        <div className="custom-scrollbar-thin max-h-80 overflow-y-auto p-1.5">
          {modelFetchError && (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2 py-1.5 text-text-lighter text-xs">
              <WarningCircle className="shrink-0 text-warning" />
              <span>{modelFetchError}</span>
            </div>
          )}

          {filteredModels.length === 0 ? (
            <div className="p-4 text-center text-text-lighter text-xs">No models found</div>
          ) : (
            filteredModels.map((model) => {
              const isCurrent = model.id === modelId;
              const isLocked = Boolean(model.proOnly && !isPro);

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    if (isLocked) return;
                    onChange(model.id);
                    setOpen(false);
                  }}
                  disabled={isLocked}
                  className={cn(
                    dropdownItemClassName(),
                    "mb-1 min-h-8 gap-2 py-2 text-xs last:mb-0",
                    isCurrent && "bg-selected/90 ring-1 ring-accent/10",
                  )}
                >
                  {isLocked && <Lock className="shrink-0 text-text-lighter" />}
                  <span className="min-w-0 flex-1 truncate text-text">{model.name}</span>
                  {model.proOnly && <ProBadge />}
                  {isCurrent && <Check className="shrink-0 text-accent" />}
                </button>
              );
            })
          )}
        </div>
      </Dropdown>
    </div>
  );
}
