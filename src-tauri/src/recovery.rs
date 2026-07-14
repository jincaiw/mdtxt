use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub const RECOVERY_RETENTION_SECS: u64 = 7 * 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryEntry {
    pub document_id: String,
    pub path: Option<String>,
    pub name: String,
    pub content: String,
    pub version: u64,
    pub saved_at_ms: u64,
    pub checksum: String,
    /// Metadata is intentionally independent from the checksum: it restores
    /// session placement but must never change the recovered Markdown bytes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tab_index: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub was_active: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor_line: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryContext {
    pub recovery_session_id: Option<String>,
    pub tab_index: Option<u32>,
    pub was_active: Option<bool>,
    pub cursor_line: Option<u32>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn checksum(content: &str) -> String {
    format!("{:x}", Sha256::digest(content.as_bytes()))
}

fn entry_path(directory: &Path, document_id: &str) -> PathBuf {
    directory.join(format!("{:x}.json", Sha256::digest(document_id.as_bytes())))
}

pub fn save_entry(
    directory: &Path,
    document_id: String,
    path: Option<String>,
    name: String,
    content: String,
    version: u64,
    context: RecoveryContext,
) -> std::io::Result<RecoveryEntry> {
    std::fs::create_dir_all(directory)?;
    let entry = RecoveryEntry {
        checksum: checksum(&content),
        document_id,
        path,
        name,
        content,
        version,
        saved_at_ms: now_ms(),
        recovery_session_id: context.recovery_session_id,
        tab_index: context.tab_index,
        was_active: context.was_active,
        cursor_line: context.cursor_line,
    };
    let target = entry_path(directory, &entry.document_id);
    let temporary = target.with_extension(format!("{}.tmp", std::process::id()));
    std::fs::write(
        &temporary,
        serde_json::to_vec(&entry).expect("recovery entry serializes"),
    )?;
    std::fs::File::open(&temporary)?.sync_all()?;
    std::fs::rename(temporary, target)?;
    cleanup_expired(directory, now_ms())?;
    Ok(entry)
}

pub fn clear_entry(directory: &Path, document_id: &str) -> std::io::Result<()> {
    match std::fs::remove_file(entry_path(directory, document_id)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

pub fn read_entries(directory: &Path) -> std::io::Result<Vec<RecoveryEntry>> {
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let now = now_ms();
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(directory)? {
        let entry = entry?;
        if entry.path().extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let parsed = std::fs::read(entry.path())
            .ok()
            .and_then(|bytes| serde_json::from_slice::<RecoveryEntry>(&bytes).ok());
        let valid = parsed.filter(|candidate| {
            now.saturating_sub(candidate.saved_at_ms) <= RECOVERY_RETENTION_SECS * 1000
                && candidate.checksum == checksum(&candidate.content)
        });
        if let Some(recovery) = valid {
            entries.push(recovery);
        } else {
            let _ = std::fs::remove_file(entry.path());
        }
    }
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.saved_at_ms));
    Ok(entries)
}

fn recovery_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("recovery"))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_recovery(
    app: AppHandle,
    document_id: String,
    path: Option<String>,
    name: String,
    content: String,
    version: u64,
    context: Option<RecoveryContext>,
) -> Result<RecoveryEntry, String> {
    save_entry(
        &recovery_directory(&app)?,
        document_id,
        path,
        name,
        content,
        version,
        context.unwrap_or_default(),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_recoveries(app: AppHandle) -> Result<Vec<RecoveryEntry>, String> {
    read_entries(&recovery_directory(&app)?).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn discard_recovery(app: AppHandle, document_id: String) -> Result<(), String> {
    clear_entry(&recovery_directory(&app)?, &document_id).map_err(|error| error.to_string())
}

fn cleanup_expired(directory: &Path, now: u64) -> std::io::Result<()> {
    for entry in std::fs::read_dir(directory)? {
        let entry = entry?;
        if entry.path().extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let parsed = std::fs::read(entry.path())
            .ok()
            .and_then(|bytes| serde_json::from_slice::<RecoveryEntry>(&bytes).ok());
        if parsed.is_none_or(|candidate| {
            now.saturating_sub(candidate.saved_at_ms) > RECOVERY_RETENTION_SECS * 1000
        }) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn directory() -> PathBuf {
        std::env::temp_dir().join(format!(
            "mdtxt-recovery-{}-{}",
            std::process::id(),
            TEST_DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ))
    }

    #[test]
    fn writes_validates_and_clears_a_recovery_entry() {
        let dir = directory();
        let saved = save_entry(
            &dir,
            "a".into(),
            Some("/tmp/a.md".into()),
            "a.md".into(),
            "local".into(),
            3,
            RecoveryContext {
                recovery_session_id: Some("launch-a".into()),
                tab_index: Some(1),
                was_active: Some(true),
                cursor_line: Some(42),
            },
        )
        .unwrap();
        assert_eq!(read_entries(&dir).unwrap(), vec![saved]);
        clear_entry(&dir, "a").unwrap();
        assert!(read_entries(&dir).unwrap().is_empty());
        std::fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn rejects_tampered_or_expired_entries() {
        let dir = directory();
        std::fs::create_dir_all(&dir).unwrap();
        let bad = RecoveryEntry {
            document_id: "bad".into(),
            path: None,
            name: "bad.md".into(),
            content: "changed".into(),
            version: 1,
            saved_at_ms: now_ms(),
            checksum: "wrong".into(),
            recovery_session_id: None,
            tab_index: None,
            was_active: None,
            cursor_line: None,
        };
        std::fs::write(dir.join("bad.json"), serde_json::to_vec(&bad).unwrap()).unwrap();
        assert!(read_entries(&dir).unwrap().is_empty());
        assert!(!dir.join("bad.json").exists());
        std::fs::remove_dir_all(dir).ok();
    }
}
