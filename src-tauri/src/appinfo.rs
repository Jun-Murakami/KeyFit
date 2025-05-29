#![allow(unexpected_cfgs)]

#[cfg(target_os = "windows")]
pub fn get_active_app_info() -> Option<(String, String)> {
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::Win32::System::Threading::*;
    use windows::Win32::System::ProcessStatus::*;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return None;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let h_process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid).ok()?;
        if h_process.0 == 0 {
            return None;
        }
        let mut buf = [0u16; 260];
        let len = GetModuleFileNameExW(h_process, None, &mut buf) as usize;
        if len == 0 {
            return None;
        }
        let os_str = OsString::from_wide(&buf[..len]);
        let exe_path = os_str.to_string_lossy().to_string();
        let exe_name = exe_path.split("\\").last().unwrap_or("").to_string();
        Some((exe_name, exe_path))
    }
}

#[cfg(target_os = "macos")]
pub fn get_active_app_info() -> Option<(String, String)> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{msg_send, sel, sel_impl, class};
    use std::ffi::CStr;

    unsafe {
        println!("macOS: アクティブアプリ情報取得開始");
        
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        if workspace == nil {
            eprintln!("macOS: NSWorkspace取得失敗");
            return None;
        }
        
        let active_app: id = msg_send![workspace, frontmostApplication];
        if active_app == nil {
            eprintln!("macOS: frontmostApplication取得失敗");
            return None;
        }

        let app_name: id = msg_send![active_app, localizedName];
        if app_name == nil {
            eprintln!("macOS: localizedName取得失敗");
            return None;
        }

        let name_ptr = NSString::UTF8String(app_name);
        if name_ptr.is_null() {
            eprintln!("macOS: UTF8String変換失敗");
            return None;
        }

        let name = match CStr::from_ptr(name_ptr).to_string_lossy() {
            name_cow => name_cow.into_owned()
        };
        
        println!("macOS: アプリ名取得成功: {}", name);
        
        let bundle_url: id = msg_send![active_app, bundleURL];
        let path = if bundle_url != nil {
            let path_ptr: *const i8 = msg_send![bundle_url, fileSystemRepresentation];
            if !path_ptr.is_null() {
                match CStr::from_ptr(path_ptr).to_string_lossy() {
                    path_cow => path_cow.into_owned()
                }
            } else {
                println!("macOS: bundleURL fileSystemRepresentation取得失敗");
                format!("com.{}.app", name.to_lowercase().replace(" ", ""))
            }
        } else {
            println!("macOS: bundleURL取得失敗");
            format!("com.{}.app", name.to_lowercase().replace(" ", ""))
        };

        println!("macOS: アプリ情報取得完了: {} -> {}", name, path);
        Some((name, path))
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn get_active_app_info() -> Option<(String, String)> {
    None
} 