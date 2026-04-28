use super::{
   platform,
   types::{LanguageToolConfigSet, ToolConfig, ToolType},
};
use std::collections::HashMap;

const ELIXIR_LS_VERSION: &str = "v0.30.0";

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
      if config.command.is_none() {
         config.command = Self::known_tool_command(&config);
      }
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
         "dart" => Some(Self::dart_sdk_download_url()),
         "elixir-ls" => Some(Self::elixir_ls_download_url()),
         "omnisharp" => Some(Self::omnisharp_download_url()),
         _ => None,
      }
   }

   fn known_tool_command(config: &ToolConfig) -> Option<String> {
      if config.runtime != crate::ToolRuntime::Binary {
         return None;
      }

      match config.name.as_str() {
         "elixir-ls" if std::env::consts::OS == "windows" => {
            Some("language_server.bat".to_string())
         }
         "elixir-ls" => Some("language_server.sh".to_string()),
         _ => None,
      }
   }

   fn dart_sdk_download_url() -> String {
      let platform = match std::env::consts::OS {
         "macos" => "macos",
         "windows" => "windows",
         _ => "linux",
      };

      let arch = match std::env::consts::ARCH {
         "aarch64" => "arm64",
         _ => "x64",
      };

      format!(
         "https://storage.googleapis.com/dart-archive/channels/stable/release/latest/sdk/dartsdk-{}-{}-release.zip",
         platform, arch
      )
   }

   fn elixir_ls_download_url() -> String {
      format!(
         "https://github.com/elixir-lsp/elixir-ls/releases/download/{}/elixir-ls-{}.zip",
         ELIXIR_LS_VERSION, ELIXIR_LS_VERSION
      )
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

   #[test]
   fn supplies_known_dart_sdk_download_url_for_binary_manifest() {
      let config = ToolConfig {
         name: "dart".to_string(),
         command: None,
         runtime: crate::ToolRuntime::Binary,
         package: None,
         download_url: None,
         args: vec!["language-server".to_string(), "--protocol=lsp".to_string()],
         env: std::collections::HashMap::new(),
      };

      let language_tools = LanguageToolConfigSet {
         lsp: Some(config),
         formatter: None,
         linter: None,
      };

      let tools = ToolRegistry::get_tools("dart", Some(language_tools)).unwrap();
      let resolved = tools.get(&ToolType::Lsp).unwrap();
      let url = resolved.download_url.as_ref().unwrap();

      assert!(url.starts_with(
         "https://storage.googleapis.com/dart-archive/channels/stable/release/latest/sdk/dartsdk-"
      ));
      assert!(url.ends_with("-release.zip"));
   }

   #[test]
   fn supplies_known_elixir_ls_download_url_and_command_for_binary_manifest() {
      let config = ToolConfig {
         name: "elixir-ls".to_string(),
         command: None,
         runtime: crate::ToolRuntime::Binary,
         package: None,
         download_url: None,
         args: Vec::new(),
         env: std::collections::HashMap::new(),
      };

      let language_tools = LanguageToolConfigSet {
         lsp: Some(config),
         formatter: None,
         linter: None,
      };

      let tools = ToolRegistry::get_tools("elixir", Some(language_tools)).unwrap();
      let resolved = tools.get(&ToolType::Lsp).unwrap();

      assert_eq!(
         resolved.command.as_deref(),
         Some(if std::env::consts::OS == "windows" {
            "language_server.bat"
         } else {
            "language_server.sh"
         })
      );
      assert_eq!(
         resolved.download_url.as_deref(),
         Some(
            "https://github.com/elixir-lsp/elixir-ls/releases/download/v0.30.0/elixir-ls-v0.30.0.zip"
         )
      );
   }
}
