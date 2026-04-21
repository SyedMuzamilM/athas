import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import {
  ArrowLeft,
  CirclesThree,
  Cube,
  DownloadSimple,
  Sliders,
  User,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { KeybindingRow } from "@/features/keymaps/components/keybinding-row";
import { keybindingPresetDefinitions } from "@/features/keymaps/defaults/keybinding-presets";
import { useKeymapStore } from "@/features/keymaps/stores/store";
import type { Keybinding } from "@/features/keymaps/types";
import { getEffectiveKeybindingForCommand } from "@/features/keymaps/utils/effective-keymaps";
import { getDefaultSetting, useSettingsStore } from "@/features/settings/store";
import { keymapRegistry } from "@/features/keymaps/utils/registry";
import { useToast } from "@/features/layout/contexts/toast-context";
import { Button } from "@/ui/button";
import Input from "@/ui/input";
import { SegmentedControl } from "@/ui/segmented-control";
import Select from "@/ui/select";
import Switch from "@/ui/switch";
import { TableHeadCell, TableHeader } from "@/ui/table";
import { TypedConfirmAction } from "../typed-confirm-action";
import { SettingRow } from "../settings-section";

type FilterType = "all" | "user" | "default" | "preset" | "extension";

const editorStepTransition = {
  initial: { opacity: 0, x: 14 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -14 },
  transition: { duration: 0.16, ease: "easeOut" as const },
};

const summaryStepTransition = {
  initial: { opacity: 0, x: -14 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 14 },
  transition: { duration: 0.16, ease: "easeOut" as const },
};

export const KeyboardSettings = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [isEditingKeybindings, setIsEditingKeybindings] = useState(false);
  const { showToast } = useToast();
  const { settings, updateSetting } = useSettingsStore();

  const userKeybindings = useKeymapStore.use.keybindings();
  const { resetToDefaults } = useKeymapStore.use.actions();

  const commands = useMemo(() => keymapRegistry.getAllCommands(), []);
  const registryKeybindings = useMemo(() => keymapRegistry.getAllKeybindings(), []);

  const getKeybindingForCommand = (commandId: string): Keybinding | undefined =>
    getEffectiveKeybindingForCommand({
      commandId,
      preset: settings.keybindingPreset,
      registryKeybindings,
      userKeybindings,
    });

  const filteredCommands = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return commands.filter((command) => {
      const matchesSearch =
        !query ||
        command.title.toLowerCase().includes(query) ||
        command.id.toLowerCase().includes(query) ||
        command.category?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const binding = getKeybindingForCommand(command.id);

      if (filterType === "all") return true;
      if (filterType === "user") return binding?.source === "user";
      if (filterType === "default") return !binding || binding.source === "default";
      if (filterType === "preset") return binding?.source === "preset";
      if (filterType === "extension") return binding?.source === "extension";

      return true;
    });
  }, [
    commands,
    searchQuery,
    filterType,
    settings.keybindingPreset,
    userKeybindings,
    registryKeybindings,
  ]);

  const userOverrideCount = useMemo(
    () => userKeybindings.filter((binding) => binding.source === "user").length,
    [userKeybindings],
  );

  const handleResetAll = () => {
    resetToDefaults();
    showToast({ message: "Keybindings reset to defaults", type: "success" });
  };

  const handleExport = () => {
    const userBindings = userKeybindings.filter((kb) => kb.source === "user");
    const json = JSON.stringify(userBindings, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keybindings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text) as Keybinding[];

        if (!Array.isArray(imported)) {
          showToast({ message: "Invalid keybindings file format", type: "error" });
          return;
        }

        const { addKeybinding } = useKeymapStore.getState().actions;
        for (const binding of imported) {
          addKeybinding(binding);
        }

        showToast({ message: `Imported ${imported.length} keybindings`, type: "success" });
      } catch (error) {
        showToast({ message: `Failed to import keybindings: ${error}`, type: "error" });
      }
    };
    input.click();
  };

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {isEditingKeybindings ? (
          <motion.div
            key="keyboard-editor"
            className="flex h-full flex-col"
            {...editorStepTransition}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setIsEditingKeybindings(false)}
                className="gap-1.5"
              >
                <ArrowLeft size={14} weight="duotone" />
                Back
              </Button>
              <div className="ui-font ui-text-sm text-text-lighter">Keybindings Editor</div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              <Input
                placeholder="Search keybindings..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                leftIcon={Search}
                size="sm"
                containerClassName="w-full"
              />
            </div>

            <div className="mb-3">
              <SegmentedControl
                value={filterType}
                onChange={(value) => setFilterType(value as FilterType)}
                options={[
                  {
                    value: "all",
                    label: "All",
                    icon: <CirclesThree size={14} weight="duotone" />,
                  },
                  {
                    value: "user",
                    label: "User",
                    icon: <User size={14} weight="duotone" />,
                  },
                  {
                    value: "default",
                    label: "Default",
                    icon: <Sliders size={14} weight="duotone" />,
                  },
                  {
                    value: "preset",
                    label: "Preset",
                    icon: <DownloadSimple size={14} weight="duotone" />,
                  },
                  {
                    value: "extension",
                    label: "Extension",
                    icon: <Cube size={14} weight="duotone" />,
                  },
                ]}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <TableHeader
                gridCols="minmax(0,2.2fr) minmax(180px,1.1fr) minmax(0,1.6fr) 88px 108px"
                className="px-2 py-1.5"
              >
                <TableHeadCell>Command</TableHeadCell>
                <TableHeadCell>Keybinding</TableHeadCell>
                <TableHeadCell>When</TableHeadCell>
                <TableHeadCell>Source</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHeader>

              {filteredCommands.length === 0 ? (
                <div className="ui-font ui-text-md flex items-center justify-center py-12 text-text-lighter">
                  No keybindings found
                </div>
              ) : (
                filteredCommands.map((command) => {
                  const binding = getKeybindingForCommand(command.id);
                  return <KeybindingRow key={command.id} command={command} keybinding={binding} />;
                })
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="ui-font ui-text-sm text-text-lighter">
                {filteredCommands.length} of {commands.length} keybindings
              </div>
              <div className="flex gap-2">
                <TypedConfirmAction actionLabel="Reset to Defaults" onConfirm={handleResetAll} />
                <Button variant="default" size="xs" onClick={handleImport}>
                  Import
                </Button>
                <Button variant="default" size="xs" onClick={handleExport}>
                  Export
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="keyboard-summary" className="space-y-2" {...summaryStepTransition}>
            <SettingRow
              label="Vim Mode"
              description="Enable vim keybindings and commands"
              onReset={() => updateSetting("vimMode", getDefaultSetting("vimMode"))}
              canReset={settings.vimMode !== getDefaultSetting("vimMode")}
            >
              <Switch
                checked={settings.vimMode}
                onChange={(checked) => updateSetting("vimMode", checked)}
                size="sm"
              />
            </SettingRow>

            <SettingRow
              label="Keybinding Preset"
              description="Apply a base shortcut style before your custom overrides."
              onReset={() =>
                updateSetting("keybindingPreset", getDefaultSetting("keybindingPreset"))
              }
              canReset={settings.keybindingPreset !== getDefaultSetting("keybindingPreset")}
            >
              <Select
                value={settings.keybindingPreset}
                onChange={(value) => updateSetting("keybindingPreset", value as "none" | "vscode")}
                options={Object.entries(keybindingPresetDefinitions).map(([value, definition]) => ({
                  value,
                  label: definition.label,
                }))}
                size="sm"
                variant="outline"
                searchable
                searchableTrigger="input"
                aria-label="Keybinding preset"
              />
            </SettingRow>

            <SettingRow
              label="Edit Keybindings"
              description={`Customize shortcuts individually. ${userOverrideCount} user override${userOverrideCount === 1 ? "" : "s"} currently saved.`}
            >
              <Button variant="default" size="xs" onClick={() => setIsEditingKeybindings(true)}>
                Open Editor
              </Button>
            </SettingRow>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
