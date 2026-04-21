import type { Settings } from "@/features/settings/types/settings";
import type { Keybinding } from "../types";

export type KeybindingPreset = Settings["keybindingPreset"];

export interface KeybindingPresetDefinition {
  label: string;
  description: string;
  overrides: Keybinding[];
  disabledCommands: string[];
}

export const keybindingPresetDefinitions: Record<KeybindingPreset, KeybindingPresetDefinition> = {
  none: {
    label: "None",
    description: "Use Athas built-in shortcuts.",
    overrides: [],
    disabledCommands: [],
  },
  vscode: {
    label: "VS Code",
    description: "Match common VS Code shortcuts.",
    overrides: [
      {
        key: "cmd+n",
        command: "file.new",
        source: "preset",
      },
      {
        key: "ctrl+g",
        command: "editor.goToLine",
        source: "preset",
      },
      {
        key: "cmd+alt+f",
        command: "workbench.showFindReplace",
        source: "preset",
      },
      {
        key: "cmd+shift+m",
        command: "workbench.toggleDiagnostics",
        source: "preset",
      },
    ],
    disabledCommands: [
      "workbench.newTab",
      "terminal.new",
      "file.open",
      "workbench.toggleSidebarPosition",
      "workbench.agentLauncher",
      "workbench.showProjectSearch",
      "workbench.toggleAIChat",
      "database.connect",
    ],
  },
  jetbrains: {
    label: "JetBrains",
    description: "Match common JetBrains IDE shortcuts.",
    overrides: [
      {
        key: "cmd+shift+a",
        command: "workbench.commandPalette",
        source: "preset",
      },
      {
        key: "cmd+shift+n",
        command: "file.quickOpen",
        source: "preset",
      },
      {
        key: "cmd+e",
        command: "file.quickOpen",
        source: "preset",
      },
      {
        key: "cmd+1",
        command: "workbench.showFileExplorer",
        source: "preset",
      },
      {
        key: "cmd+l",
        command: "editor.goToLine",
        source: "preset",
      },
    ],
    disabledCommands: [
      "workbench.newTab",
      "terminal.new",
      "workbench.toggleSidebarPosition",
      "workbench.agentLauncher",
      "workbench.toggleAIChat",
      "database.connect",
    ],
  },
  sublime: {
    label: "Sublime Text",
    description: "Match common Sublime Text shortcuts.",
    overrides: [
      {
        key: "cmd+shift+d",
        command: "editor.duplicateLine",
        source: "preset",
      },
      {
        key: "cmd+k cmd+b",
        command: "workbench.toggleSidebar",
        source: "preset",
      },
      {
        key: "cmd+alt+f",
        command: "workbench.showGlobalSearch",
        source: "preset",
      },
    ],
    disabledCommands: [
      "workbench.toggleSidebarPosition",
      "workbench.agentLauncher",
      "workbench.toggleAIChat",
      "database.connect",
    ],
  },
};

export const keybindingPresetOptions = Object.entries(keybindingPresetDefinitions).map(
  ([value, definition]) => ({
    value: value as KeybindingPreset,
    label: definition.label,
  }),
);

export function isKeybindingPreset(value: string): value is KeybindingPreset {
  return value in keybindingPresetDefinitions;
}

export function getKeybindingPresetDefinition(
  preset: KeybindingPreset,
): KeybindingPresetDefinition {
  return keybindingPresetDefinitions[preset] ?? keybindingPresetDefinitions.none;
}
