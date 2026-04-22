import {
  WarningCircle as AlertCircle,
  CheckCircle,
  ArrowSquareOut as ExternalLink,
  Key,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { getProviderById } from "@/features/ai/types/providers";
import { Button } from "@/ui/button";
import Dialog from "@/ui/dialog";
import Input from "@/ui/input";
import { cn } from "@/utils/cn";

interface ProviderApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  onSave: (providerId: string, apiKey: string) => Promise<boolean>;
  onRemove: (providerId: string) => Promise<void>;
  hasExistingKey: boolean;
}

const DASHBOARD_LINKS: Partial<Record<string, string>> = {
  openrouter: "https://openrouter.ai/keys",
  v0: "https://v0.dev/chat/settings/keys",
  grok: "https://console.x.ai",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/app/apikey",
};

const PLACEHOLDERS: Partial<Record<string, string>> = {
  openrouter: "sk-or-v1-xxxxxxxxxxxxxxxxxxxx",
  v0: "v0_xxxxxxxxxxxxxxxxxxxx",
  grok: "xai-xxxxxxxxxxxxxxxxxxxx",
  openai: "sk-xxxxxxxxxxxxxxxxxxxx",
};

const ProviderApiKeyModal = ({
  isOpen,
  onClose,
  providerId,
  onSave,
  onRemove,
  hasExistingKey,
}: ProviderApiKeyModalProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const provider = getProviderById(providerId);
  const dashboardLink = providerId ? DASHBOARD_LINKS[providerId] : undefined;
  const placeholder = providerId ? PLACEHOLDERS[providerId] || "Enter your API key..." : "";

  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setApiKey(hasExistingKey ? "••••••••••••••••••••" : "");
    setValidationStatus("idle");
    setErrorMessage("");
  }, [hasExistingKey, isOpen]);

  if (!isOpen || !provider) {
    return null;
  }

  const handleSaveKey = async () => {
    if (hasExistingKey && apiKey.startsWith("•")) {
      onClose();
      return;
    }

    if (!apiKey.trim()) {
      setErrorMessage("Please enter an API key.");
      setValidationStatus("invalid");
      return;
    }

    setIsValidating(true);
    setValidationStatus("idle");
    setErrorMessage("");

    try {
      const isValid = await onSave(providerId, apiKey);
      if (isValid) {
        setValidationStatus("valid");
        window.setTimeout(() => onClose(), 600);
      } else {
        setValidationStatus("invalid");
        setErrorMessage("Invalid API key.");
      }
    } catch {
      setValidationStatus("invalid");
      setErrorMessage("Failed to validate API key.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveKey = async () => {
    try {
      await onRemove(providerId);
      setApiKey("");
      setValidationStatus("idle");
      setErrorMessage("");
    } catch {
      setValidationStatus("invalid");
      setErrorMessage("Failed to remove API key.");
    }
  };

  return (
    <Dialog
      onClose={onClose}
      title={`${provider.name} API Key`}
      icon={Key}
      size="md"
      classNames={{
        backdrop: "bg-transparent backdrop-blur-none",
        modal: "max-w-[440px]",
        content: "space-y-4",
      }}
      footer={
        <>
          {hasExistingKey && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleRemoveKey()}
              className="mr-auto text-red-500 hover:bg-red-500/10"
            >
              Remove
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSaveKey()}
            disabled={!apiKey.trim() || isValidating}
          >
            {isValidating
              ? "Validating..."
              : hasExistingKey && apiKey.startsWith("•")
                ? "Use Existing"
                : "Save"}
          </Button>
        </>
      }
    >
      <p className="text-text-lighter text-sm">
        Enter your {provider.name} API key to use this provider in Athas.
      </p>

      <div className="space-y-2">
        <label htmlFor="provider-api-key" className="font-medium text-text text-xs">
          API Key
        </label>
        <Input
          ref={inputRef}
          id="provider-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setValidationStatus("idle");
            setErrorMessage("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSaveKey();
            }
          }}
          placeholder={placeholder}
          className="w-full bg-secondary-bg"
          disabled={isValidating}
          autoComplete="off"
        />
      </div>

      {validationStatus === "valid" && (
        <div className="flex items-center gap-2 text-green-500 text-xs">
          <CheckCircle />
          API key saved.
        </div>
      )}

      {validationStatus === "invalid" && errorMessage && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle />
          {errorMessage}
        </div>
      )}

      {dashboardLink && (
        <a
          href={dashboardLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1.5 text-text-lighter text-xs transition-colors",
            "hover:text-text",
          )}
        >
          <ExternalLink />
          Open {provider.name} dashboard
        </a>
      )}
    </Dialog>
  );
};

export default ProviderApiKeyModal;
