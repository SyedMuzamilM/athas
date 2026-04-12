import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, CheckCircle, Globe, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAIChatStore } from "@/features/ai/store/store";
import type { AgentConfig, SessionConfigOption, SessionMode } from "@/features/ai/types/acp";
import {
  getAvailableProviders,
  getProviderById,
  updateAgentStatus,
} from "@/features/ai/types/providers";
import { useToast } from "@/features/layout/contexts/toast-context";
import { getDefaultSetting, useSettingsStore } from "@/features/settings/store";
import { useAuthStore } from "@/features/window/stores/auth-store";
import Badge from "@/ui/badge";
import { Button } from "@/ui/button";
import Input from "@/ui/input";
import Section, { SETTINGS_CONTROL_WIDTHS, SettingRow } from "../settings-section";
import Select from "@/ui/select";
import Switch from "@/ui/switch";
import { fetchAutocompleteModels } from "@/features/editor/services/editor-autocomplete-service";
import { cn } from "@/utils/cn";
import {
  getProvider,
  setOllamaBaseUrl,
} from "@/features/ai/services/providers/ai-provider-registry";
import { checkOllamaConnection } from "@/features/ai/services/providers/ollama-provider";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_AUTOCOMPLETE_MODEL_ID = "mistralai/devstral-small";
const NO_DEFAULT_SESSION_MODE = "__none__";

const DEFAULT_AUTOCOMPLETE_MODELS = [
  { id: "mistralai/devstral-small", name: "Devstral Small 1.1" },
  { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5" },
  { id: "openai/gpt-5-nano", name: "GPT-5 Nano" },
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
];

function resolveAutocompleteDefaultModelId(models: Array<{ id: string; name: string }>): string {
  if (models.some((model) => model.id === DEFAULT_AUTOCOMPLETE_MODEL_ID)) {
    return DEFAULT_AUTOCOMPLETE_MODEL_ID;
  }
  return models[0]?.id || DEFAULT_AUTOCOMPLETE_MODEL_ID;
}

export const AISettings = () => {
  const { settings, updateSetting } = useSettingsStore();
  const subscription = useAuthStore((state) => state.subscription);
  const { showToast } = useToast();
  const enterprisePolicy = subscription?.enterprise?.policy;
  const managedPolicy = enterprisePolicy?.managedMode ? enterprisePolicy : null;
  const aiCompletionAllowedByPolicy = managedPolicy ? managedPolicy.aiCompletionEnabled : true;
  const byokAllowedByPolicy = managedPolicy ? managedPolicy.allowByok : true;
  const isPro = subscription?.status === "pro";

  const [availableModes, setAvailableModes] = useState<SessionMode[]>([]);
  const [sessionConfigOptions, setSessionConfigOptions] = useState<SessionConfigOption[]>([]);
  const [isClearingChats, setIsClearingChats] = useState(false);
  const [autocompleteModels, setAutocompleteModels] = useState(DEFAULT_AUTOCOMPLETE_MODELS);
  const [isLoadingAutocompleteModels, setIsLoadingAutocompleteModels] = useState(false);
  const [autocompleteModelError, setAutocompleteModelError] = useState<string | null>(null);
  const dynamicModels = useAIChatStore((state) => state.dynamicModels);
  const setDynamicModels = useAIChatStore((state) => state.setDynamicModels);
  const hasProviderApiKey = useAIChatStore((state) => state.hasProviderApiKey);
  const saveApiKey = useAIChatStore((state) => state.saveApiKey);
  const removeApiKey = useAIChatStore((state) => state.removeApiKey);
  const checkAllProviderApiKeys = useAIChatStore((state) => state.checkAllProviderApiKeys);
  const [isLoadingProviderModels, setIsLoadingProviderModels] = useState(false);
  const [providerModelError, setProviderModelError] = useState<string | null>(null);
  const [selectedApiKeyProviderId, setSelectedApiKeyProviderId] = useState("openai");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Ollama URL state
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL);
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const ollamaDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const detectAgents = async () => {
      try {
        const availableAgents = await invoke<AgentConfig[]>("get_available_agents");
        updateAgentStatus(availableAgents.map((a) => ({ id: a.id, installed: a.installed })));
      } catch {
        // Failed to detect agents
      }
    };
    detectAgents();
  }, []);

  useEffect(() => {
    const unsubscribe = useAIChatStore.subscribe((state) => {
      setAvailableModes(state.sessionModeState.availableModes);
      setSessionConfigOptions(state.sessionConfigOptions);
    });
    setAvailableModes(useAIChatStore.getState().sessionModeState.availableModes);
    setSessionConfigOptions(useAIChatStore.getState().sessionConfigOptions);
    return unsubscribe;
  }, []);

  // Sync Ollama base URL on mount
  useEffect(() => {
    const url = settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL;
    setOllamaBaseUrl(url);
  }, []);

  useEffect(() => {
    void checkAllProviderApiKeys();
  }, [checkAllProviderApiKeys]);

  const validateOllamaConnection = useCallback(async (url: string) => {
    setOllamaStatus("checking");
    const ok = await checkOllamaConnection(url);
    setOllamaStatus(ok ? "ok" : "error");
  }, []);

  const handleOllamaUrlChange = (value: string) => {
    setOllamaUrl(value);
    setOllamaStatus("idle");

    if (ollamaDebounceRef.current) clearTimeout(ollamaDebounceRef.current);
    ollamaDebounceRef.current = setTimeout(() => {
      const trimmed = value.replace(/\/+$/, "") || DEFAULT_OLLAMA_BASE_URL;
      updateSetting("ollamaBaseUrl", trimmed);
      setOllamaBaseUrl(trimmed);
      validateOllamaConnection(trimmed);
    }, 600);
  };

  const handleResetOllamaUrl = () => {
    setOllamaUrl(DEFAULT_OLLAMA_BASE_URL);
    updateSetting("ollamaBaseUrl", DEFAULT_OLLAMA_BASE_URL);
    setOllamaBaseUrl(DEFAULT_OLLAMA_BASE_URL);
    validateOllamaConnection(DEFAULT_OLLAMA_BASE_URL);
  };

  const providers = getAvailableProviders();
  const currentProvider = getProviderById(settings.aiProviderId);
  const currentProviderModels =
    dynamicModels[settings.aiProviderId] || currentProvider?.models || [];
  const providerOptions = useMemo(
    () =>
      providers.map((provider) => ({
        value: provider.id,
        label: provider.name,
      })),
    [providers],
  );
  const modelOptions = useMemo(
    () =>
      currentProviderModels.map((model) => ({
        value: model.id,
        label: model.name,
      })),
    [currentProviderModels],
  );
  const apiKeyProviders = useMemo(
    () => providers.filter((provider) => provider.requiresApiKey),
    [providers],
  );
  const apiKeyProviderOptions = useMemo(
    () =>
      apiKeyProviders.map((provider) => ({
        value: provider.id,
        label: provider.name,
      })),
    [apiKeyProviders],
  );
  const selectedApiKeyProvider = useMemo(
    () => getProviderById(selectedApiKeyProviderId) ?? apiKeyProviders[0],
    [apiKeyProviders, selectedApiKeyProviderId],
  );
  const selectedApiKeyProviderHasKey = selectedApiKeyProvider
    ? hasProviderApiKey(selectedApiKeyProvider.id)
    : false;

  useEffect(() => {
    if (apiKeyProviders.length === 0) return;
    if (!apiKeyProviders.some((provider) => provider.id === selectedApiKeyProviderId)) {
      setSelectedApiKeyProviderId(apiKeyProviders[0].id);
    }
  }, [apiKeyProviders, selectedApiKeyProviderId]);

  const handleProviderChange = (newProviderId: string) => {
    const provider = providers.find((p) => p.id === newProviderId);
    updateSetting("aiProviderId", newProviderId);
    const nextModels = dynamicModels[newProviderId] || provider?.models || [];
    if (nextModels.length > 0) {
      updateSetting("aiModelId", nextModels[0].id);
    }
  };

  const loadProviderModels = useCallback(async () => {
    const providerId = settings.aiProviderId;
    const provider = getProviderById(providerId);
    const instance = getProvider(providerId);

    setProviderModelError(null);

    if (!provider || !instance?.getModels || provider.requiresApiKey) {
      return;
    }

    setIsLoadingProviderModels(true);
    try {
      const models = await instance.getModels();
      if (models.length > 0) {
        setDynamicModels(providerId, models);
        if (!models.some((model) => model.id === settings.aiModelId)) {
          updateSetting("aiModelId", models[0].id);
        }
      } else {
        setDynamicModels(providerId, []);
        setProviderModelError(
          providerId === "ollama"
            ? "No models detected. Please install a model in Ollama."
            : "No models found for this provider.",
        );
      }
    } catch {
      setProviderModelError("Failed to load provider models.");
    } finally {
      setIsLoadingProviderModels(false);
    }
  }, [setDynamicModels, settings.aiModelId, settings.aiProviderId, updateSetting]);

  useEffect(() => {
    void loadProviderModels();
  }, [loadProviderModels]);

  const handleSaveProviderApiKey = useCallback(async () => {
    if (!selectedApiKeyProvider || !apiKeyInput.trim()) {
      setApiKeyStatus({ status: "error", message: "Enter an API key first." });
      return;
    }

    setIsSavingApiKey(true);
    setApiKeyStatus({ status: "idle", message: "" });

    try {
      const isValid = await saveApiKey(selectedApiKeyProvider.id, apiKeyInput.trim());
      if (isValid) {
        setApiKeyInput("");
        setApiKeyStatus({ status: "success", message: "API key saved." });
      } else {
        setApiKeyStatus({ status: "error", message: "API key validation failed." });
      }
    } finally {
      setIsSavingApiKey(false);
    }
  }, [apiKeyInput, saveApiKey, selectedApiKeyProvider]);

  const handleRemoveProviderApiKey = useCallback(async () => {
    if (!selectedApiKeyProvider) return;

    setIsSavingApiKey(true);
    setApiKeyStatus({ status: "idle", message: "" });

    try {
      await removeApiKey(selectedApiKeyProvider.id);
      setApiKeyInput("");
      setApiKeyStatus({ status: "success", message: "API key removed." });
    } catch {
      setApiKeyStatus({ status: "error", message: "Failed to remove API key." });
    } finally {
      setIsSavingApiKey(false);
    }
  }, [removeApiKey, selectedApiKeyProvider]);

  const loadAutocompleteModels = async () => {
    setIsLoadingAutocompleteModels(true);
    setAutocompleteModelError(null);
    try {
      const models = await fetchAutocompleteModels();
      if (models.length > 0) {
        setAutocompleteModels(models);
        if (!models.some((model) => model.id === settings.aiAutocompleteModelId)) {
          updateSetting("aiAutocompleteModelId", resolveAutocompleteDefaultModelId(models));
        }
      } else {
        setAutocompleteModels(DEFAULT_AUTOCOMPLETE_MODELS);
      }
    } catch {
      setAutocompleteModels(DEFAULT_AUTOCOMPLETE_MODELS);
      setAutocompleteModelError("Could not load model list. Showing defaults.");
    } finally {
      setIsLoadingAutocompleteModels(false);
    }
  };

  useEffect(() => {
    void loadAutocompleteModels();
  }, []);

  const providersNeedingAuth = getAvailableProviders().filter(
    (p) => p.requiresAuth && !p.requiresApiKey,
  );

  const isOllamaSelected = settings.aiProviderId === "ollama";

  return (
    <div className="space-y-4">
      <Section title="Athas Agent">
        <div className="ui-font ui-text-sm px-1 pb-1 text-text-lighter">
          When `Athas Agent` is selected in chat, it uses the provider and model configured here.
        </div>
        {isPro ? (
          <div className="ui-font ui-text-sm rounded-xl border border-border bg-secondary-bg/60 px-3 py-2 text-text-lighter">
            <span className="text-text">Athas Pro detected.</span> Chat provider routing is
            currently configured through the model selection below; autocomplete already uses
            Athas-hosted credit on Pro.
          </div>
        ) : null}
        <SettingRow
          label="Provider"
          description="Choose the provider used by Athas Agent"
          onReset={() => {
            updateSetting("aiProviderId", getDefaultSetting("aiProviderId"));
            updateSetting("aiModelId", getDefaultSetting("aiModelId"));
          }}
          canReset={
            settings.aiProviderId !== getDefaultSetting("aiProviderId") ||
            settings.aiModelId !== getDefaultSetting("aiModelId")
          }
        >
          <Select
            value={settings.aiProviderId}
            options={providerOptions}
            onChange={handleProviderChange}
            size="xs"
            variant="secondary"
            searchable
            className={SETTINGS_CONTROL_WIDTHS.xwide}
          />
        </SettingRow>

        <SettingRow
          label="Model"
          description="Choose the model used by Athas Agent"
          onReset={() => updateSetting("aiModelId", getDefaultSetting("aiModelId"))}
          canReset={settings.aiModelId !== getDefaultSetting("aiModelId")}
        >
          <div className="flex items-center gap-2">
            <Select
              value={settings.aiModelId}
              options={modelOptions}
              onChange={(value) => updateSetting("aiModelId", value)}
              size="xs"
              variant="secondary"
              searchable
              className={SETTINGS_CONTROL_WIDTHS.xwide}
              disabled={modelOptions.length === 0}
            />
            <Button
              variant="secondary"
              size="icon-xs"
              onClick={() => void loadProviderModels()}
              disabled={isLoadingProviderModels}
              tooltip="Refresh model list"
              aria-label="Refresh provider model list"
            >
              <RefreshCw className={cn(isLoadingProviderModels && "animate-spin")} />
            </Button>
          </div>
        </SettingRow>

        {providerModelError && (
          <div className="ui-font ui-text-sm mt-1 flex items-center gap-1.5 px-1 text-error">
            <AlertCircle className="shrink-0" />
            <span>{providerModelError}</span>
          </div>
        )}
      </Section>

      {(isOllamaSelected || settings.ollamaBaseUrl !== DEFAULT_OLLAMA_BASE_URL) && (
        <Section title="Ollama">
          <SettingRow
            label="Endpoint"
            description="Base URL for Ollama API (local, LAN, or cloud)"
            onReset={handleResetOllamaUrl}
            canReset={settings.ollamaBaseUrl !== getDefaultSetting("ollamaBaseUrl")}
          >
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={ollamaUrl}
                onChange={(e) => handleOllamaUrlChange(e.target.value)}
                placeholder={DEFAULT_OLLAMA_BASE_URL}
                spellCheck={false}
                leftIcon={Globe}
                className={cn("w-56", ollamaStatus === "error" && "border-error/60")}
              />
              {ollamaStatus === "checking" && (
                <RefreshCw className="animate-spin text-text-lighter" />
              )}
              {ollamaStatus === "ok" && <CheckCircle className="text-success" />}
              {ollamaStatus === "error" && <AlertCircle className="text-error" />}
              {ollamaUrl !== DEFAULT_OLLAMA_BASE_URL && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  onClick={handleResetOllamaUrl}
                  tooltip="Reset to default"
                  aria-label="Reset Ollama URL to default"
                >
                  <RotateCcw />
                </Button>
              )}
            </div>
          </SettingRow>
          {ollamaStatus === "error" && (
            <div className="ui-font ui-text-sm flex items-center gap-1.5 px-1 text-error">
              <AlertCircle className="shrink-0" />
              <span>Could not connect. Check that Ollama is running at this address.</span>
            </div>
          )}
        </Section>
      )}

      {providersNeedingAuth.length > 0 && (
        <Section title="Authentication">
          {providersNeedingAuth.map((provider) => (
            <SettingRow
              key={provider.id}
              label={provider.name}
              description="Requires OAuth authentication"
            >
              <Badge variant="default" size="default">
                Coming Soon
              </Badge>
            </SettingRow>
          ))}
        </Section>
      )}

      <Section title="API Keys">
        {!byokAllowedByPolicy ? (
          <div className="ui-font ui-text-sm rounded-xl border border-border bg-secondary-bg/60 px-3 py-2 text-text-lighter">
            Your enterprise policy blocks BYOK for chat providers.
          </div>
        ) : (
          <>
            <SettingRow label="Provider" description="Choose which provider key to manage">
              <Select
                value={selectedApiKeyProvider?.id || ""}
                options={apiKeyProviderOptions}
                onChange={(value) => {
                  setSelectedApiKeyProviderId(value);
                  setApiKeyInput("");
                  setApiKeyStatus({ status: "idle", message: "" });
                }}
                size="xs"
                variant="secondary"
                className={SETTINGS_CONTROL_WIDTHS.default}
              />
            </SettingRow>

            <SettingRow
              label="Add New API Key"
              description={
                selectedApiKeyProviderHasKey
                  ? "This provider already has a saved key. Saving again will replace it."
                  : "Store a key for the selected provider."
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder={
                    selectedApiKeyProvider ? `${selectedApiKeyProvider.name} API key` : "API key"
                  }
                  className={SETTINGS_CONTROL_WIDTHS.textWide}
                  disabled={isSavingApiKey || !selectedApiKeyProvider}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => void handleSaveProviderApiKey()}
                  disabled={!apiKeyInput.trim() || isSavingApiKey || !selectedApiKeyProvider}
                >
                  {isSavingApiKey ? "Saving..." : "Save"}
                </Button>
                {selectedApiKeyProviderHasKey && selectedApiKeyProvider ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="xs"
                    onClick={() => void handleRemoveProviderApiKey()}
                    disabled={isSavingApiKey}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </SettingRow>

            {selectedApiKeyProvider ? (
              <div className="ui-font ui-text-sm px-1 text-text-lighter">
                {selectedApiKeyProvider.name}:{" "}
                {selectedApiKeyProviderHasKey ? "API key saved." : "No API key saved."}
              </div>
            ) : null}

            {apiKeyStatus.status !== "idle" ? (
              <div
                className={cn(
                  "ui-font ui-text-sm flex items-center gap-1.5 px-1",
                  apiKeyStatus.status === "success" ? "text-success" : "text-error",
                )}
              >
                {apiKeyStatus.status === "success" ? (
                  <CheckCircle className="shrink-0" />
                ) : (
                  <AlertCircle className="shrink-0" />
                )}
                <span>{apiKeyStatus.message}</span>
              </div>
            ) : null}
          </>
        )}
      </Section>

      {availableModes.length > 0 && (
        <Section title="Agent Defaults">
          <SettingRow
            label="Default Session Mode"
            description="Default mode for ACP agent sessions"
            onReset={() =>
              updateSetting("aiDefaultSessionMode", getDefaultSetting("aiDefaultSessionMode"))
            }
            canReset={settings.aiDefaultSessionMode !== getDefaultSetting("aiDefaultSessionMode")}
          >
            <Select
              value={settings.aiDefaultSessionMode || NO_DEFAULT_SESSION_MODE}
              options={[
                { value: NO_DEFAULT_SESSION_MODE, label: "None" },
                ...availableModes.map((mode) => ({
                  value: mode.id,
                  label: mode.name,
                })),
              ]}
              onChange={(value) =>
                updateSetting(
                  "aiDefaultSessionMode",
                  value === NO_DEFAULT_SESSION_MODE ? "" : value,
                )
              }
              size="xs"
              variant="secondary"
            />
          </SettingRow>
        </Section>
      )}

      {sessionConfigOptions.length > 0 && (
        <Section title="ACP Session">
          {sessionConfigOptions.map((option) => {
            if (option.kind.type !== "select") {
              return null;
            }

            return (
              <SettingRow
                key={option.id}
                label={option.name}
                description={option.description || "Session option exposed by the active ACP agent"}
              >
                <Select
                  value={option.kind.currentValue}
                  options={option.kind.options.map((value) => ({
                    value: value.id,
                    label: value.name,
                  }))}
                  onChange={(value) =>
                    useAIChatStore.getState().changeSessionConfigOption(option.id, value)
                  }
                  size="xs"
                  variant="secondary"
                />
              </SettingRow>
            );
          })}
        </Section>
      )}

      <Section title="Autocomplete">
        <SettingRow
          label="AI Completion"
          description="Enable AI autocomplete while typing"
          onReset={() => updateSetting("aiCompletion", getDefaultSetting("aiCompletion"))}
          canReset={settings.aiCompletion !== getDefaultSetting("aiCompletion")}
        >
          <Switch
            checked={aiCompletionAllowedByPolicy ? settings.aiCompletion : false}
            onChange={(checked) => updateSetting("aiCompletion", checked)}
            disabled={!aiCompletionAllowedByPolicy}
            size="sm"
          />
        </SettingRow>
        <SettingRow
          label="Autocomplete Model"
          description="Choose any OpenRouter model for autocomplete"
          onReset={() =>
            updateSetting("aiAutocompleteModelId", getDefaultSetting("aiAutocompleteModelId"))
          }
          canReset={settings.aiAutocompleteModelId !== getDefaultSetting("aiAutocompleteModelId")}
        >
          <div className="flex items-center gap-2">
            <Select
              value={settings.aiAutocompleteModelId}
              options={autocompleteModels.map((model) => ({
                value: model.id,
                label: model.name,
              }))}
              onChange={(value) => updateSetting("aiAutocompleteModelId", value)}
              size="xs"
              variant="secondary"
              searchable
              className={SETTINGS_CONTROL_WIDTHS.xwide}
              disabled={!aiCompletionAllowedByPolicy}
            />
            <Button
              variant="secondary"
              size="xs"
              onClick={loadAutocompleteModels}
              disabled={isLoadingAutocompleteModels || !aiCompletionAllowedByPolicy}
              tooltip="Refresh model list"
            >
              <RefreshCw className={cn(isLoadingAutocompleteModels && "animate-spin")} />
            </Button>
          </div>
        </SettingRow>
        {autocompleteModelError && (
          <div className="ui-font ui-text-sm mt-1 flex items-center gap-1.5 px-1 text-error">
            <AlertCircle />
            <span>{autocompleteModelError}</span>
          </div>
        )}
        <div className="ui-font ui-text-sm px-1 text-text-lighter">
          Pro uses Athas-hosted autocomplete credit. Free can use BYOK by setting an OpenRouter API
          key in the API Keys section.
        </div>
        {managedPolicy ? (
          <div className="ui-font ui-text-sm px-1 text-text-lighter">
            Enterprise policy:{" "}
            {aiCompletionAllowedByPolicy ? "AI completion enabled." : "AI completion disabled."}{" "}
            {byokAllowedByPolicy ? "BYOK allowed." : "BYOK blocked."}
          </div>
        ) : null}
      </Section>

      <Section title="Chat History">
        <SettingRow label="Clear All Chats" description="Permanently delete all chat history">
          <Button
            variant="outline"
            size="xs"
            onClick={async () => {
              if (
                window.confirm(
                  "Are you sure you want to delete all chat history? This action cannot be undone.",
                )
              ) {
                setIsClearingChats(true);
                try {
                  await useAIChatStore.getState().clearAllChats();
                  showToast({ message: "All chats cleared", type: "success" });
                } finally {
                  setIsClearingChats(false);
                }
              }
            }}
            disabled={isClearingChats}
            className="gap-1.5 text-error hover:bg-error/10"
          >
            <Trash2 />
            {isClearingChats ? "Clearing..." : "Clear All"}
          </Button>
        </SettingRow>
      </Section>
    </div>
  );
};
