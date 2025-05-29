use anyhow::Result;
use rdev::{Event, EventType};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use chrono::Local;
use super::appinfo::get_active_app_info;
use crate::dialog;
use tauri::AppHandle;
use std::thread::JoinHandle;

#[derive(Clone)]
pub struct KeyStat {
    pub ts_day: i64,
    pub key_code: String,
    pub app_id: i64,
}

pub struct KeyboardHook {
    running: Arc<AtomicBool>,
    db: Arc<crate::db::Database>,
    buffer: Arc<Mutex<Vec<KeyStat>>>,
    worker: Arc<Mutex<Option<JoinHandle<()>>>>,
    flush_worker: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl KeyboardHook {
    #[allow(dead_code)]
    pub fn new(db: Arc<crate::db::Database>) -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            db,
            buffer: Arc::new(Mutex::new(Vec::new())),
            worker: Arc::new(Mutex::new(None)),
            flush_worker: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start(&self, app: &AppHandle) -> Result<()> {
        if self.running.load(Ordering::SeqCst) {
            println!("Keyboard hook is already running");
            return Ok(());
        }
        self.stop();
        // macOS accessibility permission check
        #[cfg(target_os = "macos")]
        {
            if !check_accessibility_permission() {
                return Err(anyhow::anyhow!("Insufficient macOS permissions. Please follow the instructions above to set permissions."));
            }
        }
        println!("Starting keyboard hook...");
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();
        let db = self.db.clone();
        let buffer = self.buffer.clone();
        let app_handle = app.clone();

        // バッファflush用スレッド
        let running_flush = running.clone();
        let db_flush = db.clone();
        let buffer_flush = buffer.clone();
        let flush_handle = thread::spawn(move || {
            while running_flush.load(Ordering::SeqCst) {
                for _ in 0..5 {
                    if !running_flush.load(Ordering::SeqCst) {
                        break;
                    }
                    thread::sleep(Duration::from_secs(1));
                }
                let mut buf = buffer_flush.lock().unwrap();
                if !buf.is_empty() {
                    if let Err(e) = db_flush.batch_insert_key_stats(&buf) {
                        eprintln!("[KeyFit] Failed to batch insert: {}", e);
                    }
                    buf.clear();
                }
            }
        });
        *self.flush_worker.lock().unwrap() = Some(flush_handle);

        // キーフック本体
        let buffer_key = buffer.clone();
        let db_key = db.clone();
        let running_key = running.clone();
        let app_handle_key = app_handle.clone();
        let handle = thread::spawn(move || {
            let callback = move |event: Event| {
                if !running_key.load(Ordering::SeqCst) {
                    return;
                }
                if let EventType::KeyRelease(key) = event.event_type {
                    let now = Local::now().date_naive();
                    let ts_day = now.and_hms_opt(0, 0, 0).unwrap().and_local_timezone(Local).unwrap().timestamp();
                    let key_code = format!("{:?}", key);
                    if let Some((app_name, bundle_id)) = get_active_app_info() {
                        match db_key.get_or_create_app(&app_name, &bundle_id) {
                            Ok(app_id) => {
                                let mut buf = buffer_key.lock().unwrap();
                                buf.push(KeyStat { ts_day, key_code: key_code.clone(), app_id });
                                println!("KeyStat: {:?} app_id: {} bundle_id: {}", key_code, app_id, bundle_id);
                            }
                            Err(e) => {
                                dialog::show_error(&app_handle_key, &format!("Failed to get/create app: {}", e), Some("KeyFit Error"));
                            }
                        }
                    }
                }
            };
            if let Err(e) = rdev::listen(callback) {
                eprintln!("Keyboard hook error: {:?}", e);
            }
        });
        *self.worker.lock().unwrap() = Some(handle);
        println!("Keyboard hook started");
        Ok(())
    }

    pub fn stop(&self) {
        println!("Keyboard hook stopped");
        self.running.store(false, Ordering::SeqCst);
        self.flush();
        // workerスレッドはjoinしない（rdev::listenは抜けないため）
        let _ = self.worker.lock().unwrap().take();
        if let Some(flush_handle) = self.flush_worker.lock().unwrap().take() {
            let _ = flush_handle.join();
        }
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn toggle(&self, app: &AppHandle) -> bool {
        if self.is_running() {
            self.stop();
        } else {
            let _ = self.start(app);
        }
        self.is_running()
    }

    pub fn flush(&self) {
        let mut buf = self.buffer.lock().unwrap();
        if !buf.is_empty() {
            if let Err(e) = self.db.batch_insert_key_stats(&buf) {
                eprintln!("[KeyFit] Failed to batch insert (flush): {}", e);
            }
            buf.clear();
        }
    }
}

impl Drop for KeyboardHook {
    fn drop(&mut self) {
        self.flush();
    }
}

#[cfg(target_os = "macos")]
fn check_accessibility_permission() -> bool {
    use std::process::Command;
    // Check Input Monitoring permission
    let input_monitoring_check = Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to keystroke \"\"")
        .output();
    let has_input_monitoring = match input_monitoring_check {
        Ok(result) => result.status.success(),
        Err(e) => {
            eprintln!("Error checking Input Monitoring permission: {}", e);
            false
        }
    };
    // Check Accessibility permission
    let accessibility_check = Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to get name of first process")
        .output();
    let has_accessibility = match accessibility_check {
        Ok(result) => result.status.success(),
        Err(e) => {
            eprintln!("Error checking Accessibility permission: {}", e);
            false
        }
    };
    if !has_input_monitoring || !has_accessibility {
        eprintln!("=== macOS permissions required ===");
        eprintln!("Go to System Preferences > Security & Privacy > Privacy and set the following:");
        if !has_accessibility {
            eprintln!("1. Accessibility: Add and enable the KeyFit app");
        }
        if !has_input_monitoring {
            eprintln!("2. Input Monitoring: Add and enable the KeyFit app");
        }
        eprintln!("");
        eprintln!("Important: On macOS Mojave or later, 'Input Monitoring' permission is required to monitor keyboard events. Without this permission, the rdev library cannot receive keyboard events.");
        eprintln!("");
        eprintln!("After setting, please restart the app.");
        eprintln!("=== End of permission instructions ===");
        return false;
    }
    true
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
fn check_accessibility_permission() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn setup_test_hook() -> (KeyboardHook, NamedTempFile) {
        let temp_file = NamedTempFile::new().unwrap();
        let db = Arc::new(crate::db::Database::new(temp_file.path()).unwrap());
        let hook = KeyboardHook::new(db);
        (hook, temp_file)
    }

    #[test]
    fn test_keyboard_hook_start_stop() {
        let (hook, _temp_file) = setup_test_hook();
        
        // 初期状態は停止中
        assert!(!hook.running.load(Ordering::SeqCst));
        
        // 開始
        // hook.start().unwrap();
        assert!(hook.running.load(Ordering::SeqCst));
        
        // 停止
        hook.stop();
        assert!(!hook.running.load(Ordering::SeqCst));
    }

    #[test]
    fn test_keyboard_hook_double_start() {
        let (hook, _temp_file) = setup_test_hook();
        
        // 1回目の開始
        //hook.start().unwrap();
        assert!(hook.running.load(Ordering::SeqCst));
        
        // 2回目の開始（エラーにならないことを確認）
       // hook.start().unwrap();
        assert!(hook.running.load(Ordering::SeqCst));
    }
} 