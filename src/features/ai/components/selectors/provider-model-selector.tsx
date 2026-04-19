import { motion } from "framer-motion";
import { AlertCircle, Check, ChevronDown, Lock, RefreshCw, Search, X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProviderIcon } from "@/features/ai/components/icons/provider-icons";
import ProviderApiKeyModal from "@/features/ai/components/provider-api-key-modal";
import { useAIChatStore } from "@/features/ai/store/store";
import {
  getAvailableProviders,
  getModelById,
  getProviderById,
} from "@/features/ai/types/providers";
import { useProFeature } from "@/extensions/ui/hooks/use-pro-feature";
import { ProBadge } from "@/extensions/ui/components/pro-badge";
import { getProviderApiToken } from "@/features/ai/services/ai-token-service";
import Input from "@/ui/input";
import { Button } from "@/ui/button";
import { controlFieldSizeVariants, controlFieldSurfaceVariants } from "@/ui/control-field";
import { MenuPopover } from "@/ui/dropdown";
import { cn } from "@/utils/cn";
import { getProvider } from "@/features/ai/services/providers/ai-provider-registry";

interface ProviderModelSelectorProps {
  providerId: string;
  modelId: string;
  onProviderChange: (id: string) => void;
  onModelChange: (id: string) => void;
  disabled?: boolean;
}

interface DropdownPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

interface FilteredProviderItem {
  id: string;
  name: string;
  providerId: string;
  requiresApiKey?: boolean;
  hasKey?: boolean;
}

interface FilteredModelItem {
  id: string;
  name: string;
  providerId: string;
  isCurrent?: boolean;
  proOnly?: boolean;
}

export function ProviderModelSelector({
  providerId,
  modelId,
  onProviderChange,
  onModelChange,
  disabled,
}: ProviderModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"provider" | "model">("provider");
  const [pendingProviderSelection, setPendingProviderSelection] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  const { isPro } = useProFeature();
  const { dynamicModels, setDynamicModels } = useAIChatStore();
  const apiKeyModalState = useAIChatStore((state) => state.apiKeyModalState);
  const hasProviderApiKey = useAIChatStore((state) => state.hasProviderApiKey);
  const saveApiKey = useAIChatStore((state) => state.saveApiKey);
  const removeApiKey = useAIChatStore((state) => state.removeApiKey);
  const setApiKeyModalState = useAIChatStore((state) => state.setApiKeyModalState);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const portalContainer = document.body;

  const providers = getAvailableProviders();
  const currentProvider = getProviderById(providerId);
  const currentModel = getModelById(providerId, modelId);
  const providerInstance = getProvider(providerId);
  const supportsDynamicModels = !!providerInstance?.getModels;

  const currentModelName = useMemo(() => {
    const dynamic = dynamicModels[providerId]?.find((model) => model.id === modelId);
    if (dynamic) return dynamic.name;
    return currentModel?.name || modelId;
  }, [currentModel, dynamicModels, modelId, providerId]);

  const fetchDynamicModels = useCallback(async () => {
    const config = getProviderById(providerId);
    const instance = getProvider(providerId);

    setModelFetchError(null);

    if (!instance?.getModels) {
      return;
    }

    const apiKey = config?.requiresApiKey ? await getProviderApiToken(providerId) : undefined;
    if (config?.requiresApiKey && !apiKey) {
      return;
    }

    setIsLoadingModels(true);
    try {
      const models = await instance.getModels(apiKey || undefined);
      if (models.length > 0) {
        setDynamicModels(providerId, models);
        if (!models.find((model) => model.id === modelId)) {
          onModelChange(models[0].id);
        }
      } else {
        setDynamicModels(providerId, []);
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
  }, [modelId, onModelChange, providerId, setDynamicModels]);

  useEffect(() => {
    void fetchDynamicModels();
  }, [fetchDynamicModels]);

  const filteredProviders = useMemo(() => {
    const searchLower = search.toLowerCase();
    return providers
      .filter(
        (provider) =>
          !search ||
          provider.name.toLowerCase().includes(searchLower) ||
          provider.id.toLowerCase().includes(searchLower),
      )
      .map<FilteredProviderItem>((provider) => ({
        id: `provider-${provider.id}`,
        name: provider.name,
        providerId: provider.id,
        requiresApiKey: provider.requiresApiKey,
        hasKey: !provider.requiresApiKey || hasProviderApiKey(provider.id),
      }));
  }, [hasProviderApiKey, providers, search]);

  const availableModels = useMemo(() => {
    const staticModels = currentProvider?.models || [];
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
  }, [currentProvider?.models, dynamicModels, providerId]);

  const filteredModels = useMemo(() => {
    const searchLower = search.toLowerCase();
    return availableModels
      .filter(
        (model) =>
          !search ||
          model.name.toLowerCase().includes(searchLower) ||
          model.id.toLowerCase().includes(searchLower),
      )
      .map<FilteredModelItem>((model) => ({
        id: model.id,
        name: model.name,
        providerId,
        isCurrent: model.id === modelId,
        proOnly: "proOnly" in model ? Boolean(model.proOnly) : false,
      }));
  }, [availableModels, modelId, providerId, search]);

  const selectableItems = activePanel === "provider" ? filteredProviders : filteredModels;

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      return;
    }

    setSearch("");
    setSelectedIndex(0);
  }, [isOpen]);

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const minWidth = Math.max(rect.width, 300);
    const maxWidth = Math.min(420, window.innerWidth - viewportPadding * 2);
    const safeWidth = Math.max(Math.min(minWidth, maxWidth), Math.min(280, maxWidth));
    const estimatedHeight = 480;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const openUp =
      availableBelow < Math.min(estimatedHeight, 240) && availableAbove > availableBelow;
    const maxHeight = Math.max(
      160,
      Math.min(estimatedHeight, openUp ? availableAbove - 6 : availableBelow - 6),
    );
    const measuredHeight = dropdownRef.current?.getBoundingClientRect().height ?? estimatedHeight;
    const visibleHeight = Math.min(maxHeight, measuredHeight);
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - safeWidth - viewportPadding),
    );
    const top = openUp ? Math.max(viewportPadding, rect.top - visibleHeight - 6) : rect.bottom + 6;

    setPosition({ left, top, width: safeWidth, maxHeight });
  }, [activePanel]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
  }, [isOpen, search, selectableItems.length, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
    };

    const handleReposition = () => updateDropdownPosition();

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleProviderSelect = useCallback(
    (selectedProviderId: string) => {
      if (selectedProviderId !== providerId) {
        onProviderChange(selectedProviderId);
      }
      setActivePanel("model");
      setSearch("");
      setSelectedIndex(0);
    },
    [onProviderChange, providerId],
  );

  const handleProviderItemClick = useCallback(
    (selectedProviderId: string) => {
      const provider = getProviderById(selectedProviderId);
      if (provider?.requiresApiKey && !hasProviderApiKey(selectedProviderId)) {
        setPendingProviderSelection(selectedProviderId);
        setApiKeyModalState({ isOpen: true, providerId: selectedProviderId });
        return;
      }

      handleProviderSelect(selectedProviderId);
    },
    [handleProviderSelect, hasProviderApiKey, setApiKeyModalState],
  );

  const handleModelSelect = useCallback(
    (selectedModelId: string) => {
      onModelChange(selectedModelId);
      setIsOpen(false);
    },
    [onModelChange],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, selectableItems.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          event.preventDefault();
          if (selectableItems[selectedIndex]) {
            const item = selectableItems[selectedIndex];
            if (activePanel === "provider") {
              handleProviderItemClick(item.providerId);
            } else {
              handleModelSelect(item.id);
            }
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [activePanel, handleModelSelect, handleProviderItemClick, selectableItems, selectedIndex],
  );

  const handleApiKeyModalClose = useCallback(() => {
    setApiKeyModalState({ isOpen: false, providerId: null });
    setPendingProviderSelection(null);
  }, [setApiKeyModalState]);

  const handleApiKeySave = useCallback(
    async (targetProviderId: string, apiKey: string) => {
      const isValid = await saveApiKey(targetProviderId, apiKey);
      if (isValid && pendingProviderSelection === targetProviderId) {
        handleProviderSelect(targetProviderId);
      }
      return isValid;
    },
    [handleProviderSelect, pendingProviderSelection, saveApiKey],
  );

  let selectableIndex = -1;

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          setActivePanel("provider");
          setIsOpen((open) => !open);
        }}
        disabled={disabled}
        className={cn(
          controlFieldSurfaceVariants({ variant: "secondary" }),
          controlFieldSizeVariants({ size: "sm" }),
          "inline-flex w-[min(420px,100%)] min-w-0 items-center justify-between gap-2 px-2 text-left",
        )}
        aria-label="Select AI provider and model"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ProviderIcon providerId={providerId} size={14} className="text-text-lighter" />
          <span className="min-w-0 truncate text-text">{currentProvider?.name || providerId}</span>
          <span className="shrink-0 text-text-lighter">/</span>
          <span className="min-w-0 truncate text-text">{currentModelName}</span>
        </span>
        <ChevronDown
          className={cn("text-text-lighter transition-transform", isOpen && "rotate-180")}
        />
      </button>

      <MenuPopover
        isOpen={isOpen && !!position}
        menuRef={dropdownRef}
        portalContainer={portalContainer}
        initial={{ opacity: 0, y: -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="pointer-events-auto z-[10050] flex max-w-[min(420px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl bg-primary-bg/95 p-0 shadow-xl"
        style={
          position
            ? {
                left: `${position.left}px`,
                top: `${position.top}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-1 border-border/60 border-b px-1.5 pb-1.5 pt-0.5">
          <Input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activePanel === "provider"
                ? "Search providers..."
                : `Search ${currentProvider?.name || "provider"} models...`
            }
            variant="ghost"
            leftIcon={Search}
            className="min-w-0 flex-1"
          />
          {activePanel === "model" && supportsDynamicModels && (
            <Button
              type="button"
              onClick={() => void fetchDynamicModels()}
              disabled={isLoadingModels}
              variant="ghost"
              size="icon-sm"
              className="rounded-md text-text-lighter"
              aria-label="Refresh models"
            >
              <RefreshCw className={cn(isLoadingModels && "animate-spin")} />
            </Button>
          )}
          <Button
            type="button"
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon-sm"
            className="rounded-md text-text-lighter"
            aria-label="Close model selector"
          >
            <X />
          </Button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto p-1.5 [overscroll-behavior:contain]"
          onWheelCapture={(event) => event.stopPropagation()}
        >
          {modelFetchError && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-2 text-red-400 text-xs">
              <AlertCircle className="shrink-0" />
              <span>{modelFetchError}</span>
            </div>
          )}

          {selectableItems.length === 0 ? (
            <div className="p-4 text-center text-text-lighter text-xs">
              {activePanel === "provider" ? "No providers found" : "No models found"}
            </div>
          ) : activePanel === "provider" ? (
            filteredProviders.map((item) => {
              const isCurrentProvider = item.providerId === providerId;
              const isMissingKey = item.requiresApiKey && !item.hasKey;

              return (
                <Button
                  key={item.id}
                  type="button"
                  onClick={() => handleProviderItemClick(item.providerId)}
                  onMouseEnter={() => setSelectedIndex(filteredProviders.indexOf(item))}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "mb-1 h-auto w-full justify-start rounded-lg px-2.5 py-2 text-left text-xs last:mb-0",
                    isCurrentProvider ? "bg-accent/10" : "bg-transparent",
                  )}
                >
                  <ProviderIcon
                    providerId={item.providerId}
                    size={14}
                    className="shrink-0 text-text-lighter"
                  />
                  <span className="flex-1 truncate text-text">{item.name}</span>
                  {isMissingKey && <AlertCircle className="shrink-0 text-warning" />}
                  {isCurrentProvider && <Check className="shrink-0 text-accent" />}
                </Button>
              );
            })
          ) : (
            <>
              <Button
                type="button"
                onClick={() => {
                  setActivePanel("provider");
                  setSearch("");
                  setSelectedIndex(0);
                }}
                variant="ghost"
                size="sm"
                className="sticky top-0 z-10 mb-1 h-auto w-full justify-start rounded-lg border border-border/70 bg-primary-bg/95 px-2.5 py-2 text-left text-xs text-text-lighter backdrop-blur"
              >
                Back to providers
              </Button>
              {filteredModels.map((item) => {
                selectableIndex += 1;
                const itemIndex = selectableIndex;
                const isHighlighted = itemIndex === selectedIndex;

                const isLocked = item.proOnly && !isPro;

                return (
                  <Button
                    key={`${item.providerId}-${item.id}`}
                    type="button"
                    onClick={() => !isLocked && handleModelSelect(item.id)}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    variant="ghost"
                    size="sm"
                    disabled={isLocked}
                    className={cn(
                      "mb-1 h-auto w-full justify-start rounded-lg px-2.5 py-2 text-left text-xs last:mb-0",
                      isHighlighted ? "bg-hover" : "bg-transparent",
                      item.isCurrent && "bg-accent/10",
                      isLocked && "opacity-60",
                    )}
                  >
                    {isLocked && <Lock className="shrink-0 text-text-lighter" />}
                    <span className="flex-1 truncate text-text">{item.name}</span>
                    {item.proOnly && <ProBadge />}
                    {item.isCurrent && <Check className="shrink-0 text-accent" />}
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </MenuPopover>
      <ProviderApiKeyModal
        isOpen={apiKeyModalState.isOpen}
        onClose={handleApiKeyModalClose}
        providerId={apiKeyModalState.providerId || ""}
        onSave={handleApiKeySave}
        onRemove={removeApiKey}
        hasExistingKey={
          apiKeyModalState.providerId ? hasProviderApiKey(apiKeyModalState.providerId) : false
        }
      />
    </div>
  );
}
