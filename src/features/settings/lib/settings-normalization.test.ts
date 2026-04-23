import { describe, expect, it } from "vite-plus/test";
import { getDefaultSettingsSnapshot } from "@/features/settings/config/default-settings";
import {
  DEFAULT_MONO_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
} from "@/features/settings/config/typography-defaults";
import { normalizeSettings, normalizeSettingValue } from "./settings-normalization";

describe("settings normalization", () => {
  it("migrates legacy Geist font settings to bundled defaults", () => {
    const normalized = normalizeSettings({
      ...getDefaultSettingsSnapshot(),
      fontFamily: '"Geist Mono"',
      terminalFontFamily: "Geist Mono, monospace",
      uiFontFamily: "Geist",
    });

    expect(normalized.fontFamily).toBe(DEFAULT_MONO_FONT_FAMILY);
    expect(normalized.terminalFontFamily).toBe(DEFAULT_MONO_FONT_FAMILY);
    expect(normalized.uiFontFamily).toBe(DEFAULT_UI_FONT_FAMILY);
  });

  it("normalizes legacy Geist font updates before persisting", () => {
    expect(normalizeSettingValue("fontFamily", "Geist Mono")).toBe(DEFAULT_MONO_FONT_FAMILY);
    expect(normalizeSettingValue("terminalFontFamily", "Geist Mono")).toBe(
      DEFAULT_MONO_FONT_FAMILY,
    );
    expect(normalizeSettingValue("uiFontFamily", "Geist Sans")).toBe(DEFAULT_UI_FONT_FAMILY);
  });
});
