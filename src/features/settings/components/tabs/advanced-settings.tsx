import { useEffect, useState } from "react";
import { useToast } from "@/features/layout/contexts/toast-context";
import { useSettingsStore } from "@/features/settings/store";
import {
  clearTelemetryLogEntries,
  getTelemetryLogEntries,
  subscribeToTelemetryLog,
  type TelemetryLogEntry,
} from "@/features/telemetry/services/telemetry";
import { Button } from "@/ui/button";
import Switch from "@/ui/switch";
import Section, { SettingRow } from "../settings-section";

export const AdvancedSettings = () => {
  const { settings, updateSetting, resetToDefaults } = useSettingsStore();
  const { showToast } = useToast();
  const [showTelemetryLog, setShowTelemetryLog] = useState(false);
  const [telemetryLog, setTelemetryLog] = useState<TelemetryLogEntry[]>([]);

  useEffect(() => {
    void getTelemetryLogEntries().then(setTelemetryLog);
    return subscribeToTelemetryLog(setTelemetryLog);
  }, []);

  const handleResetSettings = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all settings to their defaults? This cannot be undone.",
      )
    ) {
      resetToDefaults();
      showToast({ message: "Settings reset to defaults", type: "success" });
    }
  };

  const handleClearTelemetryLog = async () => {
    await clearTelemetryLogEntries();
    showToast({ message: "Telemetry log cleared", type: "success" });
  };

  return (
    <div className="space-y-4">
      <Section title="Telemetry">
        <SettingRow
          label="Anonymous Usage Telemetry"
          description="Send anonymous heartbeat, extension, and crash-report metadata. Minimal update-check metadata is always sent."
        >
          <Switch
            checked={settings.telemetry}
            onChange={(checked) => updateSetting("telemetry", checked)}
            size="sm"
          />
        </SettingRow>
        <SettingRow
          label="Telemetry Log"
          description="Inspect the local queue and recent telemetry delivery results."
        >
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setShowTelemetryLog((value) => !value)}
            >
              {showTelemetryLog ? "Hide Log" : "Open Log"}
            </Button>
            <Button variant="outline" size="xs" onClick={handleClearTelemetryLog}>
              Clear
            </Button>
          </div>
        </SettingRow>
        {showTelemetryLog && (
          <div className="space-y-2 rounded-xl border border-border bg-primary-bg/70 p-3">
            {telemetryLog.length === 0 ? (
              <p className="ui-font ui-text-sm text-text-lighter">No telemetry entries yet.</p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {[...telemetryLog].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border/70 bg-secondary-bg/70 p-2"
                  >
                    <div className="ui-font ui-text-sm flex items-center justify-between gap-3 text-text">
                      <span className="font-medium">{entry.eventType}</span>
                      <span className="uppercase text-text-lighter">{entry.status}</span>
                    </div>
                    <p className="ui-font ui-text-sm mt-1 text-text-lighter">{entry.summary}</p>
                    {entry.error && (
                      <p className="ui-font ui-text-sm mt-1 text-error">{entry.error}</p>
                    )}
                    <p className="ui-font ui-text-xs mt-1 text-text-lightest">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Data">
        <SettingRow label="Reset Settings" description="Reset all settings to their default values">
          <Button
            variant="outline"
            size="xs"
            onClick={handleResetSettings}
            className="text-error hover:bg-error/10"
          >
            Reset
          </Button>
        </SettingRow>
      </Section>
    </div>
  );
};
