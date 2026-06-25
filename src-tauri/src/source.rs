use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

const MAX_SOURCE_FILE_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Error)]
pub enum SourceError {
    #[error("path must stay inside the project")]
    InvalidPath,
    #[error("file is not in the knowledge graph")]
    NotInGraph,
    #[error("file not found")]
    NotFound,
    #[error("path is not a file")]
    NotFile,
    #[error("file is too large to preview")]
    TooLarge,
    #[error("binary or non-utf8 files cannot be previewed")]
    Binary,
    #[error("failed to read graph: {0}")]
    GraphRead(String),
    #[error("failed to parse graph: {0}")]
    GraphParse(String),
    #[error("failed to read source: {0}")]
    SourceRead(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFile {
    pub path: String,
    pub language: String,
    pub content: String,
    pub size_bytes: usize,
    pub line_count: usize,
}

fn normalize_relative_path(path_value: &str) -> Result<PathBuf, SourceError> {
    if path_value.trim().is_empty() || path_value.contains('\0') {
        return Err(SourceError::InvalidPath);
    }

    let input = Path::new(path_value);
    if input.is_absolute() {
        return Err(SourceError::InvalidPath);
    }

    let mut normalized = PathBuf::new();
    for component in input.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(SourceError::InvalidPath);
            }
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err(SourceError::InvalidPath);
    }
    Ok(normalized)
}

fn to_slash_path(path_value: &Path) -> String {
    path_value
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn normalize_graph_file_path(repo_root: &Path, file_path: &str) -> Option<String> {
    let input = Path::new(file_path);
    let relative = if input.is_absolute() {
        input.strip_prefix(repo_root).ok()?.to_path_buf()
    } else {
        normalize_relative_path(file_path).ok()?
    };
    Some(to_slash_path(&relative))
}

fn graph_file_path_set(
    repo_root: &Path,
    graph_path: &Path,
) -> Result<HashSet<String>, SourceError> {
    let raw = std::fs::read_to_string(graph_path)
        .map_err(|err| SourceError::GraphRead(err.to_string()))?;
    let graph: Value =
        serde_json::from_str(&raw).map_err(|err| SourceError::GraphParse(err.to_string()))?;
    let mut allowed = HashSet::new();
    if let Some(nodes) = graph.get("nodes").and_then(Value::as_array) {
        for node in nodes {
            if let Some(file_path) = node.get("filePath").and_then(Value::as_str) {
                if let Some(normalized) = normalize_graph_file_path(repo_root, file_path) {
                    allowed.insert(normalized);
                }
            }
        }
    }
    Ok(allowed)
}

fn detect_language(file_path: &str) -> String {
    let extension = Path::new(file_path)
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    match extension.as_str() {
        "css" => "css",
        "go" => "go",
        "html" => "markup",
        "js" | "mjs" => "javascript",
        "jsx" => "jsx",
        "json" => "json",
        "md" => "markdown",
        "py" => "python",
        "rb" => "ruby",
        "rs" => "rust",
        "sh" => "bash",
        "ts" => "typescript",
        "tsx" => "tsx",
        "yaml" | "yml" => "yaml",
        _ => "text",
    }
    .to_string()
}

fn line_count(content: &str) -> usize {
    if content.is_empty() {
        0
    } else {
        content.split('\n').count()
    }
}

pub fn read_source_from_repo(
    repo_root: &Path,
    graph_path: &Path,
    requested_path: &str,
) -> Result<SourceFile, SourceError> {
    let relative_path = normalize_relative_path(requested_path)?;
    let safe_path = to_slash_path(&relative_path);
    let allowed = graph_file_path_set(repo_root, graph_path)?;
    if !allowed.contains(&safe_path) {
        return Err(SourceError::NotInGraph);
    }

    let canonical_root = repo_root
        .canonicalize()
        .map_err(|_| SourceError::InvalidPath)?;
    let absolute_path = canonical_root.join(&relative_path);
    let canonical_file = absolute_path
        .canonicalize()
        .map_err(|_| SourceError::NotFound)?;
    if !canonical_file.starts_with(&canonical_root) {
        return Err(SourceError::InvalidPath);
    }

    let stat = std::fs::metadata(&canonical_file).map_err(|_| SourceError::NotFound)?;
    if !stat.is_file() {
        return Err(SourceError::NotFile);
    }
    if stat.len() > MAX_SOURCE_FILE_BYTES {
        return Err(SourceError::TooLarge);
    }

    let bytes =
        std::fs::read(&canonical_file).map_err(|err| SourceError::SourceRead(err.to_string()))?;
    if bytes.contains(&0) {
        return Err(SourceError::Binary);
    }
    let content = String::from_utf8(bytes).map_err(|_| SourceError::Binary)?;

    Ok(SourceFile {
        path: safe_path.clone(),
        language: detect_language(&safe_path),
        size_bytes: content.len(),
        line_count: line_count(&content),
        content,
    })
}
