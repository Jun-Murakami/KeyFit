use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

/// エラーダイアログを表示（blocking）
pub fn show_error(app: &AppHandle, message: &str, title: Option<&str>) {
    let mut dialog = app.dialog().message(message).kind(MessageDialogKind::Error);
    if let Some(t) = title {
        dialog = dialog.title(t);
    }
    dialog.blocking_show();
}
