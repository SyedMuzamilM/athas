import {
  Bug,
  CaretRight,
  FolderOpen,
  ListBullets,
  Pause,
  Play,
  Stop,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useBufferStore } from "@/features/editor/stores/buffer-store";
import { useEditorStateStore } from "@/features/editor/stores/state-store";
import { readFileContent } from "@/features/file-system/controllers/file-operations";
import { useFileSystemStore } from "@/features/file-system/controllers/store";
import { useProjectStore } from "@/features/window/stores/project-store";
import { Button } from "@/ui/button";
import Input from "@/ui/input";
import Select from "@/ui/select";
import { cn } from "@/utils/cn";
import { getBaseName, joinPath } from "@/utils/path-helpers";
import {
  startDebugLaunchSession,
  stopDebugAdapterSession,
} from "../services/debug-adapter-service";
import { useDebuggerStore } from "../stores/debugger-store";
import {
  buildDebugCommand,
  createGeneratedDebugConfig,
  parseDebugLaunchJson,
  resolveDebugConfigVariables,
} from "../utils/debugger-command";

const SectionHeader = ({ title, count }: { title: string; count?: number }) => (
  <div className="flex h-8 items-center justify-between border-border/70 border-b px-3">
    <span className="font-medium text-text text-xs uppercase tracking-wide">{title}</span>
    {typeof count === "number" ? (
      <span className="rounded-md bg-secondary-bg px-1.5 py-0.5 text-[10px] text-text-lighter">
        {count}
      </span>
    ) : null}
  </div>
);

const getActiveDebuggableFile = () => {
  const bufferStore = useBufferStore.getState();
  const activeBuffer = bufferStore.buffers.find(
    (buffer) => buffer.id === bufferStore.activeBufferId,
  );
  if (!activeBuffer || activeBuffer.type !== "editor" || activeBuffer.isVirtual) return null;

  return {
    path: activeBuffer.path,
    name: activeBuffer.name,
    language: activeBuffer.language,
  };
};

export default function DebuggerView() {
  const rootFolderPath = useProjectStore((state) => state.rootFolderPath);
  const activeBufferId = useBufferStore.use.activeBufferId();
  const buffers = useBufferStore.use.buffers();
  const cursorPosition = useEditorStateStore.use.cursorPosition();
  const handleFileOpen = useFileSystemStore.use.handleFileOpen?.();
  const breakpoints = useDebuggerStore.use.breakpoints();
  const workspaceConfigs = useDebuggerStore.use.workspaceConfigs();
  const userConfigs = useDebuggerStore.use.userConfigs();
  const activeConfigId = useDebuggerStore.use.activeConfigId();
  const activeSession = useDebuggerStore.use.activeSession();
  const debuggerActions = useDebuggerStore.use.actions();
  const [customCommand, setCustomCommand] = useState("");
  const [launchLoadError, setLaunchLoadError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const activeFile = useMemo(() => getActiveDebuggableFile(), [activeBufferId, buffers]);
  const generatedConfig = useMemo(
    () => createGeneratedDebugConfig(activeFile, rootFolderPath),
    [activeFile, rootFolderPath],
  );

  const allConfigs = useMemo(
    () => [generatedConfig, ...workspaceConfigs, ...userConfigs],
    [generatedConfig, workspaceConfigs, userConfigs],
  );

  const selectedConfig =
    allConfigs.find((config) => config.id === activeConfigId) ?? generatedConfig;
  const resolvedSelectedConfig = resolveDebugConfigVariables(
    selectedConfig,
    activeFile,
    rootFolderPath,
  );
  const selectedCommand =
    resolvedSelectedConfig.runtime === "custom" && customCommand.trim()
      ? customCommand.trim()
      : buildDebugCommand({
          ...resolvedSelectedConfig,
          command: resolvedSelectedConfig.command || customCommand,
        });

  useEffect(() => {
    debuggerActions.hydrate();
  }, [debuggerActions]);

  useEffect(() => {
    if (!rootFolderPath) {
      debuggerActions.setWorkspaceConfigs([]);
      return;
    }

    const loadLaunchConfig = async () => {
      setLaunchLoadError(null);
      try {
        const content = await readFileContent(joinPath(rootFolderPath, ".vscode", "launch.json"));
        debuggerActions.setWorkspaceConfigs(parseDebugLaunchJson(content));
      } catch {
        debuggerActions.setWorkspaceConfigs([]);
        setLaunchLoadError("No launch.json found");
      }
    };

    void loadLaunchConfig();
  }, [debuggerActions, rootFolderPath]);

  const startDebugging = async () => {
    setStartError(null);
    if (resolvedSelectedConfig.adapterCommand) {
      try {
        const adapterSession = await startDebugLaunchSession(resolvedSelectedConfig, breakpoints);
        debuggerActions.startSession({
          id: adapterSession.id,
          name: resolvedSelectedConfig.name,
          configId: resolvedSelectedConfig.id,
          command: [adapterSession.command, ...adapterSession.args].join(" "),
          cwd: adapterSession.cwd,
          startedAt: Date.now(),
          status: "running",
        });
      } catch (error) {
        setStartError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    const command = selectedCommand.trim();
    if (!command) return;

    const cwd = resolvedSelectedConfig.cwd || rootFolderPath || undefined;
    window.dispatchEvent(
      new CustomEvent("create-terminal-with-command", {
        detail: {
          name: resolvedSelectedConfig.name,
          command,
          workingDirectory: cwd,
        },
      }),
    );

    debuggerActions.startSession({
      id: `debug_${Date.now()}`,
      name: resolvedSelectedConfig.name,
      configId: resolvedSelectedConfig.id,
      command,
      cwd,
      startedAt: Date.now(),
      status: "running",
    });
  };

  const stopDebugging = () => {
    if (activeSession && resolvedSelectedConfig.adapterCommand) {
      void stopDebugAdapterSession(activeSession.id).catch(() => {});
    } else {
      window.dispatchEvent(new CustomEvent("close-active-terminal"));
    }
    debuggerActions.stopSession();
  };

  const toggleCurrentLineBreakpoint = () => {
    const file = getActiveDebuggableFile();
    if (!file) return;
    debuggerActions.toggleBreakpoint(file.path, cursorPosition.line);
  };

  const sortedBreakpoints = useMemo(
    () =>
      [...breakpoints].sort((a, b) =>
        a.filePath === b.filePath ? a.line - b.line : a.filePath.localeCompare(b.filePath),
      ),
    [breakpoints],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-primary-bg text-text">
      <div className="flex h-10 shrink-0 items-center gap-2 border-border/70 border-b px-3">
        <Bug size={16} className="text-text-lighter" weight="duotone" />
        <div className="min-w-0 flex-1 font-medium text-sm">Run and Debug</div>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Toggle Breakpoint"
          onClick={toggleCurrentLineBreakpoint}
          disabled={!activeFile}
        >
          <ListBullets />
        </Button>
      </div>

      <div className="space-y-3 border-border/70 border-b p-3">
        <Select
          value={selectedConfig.id}
          onChange={(value) => debuggerActions.setActiveConfigId(value)}
          options={allConfigs.map((config) => ({
            value: config.id,
            label: config.name,
          }))}
          size="sm"
          aria-label="Debug configuration"
        />

        {resolvedSelectedConfig.runtime === "custom" ? (
          <Input
            value={customCommand}
            onChange={(event) => setCustomCommand(event.target.value)}
            placeholder="Debug command"
            size="sm"
          />
        ) : (
          <div className="min-h-7 rounded-md border border-border/60 bg-secondary-bg px-2 py-1.5 font-mono text-[11px] text-text-lighter">
            {selectedCommand || "No command available"}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={startDebugging}
            disabled={!selectedCommand.trim()}
            commandId="debug.start"
          >
            <Play />
            Start
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            tooltip="Pause"
            disabled
            aria-label="Pause Debugging"
          >
            <Pause />
          </Button>
          <Button
            size="icon-sm"
            variant="danger"
            tooltip="Stop"
            disabled={!activeSession || activeSession.status !== "running"}
            onClick={stopDebugging}
            commandId="debug.stop"
          >
            <Stop />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-text-lighter">
          <FolderOpen size={12} />
          <span className="truncate">{rootFolderPath || "Open a project to load launch.json"}</span>
        </div>
        {launchLoadError && workspaceConfigs.length === 0 ? (
          <div className="text-[11px] text-text-lighter">{launchLoadError}</div>
        ) : null}
        {startError ? <div className="text-[11px] text-error">{startError}</div> : null}
      </div>

      {activeSession ? (
        <div className="border-border/70 border-b px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                activeSession.status === "running" ? "bg-success" : "bg-text-lighter",
              )}
            />
            <span className="truncate font-medium">{activeSession.name}</span>
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-text-lighter">
            {activeSession.command}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <SectionHeader title="Breakpoints" count={sortedBreakpoints.length} />
        {sortedBreakpoints.length === 0 ? (
          <div className="px-3 py-6 text-center text-text-lighter text-xs">
            Click a gutter line or use Toggle Breakpoint to add one.
          </div>
        ) : (
          <div className="py-1">
            {sortedBreakpoints.map((breakpoint) => (
              <div
                key={breakpoint.id}
                className="group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-hover/70"
              >
                <button
                  type="button"
                  aria-label={breakpoint.enabled ? "Disable breakpoint" : "Enable breakpoint"}
                  className={cn(
                    "size-3 rounded-full border",
                    breakpoint.enabled
                      ? "border-error bg-error"
                      : "border-text-lighter bg-transparent",
                  )}
                  onClick={() =>
                    debuggerActions.setBreakpointEnabled(breakpoint.id, !breakpoint.enabled)
                  }
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={async () => {
                    await handleFileOpen?.(breakpoint.filePath, false);
                    window.dispatchEvent(
                      new CustomEvent("menu-go-to-line", {
                        detail: {
                          path: breakpoint.filePath,
                          line: breakpoint.line + 1,
                        },
                      }),
                    );
                  }}
                >
                  <div className="truncate text-text">
                    {getBaseName(breakpoint.filePath, "file")}
                  </div>
                  <div className="truncate text-[11px] text-text-lighter">
                    Line {breakpoint.line + 1}
                  </div>
                </button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  tooltip="Remove Breakpoint"
                  onClick={() => debuggerActions.removeBreakpoint(breakpoint.id)}
                >
                  <Trash />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-border/70 border-t px-3 py-2 text-[11px] text-text-lighter">
        <div className="flex items-center gap-1.5">
          <CaretRight size={12} />
          Terminal-backed debugging is ready for Bun, Node, Python, Rust, Go, and custom commands.
        </div>
      </div>
    </div>
  );
}
