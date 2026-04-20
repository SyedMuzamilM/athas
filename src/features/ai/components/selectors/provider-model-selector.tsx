import { AlertCircle, Check, ChevronDown, Lock, RefreshCw, X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProviderIcon } from "@/features/ai/components/icons/provider-icons";
import ProviderApiKeyModal from "@/features/ai/components/provider-api-key-modal";
import { useAIChatStore } from "@/features/ai/store/store";
import { getAvailableProviders, getProviderById } from "@/features/ai/types/providers";
import { useProFeature } from "@/extensions/ui/hooks/use-pro-feature";
import { ProBadge } from "@/extensions/ui/components/pro-badge";
import { getProviderApiToken } from "@/features/ai/services/ai-token-service";
import Input from "@/ui/input";
import { Button } from "@/ui/button";
import { Dropdown } from "@/ui/dropdown";
import { cn } from "@/utils/cn";
import { getProvider } from "@/features/ai/services/providers/ai-provider-registry";

interface ProviderModelSelectorProps {
  providerId: string;
  modelId: string;
  onProviderChange: (id: string) => void;
  onModelChange: (id: string) => void;
  disabled?: boolean;
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
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  const { isPro } = useProFeature();
  const { dynamicModels, setDynamicModels } = useAIChatStore();
  const apiKeyModalState = useAIChatStore((state) => state.apiKeyModalState);
  const hasProviderApiKey = useAIChatStore((state) => state.hasProviderApiKey);
  const saveApiKey = useAIChatStore((state) => state.saveApiKey);
  const removeApiKey = useAIChatStore((state) => state.removeApiKey);
  const setApiKeyModalState = useAIChatStore((state) => state.setApiKeyModalState);

  const inputRef = useRef<HTMLInputElement>(null);

  const providers = getAvailableProviders();
  const currentProvider = getProviderById(providerId);
  const providerInstance = getProvider(providerId);
  const supportsDynamicModels = !!providerInstance?.getModels;

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

  useEffect(() => {
    if (availableModels.length === 0) {
      return;
    }

    if (!availableModels.some((model) => model.id === modelId)) {
      onModelChange(availableModels[0].id);
    }
  }, [availableModels, modelId, onModelChange]);

  const currentModelName = useMemo(() => {
    const selectedModel = availableModels.find((model) => model.id === modelId);
    if (selectedModel) {
      return selectedModel.name;
    }

    if (supportsDynamicModels) {
      if (isLoadingModels) {
        return "Loading models...";
      }

      if (modelFetchError) {
        return "Select model";
      }
    }

    return availableModels[0]?.name || "Select model";
  }, [availableModels, isLoadingModels, modelFetchError, modelId, supportsDynamicModels]);

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
      inputRef.current?.select();
      return;
    }

    setSearch("");
    setSelectedIndex(0);
  }, [isOpen]);

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
  const triggerValue = isOpen
    ? search
    : `${currentProvider?.name || providerId} / ${currentModelName}`;

  return (
    <div>
      <Input
        ref={inputRef}
        type="text"
        value={triggerValue}
        onFocus={() => {
          if (disabled) return;
          setActivePanel("provider");
          setIsOpen(true);
        }}
        onClick={() => {
          if (disabled) return;
          if (!isOpen) {
            setActivePanel("provider");
            setIsOpen(true);
          }
        }}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        readOnly={!isOpen}
        rightIcon={ChevronDown}
        size="sm"
        variant="default"
        containerClassName="w-[min(420px,100%)] min-w-0"
        className={cn("min-w-0", !isOpen && "cursor-pointer")}
        placeholder={
          activePanel === "provider"
            ? "Search providers..."
            : `Search ${currentProvider?.name || "provider"} models...`
        }
        aria-label="Select AI provider and model"
      />

      <Dropdown
        isOpen={isOpen}
        anchorRef={inputRef}
        anchorSide="bottom"
        onClose={() => setIsOpen(false)}
        className="flex w-[min(420px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl p-0"
        menuClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ maxHeight: "480px" }}
      >
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
              <div className="sticky top-0 z-10 mb-1 flex items-center gap-1 rounded-lg border border-border/70 bg-secondary-bg p-1">
                <Button
                  type="button"
                  onClick={() => {
                    setActivePanel("provider");
                    setSearch("");
                    setSelectedIndex(0);
                    inputRef.current?.focus();
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-auto flex-1 justify-start rounded-md px-2 py-1.5 text-left text-xs text-text-lighter"
                >
                  Back to providers
                </Button>
                {supportsDynamicModels && (
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
      </Dropdown>
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
