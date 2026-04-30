#[cfg(all(target_os = "linux", feature = "linux-cef"))]
pub type AthasRuntime = tauri::Cef;

#[cfg(not(all(target_os = "linux", feature = "linux-cef")))]
pub type AthasRuntime = tauri::Wry;
