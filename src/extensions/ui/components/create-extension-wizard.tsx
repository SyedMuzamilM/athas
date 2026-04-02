import {
  ArrowLeft,
  ArrowRight,
  Check,
  Columns3,
  Loader2,
  MousePointerClick,
  Puzzle,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { getChatCompletionStream } from "@/features/ai/services/ai-chat-service";
import type { ContextInfo } from "@/features/ai/types/ai-chat";
import { useSettingsStore } from "@/features/settings/store";
import { Button } from "@/ui/button";
import { useUIExtensionStore } from "../stores/ui-extension-store";

type ContributionType = "sidebar" | "toolbar" | "command";

interface ContributionOption {
  id: ContributionType;
  label: string;
  description: string;
  icon: typeof Columns3;
}

const CONTRIBUTION_OPTIONS: ContributionOption[] = [
  {
    id: "sidebar",
    label: "Sidebar View",
    description: "A panel in the sidebar with custom content",
    icon: Columns3,
  },
  {
    id: "toolbar",
    label: "Toolbar Action",
    description: "A button in the editor toolbar",
    icon: MousePointerClick,
  },
  {
    id: "command",
    label: "Command",
    description: "A command accessible from the command palette",
    icon: Terminal,
  },
];

type WizardStep = "type" | "describe" | "generating" | "done";

interface GeneratedExtension {
  id: string;
  name: string;
  description: string;
  contributionType: ContributionType;
  code: string;
}

const SYSTEM_PROMPT = `You are an extension generator for Athas code editor. The user wants to create a UI extension.
You must respond with ONLY a valid JSON object (no markdown, no code fences, no explanation). The JSON must have this exact structure:

{
  "id": "extension-id",
  "name": "Extension Name",
  "description": "Short description",
  "code": "the javascript code as a string"
}

The "code" field should be a JavaScript string that will be evaluated. It receives an "api" object with these methods:

For sidebar views:
- api.sidebar.registerView({ id, title, icon, render }) - icon is a lucide icon name like "box", "database", "git-branch"
- render() must return a string of HTML content

For toolbar actions:
- api.toolbar.registerAction({ id, title, icon, position: "left"|"right", onClick }) - onClick is a function

For commands:
- api.commands.register(id, title, handler, category?)

The code should call the appropriate api methods. Keep it simple and functional. Use only standard JavaScript.
For render functions, return a simple HTML string like: "<div style='padding:12px'><h3>Title</h3><p>Content</p></div>"

Example for a sidebar timer extension:
{"id":"timer","name":"Timer","description":"A simple timer","code":"api.sidebar.registerView({id:'timer.view',title:'Timer',icon:'clock',render:()=>'<div style="padding:16px"><h3 style="margin:0 0 8px">Timer</h3><p>00:00:00</p></div>'});"}`;

export function CreateExtensionWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<WizardStep>("type");
  const [selectedType, setSelectedType] = useState<ContributionType | null>(null);
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedExtension, setGeneratedExtension] = useState<GeneratedExtension | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isInstalled, setIsInstalled] = useState(false);
  const abortRef = useRef(false);

  const { settings } = useSettingsStore();

  const handleSelectType = (type: ContributionType) => {
    setSelectedType(type);
    setStep("describe");
  };

  const handleBack = () => {
    if (step === "describe") {
      setStep("type");
      setDescription("");
    } else if (step === "done") {
      setStep("describe");
      setGeneratedExtension(null);
      setError(null);
      setIsInstalled(false);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!selectedType || !description.trim()) return;

    setStep("generating");
    setIsGenerating(true);
    setError(null);
    setStreamingText("");
    abortRef.current = false;

    const typeLabel =
      CONTRIBUTION_OPTIONS.find((o) => o.id === selectedType)?.label ?? selectedType;
    const prompt = `Create a ${typeLabel} extension for Athas code editor. The user's description: "${description.trim()}"`;

    let fullResponse = "";

    try {
      const context: ContextInfo = {};

      await getChatCompletionStream(
        "custom",
        settings.aiProviderId,
        settings.aiModelId,
        prompt,
        context,
        (chunk) => {
          if (abortRef.current) return;
          fullResponse += chunk;
          setStreamingText(fullResponse);
        },
        () => {
          if (abortRef.current) return;

          try {
            // Extract JSON from response (handle possible markdown wrapping)
            let jsonStr = fullResponse.trim();
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
            }

            const parsed = JSON.parse(jsonStr);
            setGeneratedExtension({
              id: parsed.id || `ext-${Date.now()}`,
              name: parsed.name || "Untitled Extension",
              description: parsed.description || "",
              contributionType: selectedType,
              code: parsed.code || "",
            });
            setStep("done");
          } catch {
            setError("Failed to parse AI response. Try again with a different description.");
            setStep("done");
          }
          setIsGenerating(false);
        },
        (errorMsg) => {
          if (abortRef.current) return;
          setError(errorMsg);
          setStep("done");
          setIsGenerating(false);
        },
        [{ role: "system", content: SYSTEM_PROMPT }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("done");
      setIsGenerating(false);
    }
  }, [selectedType, description, settings.aiProviderId, settings.aiModelId]);

  const handleInstall = useCallback(() => {
    if (!generatedExtension) return;

    const store = useUIExtensionStore.getState();
    const extensionId = `user.${generatedExtension.id}`;

    store.registerExtension({
      extensionId,
      manifestId: extensionId,
      state: "loading",
    });

    try {
      // Create a simple API that wraps the store
      const api = {
        sidebar: {
          registerView(config: { id: string; title: string; icon: string; render: () => string }) {
            const { createElement } = require("react");
            store.registerSidebarView({
              id: config.id,
              extensionId,
              title: config.title,
              icon: config.icon,
              render: () =>
                createElement("div", {
                  dangerouslySetInnerHTML: { __html: config.render() },
                  style: { height: "100%", overflow: "auto" },
                }),
            });
          },
        },
        toolbar: {
          registerAction(config: {
            id: string;
            title: string;
            icon: string;
            position: "left" | "right";
            onClick: () => void;
          }) {
            store.registerToolbarAction({
              id: config.id,
              extensionId,
              title: config.title,
              icon: config.icon,
              position: config.position,
              onClick: config.onClick,
            });
          },
        },
        commands: {
          register(
            id: string,
            title: string,
            handler: (...args: unknown[]) => void | Promise<void>,
            category?: string,
          ) {
            store.registerCommand({
              id,
              extensionId,
              title,
              category,
              execute: handler,
            });
          },
        },
      };

      // Execute the generated code
      const fn = new Function("api", generatedExtension.code);
      fn(api);

      store.updateExtensionState(extensionId, "active");
      setIsInstalled(true);
    } catch (err) {
      store.updateExtensionState(
        extensionId,
        "error",
        err instanceof Error ? err.message : "Install failed",
      );
      setError(`Installation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [generatedExtension]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        {step !== "type" && (
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon-xs"
            aria-label="Go back"
            disabled={isGenerating}
          >
            <ArrowLeft />
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Puzzle className="size-4 text-accent" />
          <h3 className="font-medium text-sm text-text">
            {step === "type" && "What do you want to create?"}
            {step === "describe" && "Describe your extension"}
            {step === "generating" && "Generating extension..."}
            {step === "done" && (error ? "Something went wrong" : "Extension ready")}
          </h3>
        </div>
      </div>

      {/* Step: Select Type */}
      {step === "type" && (
        <div className="flex flex-col gap-2">
          {CONTRIBUTION_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectType(option.id)}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary-bg/40 p-3 text-left transition-colors hover:border-accent/40 hover:bg-hover"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <option.icon className="size-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm text-text">{option.label}</p>
                <p className="text-text-lighter text-xs">{option.description}</p>
              </div>
              <ArrowRight className="ml-auto size-4 text-text-lighter" />
            </button>
          ))}
        </div>
      )}

      {/* Step: Describe */}
      {step === "describe" && (
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-text-lighter text-xs">
            Describe what your{" "}
            {CONTRIBUTION_OPTIONS.find((o) => o.id === selectedType)?.label.toLowerCase()} should
            do. Be specific about functionality and content.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              selectedType === "sidebar"
                ? "e.g., A Docker container manager that shows running containers with start/stop buttons"
                : selectedType === "toolbar"
                  ? "e.g., A button that formats the current file with prettier"
                  : "e.g., A command that generates a UUID and copies it to clipboard"
            }
            className="min-h-[100px] flex-1 resize-none rounded-lg border border-border/60 bg-secondary-bg/40 p-3 text-sm text-text placeholder:text-text-lighter/60 focus:border-accent/50 focus:outline-none"
            autoFocus
          />
          <Button
            onClick={handleGenerate}
            variant="primary"
            size="sm"
            disabled={!description.trim()}
            className="gap-1.5 self-end"
          >
            <Sparkles className="size-3.5" />
            Generate with AI
          </Button>
        </div>
      )}

      {/* Step: Generating */}
      {step === "generating" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-accent" />
          <p className="text-text-lighter text-xs">AI is creating your extension...</p>
          {streamingText && (
            <div className="mt-2 max-h-32 w-full overflow-auto rounded-lg bg-secondary-bg/60 p-2">
              <pre className="whitespace-pre-wrap text-text-lighter text-[11px]">
                {streamingText.slice(0, 300)}
                {streamingText.length > 300 && "..."}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="flex flex-1 flex-col gap-3">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          ) : generatedExtension ? (
            <>
              <div className="rounded-lg border border-border/60 bg-secondary-bg/40 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Check className="size-4 text-green-500" />
                  <span className="font-medium text-sm text-text">{generatedExtension.name}</span>
                </div>
                <p className="text-text-lighter text-xs">{generatedExtension.description}</p>
              </div>

              {isInstalled ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                  <Check className="size-4 text-green-500" />
                  <p className="text-green-400 text-sm">
                    Extension installed and active!
                    {generatedExtension.contributionType === "sidebar" &&
                      " Check the sidebar for your new view."}
                    {generatedExtension.contributionType === "toolbar" &&
                      " Check the editor toolbar for your new action."}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleInstall} variant="primary" size="sm" className="gap-1.5">
                    <Puzzle className="size-3.5" />
                    Install Extension
                  </Button>
                  <Button onClick={handleBack} variant="secondary" size="sm">
                    Regenerate
                  </Button>
                </div>
              )}
            </>
          ) : null}

          {(isInstalled || error) && (
            <Button onClick={onClose} variant="ghost" size="sm" className="self-end">
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
