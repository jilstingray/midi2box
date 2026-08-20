use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::Emitter;

#[derive(Debug, Deserialize)]
struct ConvertRequest {
    filename: String,
    data_base64: String,
    options: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct ConvertResponse {
    payload: serde_json::Value,
}

#[tauri::command]
fn convert_midi(request: ConvertRequest) -> Result<ConvertResponse, String> {
    run_python("json", &request)
}

#[tauri::command]
fn read_midi_file(path: String) -> Result<ConvertResponse, String> {
    let path = PathBuf::from(path);
    validate_midi_path(&path)?;
    let bytes = fs::read(&path).map_err(|err| format!("Failed to read MIDI file: {err}"))?;
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("untitled.mid");

    Ok(ConvertResponse {
        payload: serde_json::json!({
            "filename": filename,
            "dataBase64": general_purpose::STANDARD.encode(bytes)
        }),
    })
}

#[tauri::command]
fn export_sheet(request: ConvertRequest, format: String) -> Result<ConvertResponse, String> {
    match format.as_str() {
        "svg" | "pdf" => run_python(&format, &request),
        _ => Err("Unsupported export format".to_string()),
    }
}

#[tauri::command]
fn export_sheet_to_folder(
    request: ConvertRequest,
    format: String,
    folder_path: String,
) -> Result<ConvertResponse, String> {
    let folder = PathBuf::from(folder_path);
    if !folder.is_dir() {
        return Err("Export target must be an existing folder".to_string());
    }

    let response = export_sheet(request, format.clone())?;
    let filename = response
        .payload
        .get("filename")
        .and_then(|value| value.as_str())
        .map(sanitize_filename)
        .unwrap_or_else(|| format!("midi2box-sheet.{format}"));
    let target_path = folder.join(filename);

    write_export_payload(&target_path, &format, &response.payload)?;

    Ok(ConvertResponse {
        payload: serde_json::json!({
            "filename": target_path.file_name().and_then(|name| name.to_str()).unwrap_or("midi2box-sheet"),
            "path": target_path.to_string_lossy()
        }),
    })
}

#[tauri::command]
fn export_sheet_to_path(
    request: ConvertRequest,
    format: String,
    output_path: String,
) -> Result<ConvertResponse, String> {
    validate_export_format(&format)?;
    let target_path = normalize_export_path(PathBuf::from(output_path), &format)?;
    if let Some(parent) = target_path.parent() {
        if !parent.is_dir() {
            return Err("Export target folder must exist".to_string());
        }
    }

    let response = export_sheet(request, format.clone())?;
    write_export_payload(&target_path, &format, &response.payload)?;

    Ok(ConvertResponse {
        payload: serde_json::json!({
            "filename": target_path.file_name().and_then(|name| name.to_str()).unwrap_or("midi2box-sheet"),
            "path": target_path.to_string_lossy()
        }),
    })
}

#[tauri::command]
fn set_app_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    apply_app_menu(&app, &locale).map_err(|err| err.to_string())
}

fn run_python(format: &str, request: &ConvertRequest) -> Result<ConvertResponse, String> {
    let midi_bytes = general_purpose::STANDARD
        .decode(&request.data_base64)
        .map_err(|err| format!("Invalid base64 MIDI data: {err}"))?;
    let script_path = converter_script_path();
    if !script_path.exists() {
        return Err(format!("Converter script not found: {}", script_path.display()));
    }

    let payload = serde_json::json!({
        "filename": request.filename,
        "data_base64": general_purpose::STANDARD.encode(midi_bytes),
        "options": request.options
    });

    let mut child = Command::new(python_command())
        .arg(script_path)
        .arg("--format")
        .arg(format)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Failed to start Python. Set PYTHON=/path/to/python if needed. Details: {err}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(payload.to_string().as_bytes())
            .map_err(|err| format!("Failed to write conversion payload: {err}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|err| format!("Python converter failed: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.trim().to_string());
    }

    let stdout = String::from_utf8(output.stdout).map_err(|err| err.to_string())?;
    let payload = serde_json::from_str(&stdout).map_err(|err| format!("Invalid converter JSON: {err}"))?;
    Ok(ConvertResponse { payload })
}

fn validate_export_format(format: &str) -> Result<(), String> {
    match format {
        "svg" | "pdf" => Ok(()),
        _ => Err("Unsupported export format".to_string()),
    }
}

fn normalize_export_path(mut path: PathBuf, format: &str) -> Result<PathBuf, String> {
    if path.file_name().and_then(|name| name.to_str()).is_none() {
        return Err("Please choose an export file name".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    match extension.as_deref() {
        Some(ext) if ext == format => Ok(path),
        Some(_) => Err(format!("Export file extension must be .{format}")),
        None => {
            path.set_extension(format);
            Ok(path)
        }
    }
}

fn write_export_payload(
    target_path: &PathBuf,
    format: &str,
    payload: &serde_json::Value,
) -> Result<(), String> {
    match format {
        "svg" => {
            let content = payload
                .get("content")
                .and_then(|value| value.as_str())
                .ok_or_else(|| "SVG export did not return content".to_string())?;
            fs::write(target_path, content)
                .map_err(|err| format!("Failed to write SVG export: {err}"))?;
        }
        "pdf" => {
            let content = payload
                .get("contentBase64")
                .and_then(|value| value.as_str())
                .ok_or_else(|| "PDF export did not return content".to_string())?;
            let bytes = general_purpose::STANDARD
                .decode(content)
                .map_err(|err| format!("Invalid PDF export payload: {err}"))?;
            fs::write(target_path, bytes)
                .map_err(|err| format!("Failed to write PDF export: {err}"))?;
        }
        _ => return Err("Unsupported export format".to_string()),
    }
    Ok(())
}

fn validate_midi_path(path: &PathBuf) -> Result<(), String> {
    if !path.is_file() {
        return Err("Please choose an existing MIDI file".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    match extension.as_deref() {
        Some("mid") | Some("midi") => Ok(()),
        _ => Err("Only .mid and .midi files can be imported".to_string()),
    }
}

fn sanitize_filename(filename: &str) -> String {
    let sanitized: String = filename
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => ch,
        })
        .collect();
    if sanitized.trim().is_empty() {
        "midi2box-sheet".to_string()
    } else {
        sanitized
    }
}

fn converter_script_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("python")
        .join("midi2box.py")
}

fn python_command() -> String {
    std::env::var("PYTHON").unwrap_or_else(|_| "python3".to_string())
}

fn apply_app_menu(app: &tauri::AppHandle, locale: &str) -> tauri::Result<()> {
    let menu = Menu::default(app)?;
    let (
        file_menu_label,
        import_label,
        export_label,
        playback_menu_label,
        play_pause_label,
        stop_label,
        rewind_label,
        forward_label,
        settings_menu_label,
        settings_item_label,
    ) = if locale == "en" {
        (
            "File",
            "Import MIDI...",
            "Export...",
            "Playback",
            "Play/Pause",
            "Stop",
            "Rewind 5 Seconds",
            "Forward 5 Seconds",
            "Settings",
            "Settings...",
        )
    } else {
        (
            "文件",
            "导入 MIDI...",
            "导出...",
            "播放",
            "播放/暂停",
            "停止",
            "后退 5 秒",
            "前进 5 秒",
            "设置",
            "设置...",
        )
    };
    let import_item = MenuItem::with_id(
        app,
        "import-midi",
        import_label,
        true,
        Some("CmdOrCtrl+O"),
    )?;
    let export_item = MenuItem::with_id(
        app,
        "export-sheet",
        export_label,
        true,
        Some("CmdOrCtrl+Shift+P"),
    )?;
    let file_menu = Submenu::with_id_and_items(
        app,
        "midi2box-file-menu",
        file_menu_label,
        true,
        &[&import_item, &export_item],
    )?;
    let play_pause_item = MenuItem::with_id(
        app,
        "play-pause",
        play_pause_label,
        true,
        Some("Space"),
    )?;
    let stop_item = MenuItem::with_id(
        app,
        "stop-playback",
        stop_label,
        true,
        Some("CmdOrCtrl+."),
    )?;
    let rewind_item = MenuItem::with_id(
        app,
        "rewind-playback",
        rewind_label,
        true,
        Some("Left"),
    )?;
    let forward_item = MenuItem::with_id(
        app,
        "forward-playback",
        forward_label,
        true,
        Some("Right"),
    )?;
    let playback_menu = Submenu::with_id_and_items(
        app,
        "playback-menu",
        playback_menu_label,
        true,
        &[&play_pause_item, &stop_item, &rewind_item, &forward_item],
    )?;
    let settings_item = MenuItem::with_id(
        app,
        "open-settings",
        settings_item_label,
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let settings_menu = Submenu::with_id_and_items(
        app,
        "settings-menu",
        settings_menu_label,
        true,
        &[&settings_item],
    )?;
    menu.append(&file_menu)?;
    menu.append(&playback_menu)?;
    menu.append(&settings_menu)?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            apply_app_menu(app.handle(), "zh")?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_name = match event.id().as_ref() {
                "open-settings" => Some("open-settings"),
                "import-midi" => Some("import-midi"),
                "export-sheet" => Some("export-sheet"),
                "play-pause" => Some("play-pause"),
                "stop-playback" => Some("stop-playback"),
                "rewind-playback" => Some("rewind-playback"),
                "forward-playback" => Some("forward-playback"),
                _ => None,
            };
            if let Some(event_name) = event_name {
                let _ = app.emit(event_name, ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            convert_midi,
            read_midi_file,
            export_sheet,
            export_sheet_to_folder,
            export_sheet_to_path,
            set_app_locale
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
