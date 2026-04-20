import type { Settings } from "@/features/settings/types/settings";
import type { Keybinding } from "../types";

export type KeybindingPreset = Settings["keybindingPreset"];

export interface KeybindingPresetDefinition {
  label: string;
  overrides: Keybinding[];
  disabledCommands: string[];
}

export const keybindingPresetDefinitions: Record<KeybindingPreset, KeybindingPresetDefinition> = {
  none: {
    label: "None",
    overrides: [],
    disabledCommands: [],
  },
  vscode: {
    label: "VS Code",
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
};

export function getKeybindingPresetDefinition(
  preset: KeybindingPreset,
): KeybindingPresetDefinition {
  return keybindingPresetDefinitions[preset] ?? keybindingPresetDefinitions.none;
}
