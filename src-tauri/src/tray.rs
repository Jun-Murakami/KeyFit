use tauri::{AppHandle, Manager, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIcon}, Emitter, Wry};
use std::sync::Arc;
use crate::keyboard::KeyboardHook;
use std::sync::Mutex;

pub static TRAY_ICON: Mutex<Option<TrayIcon>> = Mutex::new(None);

pub fn build_tray_menu(app: &AppHandle, is_running: bool) -> tauri::Result<Menu<Wry>> {
    let status_label = if is_running {
        "Logging Status: ✅ Monitoring"
    } else {
        "Logging Status: ❌ Stopped"
    };
    let toggle_label = if is_running {
        "Stop Monitoring"
    } else {
        "Start Monitoring"
    };
    let status_i = MenuItem::with_id(app, "status", status_label, false, None::<&str>)?;
    let toggle_i = MenuItem::with_id(app, "toggle", toggle_label, true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "Show App", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    Menu::with_items(app, &[&status_i, &toggle_i, &show_i, &quit_i])
}

pub fn init_tray(app: &AppHandle, keyboard_hook: Arc<KeyboardHook>) -> tauri::Result<()> {
    let is_running = keyboard_hook.is_running();
    let menu = build_tray_menu(app, is_running)?;

    let tray_keyboard_hook = keyboard_hook.clone();
    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "quit" => {
                    tray_keyboard_hook.stop();
                    app.exit(0);
                }
                "toggle" => {
                    tray_keyboard_hook.toggle(app);
                    let is_running = tray_keyboard_hook.is_running();
                    // メニューを再生成してセット
                    if let Ok(menu) = build_tray_menu(app, is_running) {
                        if let Some(tray) = TRAY_ICON.lock().unwrap().as_mut() {
                            let _ = tray.set_menu(Some(menu));
                        }
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("monitoring_status_changed", is_running);
                    }
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        })
        .build(app)?;
    TRAY_ICON.lock().unwrap().replace(tray);
    Ok(())
} 