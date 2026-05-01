#[cfg(feature = "cef")]
pub type AthasAppHandle = tauri::AppHandle<tauri::Cef>;

#[cfg(not(feature = "cef"))]
pub type AthasAppHandle = tauri::AppHandle<tauri::Wry>;
