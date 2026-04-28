use super::{
   platform,
   types::{LanguageToolConfigSet, ToolConfig, ToolType},
};
use std::collections::HashMap;

/// Tool configurations resolved from extension manifests.
pub struct ToolRegistry;

impl ToolRegistry {
   /// Get tool configurations for a language from manifest-provided configs.
   pub fn get_tools(
      _language_id: &str,
      manifest_tools: Option<LanguageToolConfigSet>,
   ) -> Option<HashMap<ToolType, ToolConfig>> {
      let mut tools = HashMap::new();
      let manifest_tools = manifest_tools?;

      if let Some(config) = manifest_tools.lsp {
         tools.insert(ToolType::Lsp, Self::normalize_tool_config(config));
      }

      if let Some(config) = manifest_tools.formatter {
         tools.insert(ToolType::Formatter, Self::normalize_tool_config(config));
      }

      if let Some(config) = manifest_tools.linter {
         tools.insert(ToolType::Linter, Self::normalize_tool_config(config));
      }

      if tools.is_empty() { None } else { Some(tools) }
   }

   /// Get a single tool configuration from manifest-provided configs.
   pub fn get_tool(
      language_id: &str,
      tool_type: ToolType,
      manifest_tools: Option<LanguageToolConfigSet>,
   ) -> Option<ToolConfig> {
      Self::get_tools(language_id, manifest_tools).and_then(|tools| tools.get(&tool_type).cloned())
   }

   fn normalize_tool_config(mut config: ToolConfig) -> ToolConfig {
      config.download_url = config
         .download_url
         .as_ref()
         .map(|url| Self::resolve_url_template(url))
         .or_else(|| Self::known_tool_download_url(&config));
      config
   }

   fn known_tool_download_url(config: &ToolConfig) -> Option<String> {
      if config.runtime != crate::ToolRuntime::Binary {
         return None;
      }

      match config.name.as_str() {
         "omnisharp" => Some(Self::omnisharp_download_url()),
         _ => None,
      }
   }

   fn omnisharp_download_url() -> String {
      let platform = match std::env::consts::OS {
         "macos" => "osx",
         "windows" => "win",
         "linux" => match platform::detect_linux_libc() {
            platform::LinuxLibc::Musl => "linux-musl",
            platform::LinuxLibc::Gnu | platform::LinuxLibc::Unknown => "linux",
         },
         _ => "linux",
      };

      let arch = match std::env::consts::ARCH {
         "aarch64" => "arm64",
         _ => "x64",
      };

      let archive_ext = if std::env::consts::OS == "windows" {
         "zip"
      } else {
         "tar.gz"
      };

      format!(
         "https://github.com/OmniSharp/omnisharp-roslyn/releases/latest/download/omnisharp-{}-{}-net6.0.{}",
         platform, arch, archive_ext
      )
   }

   /// Resolve common download URL template variables.
   ///
   /// Supported placeholders:
   /// - `${os}` (`darwin` | `linux` | `win32`)
   /// - `${arch}` (`arm64` | `x64`)
   /// - `${platformArch}` (e.g. `darwin-arm64`)
   /// - `${targetOs}` (`apple-darwin` | `unknown-linux-gnu` | `unknown-linux-musl` |
   ///   `pc-windows-msvc`)
   /// - `${targetArch}` (`aarch64` | `x86_64`)
   /// - `${archiveExt}` (`zip` on Windows, `gz` otherwise)
   /// - `${version}` (fallback: `latest`)
   fn resolve_url_template(template: &str) -> String {
      let os = match std::env::consts::OS {
         "macos" => "darwin",
         "windows" => "win32",
         _ => "linux",
      };

      let arch = match std::env::consts::ARCH {
         "aarch64" => "arm64",
         _ => "x64",
      };

      let target_os = platform::target_os_token();

      let target_arch = match std::env::consts::ARCH {
         "aarch64" => "aarch64",
         _ => "x86_64",
      };

      let archive_ext = if std::env::consts::OS == "windows" {
         "zip"
      } else {
         "gz"
      };

      template
         .replace("${os}", os)
         .replace("${arch}", arch)
         .replace("${platformArch}", &format!("{}-{}", os, arch))
         .replace("${targetOs}", target_os)
         .replace("${targetArch}", target_arch)
         .replace("${archiveExt}", archive_ext)
         .replace("${version}", "latest")
   }
}

#[cfg(test)]
mod tests {
   use super::*;

   #[test]
   fn resolves_url_placeholders() {
      let template =
         "https://example.com/${os}/${arch}/${platformArch}/${targetOs}/${targetArch}.${archiveExt}?v=${version}";
      let resolved = ToolRegistry::resolve_url_template(template);

      assert!(!resolved.contains("${"));
      assert!(resolved.starts_with("https://example.com/"));
      assert!(resolved.contains("?v=latest"));
   }

   #[test]
   fn normalizes_download_url_when_present() {
      let mut env = std::collections::HashMap::new();
      env.insert("KEY".to_string(), "VALUE".to_string());

      let config = ToolConfig {
         name: "example-tool".to_string(),
         command: None,
         runtime: crate::ToolRuntime::Binary,
         package: None,
         download_url: Some("https://example.com/${os}/${arch}.tar.gz".to_string()),
         args: Vec::new(),
         env,
      };

      let language_tools = LanguageToolConfigSet {
         lsp: Some(config),
         formatter: None,
         linter: None,
      };

      let tools = ToolRegistry::get_tools("typescript", Some(language_tools)).unwrap();
      let resolved = tools.get(&ToolType::Lsp).unwrap();

      assert!(resolved.download_url.as_ref().is_some());
      assert!(!resolved.download_url.as_ref().unwrap().contains("${"));
   }

   #[test]
   fn supplies_known_omnisharp_download_url_for_binary_manifest() {
      let config = ToolConfig {
         name: "omnisharp".to_string(),
         command: None,
         runtime: crate::ToolRuntime::Binary,
         package: None,
         download_url: None,
         args: vec!["--languageserver".to_string()],
         env: std::collections::HashMap::new(),
      };

      let language_tools = LanguageToolConfigSet {
         lsp: Some(config),
         formatter: None,
         linter: None,
      };

      let tools = ToolRegistry::get_tools("csharp", Some(language_tools)).unwrap();
      let resolved = tools.get(&ToolType::Lsp).unwrap();
      let url = resolved.download_url.as_ref().unwrap();

      assert!(url.starts_with(
         "https://github.com/OmniSharp/omnisharp-roslyn/releases/latest/download/omnisharp-"
      ));
      assert!(url.contains("-net6.0."));
      if std::env::consts::OS == "windows" {
         assert!(url.ends_with(".zip"));
      } else {
         assert!(url.ends_with(".tar.gz"));
      }
   }
}
