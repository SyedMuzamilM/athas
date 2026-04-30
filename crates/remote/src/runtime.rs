#[cfg(feature = "linux-cef")]
pub type AthasAppHandle = tauri::AppHandle<tauri::Cef>;

#[cfg(not(feature = "linux-cef"))]
pub type AthasAppHandle = tauri::AppHandle<tauri::Wry>;
