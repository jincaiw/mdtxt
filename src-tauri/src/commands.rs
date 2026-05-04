use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Error type for file operation commands
#[derive(Debug, Error)]
pub enum CommandError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Failed to read file: {0}")]
    ReadError(String),
    #[error("Failed to write file: {0}")]
    WriteError(String),
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// File metadata returned when opening a file
#[derive(Debug, Serialize, Deserialize)]
pub struct FileData {
    pub path: String,
    pub name: String,
    pub content: String,
    pub size: u64,
    pub line_count: usize,
}

/// Read a markdown file from disk
#[tauri::command]
pub async fn read_file(path: String) -> Result<FileData, CommandError> {
    let file_path = PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err(CommandError::FileNotFound(path));
    }
    
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| CommandError::ReadError(e.to_string()))?;
    
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| CommandError::ReadError(e.to_string()))?;
    
    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Untitled".to_string());
    
    let line_count = content.lines().count();
    
    Ok(FileData {
        path,
        name,
        content,
        size: metadata.len(),
        line_count,
    })
}

/// Save content to a file
#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<(), CommandError> {
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| CommandError::WriteError(e.to_string()))?;
    
    Ok(())
}

/// Get just the file info without content (for status bar)
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileInfo, CommandError> {
    let file_path = PathBuf::from(&path);
    
    if !file_path.exists() {
        return Err(CommandError::FileNotFound(path));
    }
    
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| CommandError::ReadError(e.to_string()))?;
    
    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Untitled".to_string());
    
    Ok(FileInfo {
        path,
        name,
        size: metadata.len(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
}

/// File entry for directory listing
#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
}

/// List all markdown files in a directory
#[tauri::command]
pub async fn list_directory_files(directory: String) -> Result<Vec<FileEntry>, CommandError> {
    let dir_path = PathBuf::from(&directory);
    
    if !dir_path.exists() {
        return Err(CommandError::FileNotFound(directory));
    }
    
    if !dir_path.is_dir() {
        return Err(CommandError::ReadError("Path is not a directory".to_string()));
    }
    
    let mut entries = Vec::new();
    
    let mut read_dir = tokio::fs::read_dir(&dir_path)
        .await
        .map_err(|e| CommandError::ReadError(e.to_string()))?;
    
    while let Some(entry) = read_dir.next_entry().await.map_err(|e| CommandError::ReadError(e.to_string()))? {
        let path = entry.path();
        
        // Only include .md files
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "markdown" {
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|s| s.to_string())
                        .unwrap_or_default();
                    
                    entries.push(FileEntry {
                        name,
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    
    // Sort alphabetically
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(entries)
}

/// Strip any path components from a filename so it can't traverse outside the
/// images directory. Rejects empty / dot-only names and names with separators,
/// drive letters, or NUL bytes. Returns just the basename when valid.
fn sanitize_image_name(name: &str) -> Result<String, CommandError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return Err(CommandError::WriteError("Invalid image filename".to_string()));
    }
    if trimmed.contains('\0') {
        return Err(CommandError::WriteError("Invalid image filename".to_string()));
    }
    // Reject any path-like input — only a bare basename is allowed.
    let basename = std::path::Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| CommandError::WriteError("Invalid image filename".to_string()))?;
    if basename != trimmed {
        return Err(CommandError::WriteError("Invalid image filename".to_string()));
    }
    Ok(basename.to_string())
}

/// Save image data to a file in the images subdirectory
/// Returns the relative path to use in markdown
#[tauri::command]
pub async fn save_image(
    md_file_path: String,
    image_data: Vec<u8>,
    image_name: String,
) -> Result<String, CommandError> {
    let safe_name = sanitize_image_name(&image_name)?;
    let md_path = PathBuf::from(&md_file_path);

    // Get the directory containing the markdown file
    let parent_dir = md_path
        .parent()
        .ok_or_else(|| CommandError::WriteError("Cannot determine parent directory".to_string()))?;

    // Create images subdirectory
    let images_dir = parent_dir.join("images");
    if !images_dir.exists() {
        tokio::fs::create_dir_all(&images_dir)
            .await
            .map_err(|e| CommandError::WriteError(format!("Failed to create images directory: {}", e)))?;
    }

    // Full path for the image (basename only, no traversal possible).
    let image_path = images_dir.join(&safe_name);

    // Write the image data
    tokio::fs::write(&image_path, &image_data)
        .await
        .map_err(|e| CommandError::WriteError(format!("Failed to write image: {}", e)))?;

    // Return relative path for markdown (./images/filename.png)
    Ok(format!("./images/{}", safe_name))
}

#[cfg(test)]
mod tests {
    use super::sanitize_image_name;

    #[test]
    fn accepts_basename() {
        assert_eq!(sanitize_image_name("foo.png").unwrap(), "foo.png");
        assert_eq!(sanitize_image_name("image-1234-abc.jpg").unwrap(), "image-1234-abc.jpg");
    }

    #[test]
    fn rejects_traversal() {
        assert!(sanitize_image_name("../foo.png").is_err());
        assert!(sanitize_image_name("..\\foo.png").is_err());
        assert!(sanitize_image_name("foo/bar.png").is_err());
        assert!(sanitize_image_name("foo\\bar.png").is_err());
        assert!(sanitize_image_name("..").is_err());
        assert!(sanitize_image_name(".").is_err());
        assert!(sanitize_image_name("").is_err());
        assert!(sanitize_image_name("\0").is_err());
    }
}
