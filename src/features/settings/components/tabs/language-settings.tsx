import { getAllLanguages } from "@/features/editor/utils/language-id";
import { getDefaultSetting, useSettingsStore } from "@/features/settings/store";
import { useMemo } from "react";
import { SETTINGS_CONTROL_WIDTHS, SettingRow } from "../settings-section";
import Select from "@/ui/select";
import Switch from "@/ui/switch";

export const LanguageSettings = () => {
  const settings = useSettingsStore((state) => state.settings);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  // Extract individual settings for easier use
  const {
    defaultLanguage,
    autoDetectLanguage,
    formatOnSave,
    lintOnSave,
    autoCompletion,
    parameterHints,
  } = settings;

  const languageOptions = useMemo(
    () => [
      { value: "auto", label: "Auto Detect" },
      ...getAllLanguages().map((language) => ({
        value: language.id,
        label: language.displayName,
      })),
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <SettingRow
        label="Default Language"
        description="Default syntax highlighting for new files"
        onReset={() => updateSetting("defaultLanguage", getDefaultSetting("defaultLanguage"))}
        canReset={defaultLanguage !== getDefaultSetting("defaultLanguage")}
      >
        <Select
          value={defaultLanguage}
          options={languageOptions}
          onChange={(value) => updateSetting("defaultLanguage", value)}
          className={SETTINGS_CONTROL_WIDTHS.default}
          size="xs"
          variant="secondary"
          searchable
          searchableTrigger="input"
        />
      </SettingRow>

      <SettingRow
        label="Auto-detect Language"
        description="Automatically detect file language from extension"
        onReset={() => updateSetting("autoDetectLanguage", getDefaultSetting("autoDetectLanguage"))}
        canReset={autoDetectLanguage !== getDefaultSetting("autoDetectLanguage")}
      >
        <Switch
          checked={autoDetectLanguage}
          onChange={(checked) => updateSetting("autoDetectLanguage", checked)}
          size="sm"
        />
      </SettingRow>

      <SettingRow
        label="Format on Save"
        description="Automatically format code when saving"
        onReset={() => updateSetting("formatOnSave", getDefaultSetting("formatOnSave"))}
        canReset={formatOnSave !== getDefaultSetting("formatOnSave")}
      >
        <Switch
          checked={formatOnSave}
          onChange={(checked) => updateSetting("formatOnSave", checked)}
          size="sm"
        />
      </SettingRow>

      <SettingRow
        label="Lint on Save"
        description="Run linter when saving files"
        onReset={() => updateSetting("lintOnSave", getDefaultSetting("lintOnSave"))}
        canReset={lintOnSave !== getDefaultSetting("lintOnSave")}
      >
        <Switch
          checked={lintOnSave}
          onChange={(checked) => updateSetting("lintOnSave", checked)}
          size="sm"
        />
      </SettingRow>

      <SettingRow
        label="Auto Completion"
        description="Show completion suggestions while typing"
        onReset={() => updateSetting("autoCompletion", getDefaultSetting("autoCompletion"))}
        canReset={autoCompletion !== getDefaultSetting("autoCompletion")}
      >
        <Switch
          checked={autoCompletion}
          onChange={(checked) => updateSetting("autoCompletion", checked)}
          size="sm"
        />
      </SettingRow>

      <SettingRow
        label="Parameter Hints"
        description="Show function parameter hints"
        onReset={() => updateSetting("parameterHints", getDefaultSetting("parameterHints"))}
        canReset={parameterHints !== getDefaultSetting("parameterHints")}
      >
        <Switch
          checked={parameterHints}
          onChange={(checked) => updateSetting("parameterHints", checked)}
          size="sm"
        />
      </SettingRow>
    </div>
  );
};
