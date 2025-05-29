// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::sync::Arc;
use tauri::{Manager, State, AppHandle, Emitter};
use crate::keyboard::KeyboardHook;
use crate::db::{Database, KeyRankingItem, AppInfo, DateRange};

mod appinfo;
mod keyboard;
mod db;
mod dialog;
mod tray;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_monitoring_status(state: State<'_, Arc<KeyboardHook>>) -> bool {
    state.is_running()
}

#[tauri::command]
fn toggle_monitoring(app: AppHandle, keyboard_hook: tauri::State<Arc<KeyboardHook>>) -> bool {
    let running = keyboard_hook.toggle(&app);

    // トレイメニューを再生成してセット
    if let Some(tray) = tray::TRAY_ICON.lock().unwrap().as_mut() {
        if let Ok(menu) = tray::build_tray_menu(&app, running) {
            let _ = tray.set_menu(Some(menu));
        }
    }

    app.emit("monitoring_status_changed", running).unwrap();
    running
}

#[tauri::command]
fn get_key_ranking(
    db_state: State<'_, Arc<Database>>,
    start_date: Option<i64>,
    end_date: Option<i64>,
    app_id: Option<i64>,
    limit: Option<i64>
) -> Result<Vec<KeyRankingItem>, String> {
    db_state.get_key_ranking(start_date, end_date, app_id, limit)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_apps(db_state: State<'_, Arc<Database>>) -> Result<Vec<AppInfo>, String> {
    db_state.get_apps().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_total_key_count(
    db_state: State<'_, Arc<Database>>,
    start_date: Option<i64>,
    end_date: Option<i64>,
    app_id: Option<i64>
) -> Result<i64, String> {
    db_state.get_total_key_count(start_date, end_date, app_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_key_stat_date_range(state: State<'_, Arc<Database>>) -> Result<DateRange, String> {
    state.get_date_range().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // DB・キーフック初期化
            let db_path = app.path().resolve("keyfit.db", tauri::path::BaseDirectory::AppData)
                .expect("Failed to get DB path");
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).expect("Failed to create DB directory");
            }
            let db = Arc::new(db::Database::new(&db_path).unwrap());
            let keyboard_hook = Arc::new(keyboard::KeyboardHook::new(db.clone()));
            let app_handle = app.handle();

            // 起動時に監視開始
            keyboard_hook.start(&app_handle).ok();

            // トレイ初期化
            tray::init_tray(&app_handle, keyboard_hook.clone())?;

            // グローバルステート登録
            app.manage(keyboard_hook);
            app.manage(db.clone());

            // ウィンドウクローズ時の挙動
            app.get_webview_window("main").map(|window| {
                let window_ = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_.hide();
                    }
                });
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_monitoring_status,
            toggle_monitoring,
            get_key_ranking,
            get_apps,
            get_total_key_count,
            get_key_stat_date_range
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
