use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("failed to resolve settings path")]
    Path,
    #[error("failed to read settings: {0}")]
    Read(String),
    #[error("failed to parse settings: {0}")]
    Parse(String),
    #[error("failed to write settings: {0}")]
    Write(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LocalSettings {
    anthropic_api_key: Option<String>,
    repo_root: Option<String>,
    graph_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub configured: bool,
    pub source: String,
    pub masked_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPaths {
    pub repo_root: String,
    pub graph_path: String,
    pub configured: bool,
    pub source: String,
}

pub fn settings_path() -> Result<PathBuf, SettingsError> {
    if let Ok(path) = std::env::var("CODE_READING_SETTINGS_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let home = std::env::var("HOME").map_err(|_| SettingsError::Path)?;
    Ok(PathBuf::from(home).join(".code-reading/settings.json"))
}

fn mask_key(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    if chars.len() <= 8 {
        return "••••".to_string();
    }
    let prefix: String = chars.iter().take(4).collect();
    let suffix: String = chars.iter().skip(chars.len().saturating_sub(4)).collect();
    format!("{prefix}...{suffix}")
}

fn read_settings(path: &Path) -> Result<LocalSettings, SettingsError> {
    if !path.exists() {
        return Ok(LocalSettings::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|err| SettingsError::Read(err.to_string()))?;
    serde_json::from_str(&raw).map_err(|err| SettingsError::Parse(err.to_string()))
}

fn write_settings(path: &Path, settings: &LocalSettings) -> Result<(), SettingsError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| SettingsError::Write(err.to_string()))?;
    }
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|err| SettingsError::Write(err.to_string()))?;
    std::fs::write(path, raw).map_err(|err| SettingsError::Write(err.to_string()))
}

pub fn load_api_key_at_path(path: &Path) -> Result<Option<String>, SettingsError> {
    Ok(read_settings(path)?
        .anthropic_api_key
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty()))
}

fn repo_default_graph_path(repo_root: &Path) -> PathBuf {
    repo_root
        .join(".understand-anything")
        .join("knowledge-graph.json")
}

pub fn load_project_paths_at_path(
    path: &Path,
    default_repo_root: &Path,
    default_graph_path: &Path,
) -> Result<ProjectPaths, SettingsError> {
    let settings = read_settings(path)?;
    let repo_root = settings
        .repo_root
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default_repo_root.display().to_string());
    let graph_path = settings
        .graph_path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            if repo_root == default_repo_root.display().to_string() {
                default_graph_path.display().to_string()
            } else {
                repo_default_graph_path(Path::new(&repo_root))
                    .display()
                    .to_string()
            }
        });
    let configured = repo_root != default_repo_root.display().to_string()
        || graph_path != default_graph_path.display().to_string();
    Ok(ProjectPaths {
        repo_root,
        graph_path,
        configured,
        source: if configured { "settings" } else { "default" }.to_string(),
    })
}

pub fn save_project_paths_at_path(
    path: &Path,
    repo_root: &str,
    graph_path: &str,
    default_repo_root: &Path,
    default_graph_path: &Path,
) -> Result<ProjectPaths, SettingsError> {
    let mut settings = read_settings(path)?;
    let repo_root = repo_root.trim();
    settings.repo_root = if repo_root.is_empty() {
        None
    } else {
        Some(repo_root.to_string())
    };
    let graph_path = graph_path.trim();
    settings.graph_path = if graph_path.is_empty() {
        None
    } else {
        Some(graph_path.to_string())
    };
    write_settings(path, &settings)?;
    load_project_paths_at_path(path, default_repo_root, default_graph_path)
}

pub fn settings_status_at_path(path: &Path) -> Result<ApiKeyStatus, SettingsError> {
    match load_api_key_at_path(path)? {
        Some(key) => Ok(ApiKeyStatus {
            configured: true,
            source: "settings".to_string(),
            masked_key: Some(mask_key(&key)),
        }),
        None => Ok(ApiKeyStatus {
            configured: false,
            source: "none".to_string(),
            masked_key: None,
        }),
    }
}

pub fn save_api_key_at_path(path: &Path, api_key: &str) -> Result<ApiKeyStatus, SettingsError> {
    let trimmed = api_key.trim();
    let mut settings = read_settings(path)?;
    settings.anthropic_api_key = if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    };
    write_settings(path, &settings)?;
    settings_status_at_path(path)
}

pub fn clear_api_key_at_path(path: &Path) -> Result<ApiKeyStatus, SettingsError> {
    let mut settings = read_settings(path)?;
    settings.anthropic_api_key = None;
    write_settings(path, &settings)?;
    settings_status_at_path(path)
}

pub fn load_saved_api_key() -> Result<Option<String>, SettingsError> {
    load_api_key_at_path(&settings_path()?)
}

pub fn api_key_status() -> Result<ApiKeyStatus, SettingsError> {
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY").or_else(|_| std::env::var("CLAUDE_API_KEY"))
    {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return Ok(ApiKeyStatus {
                configured: true,
                source: "env".to_string(),
                masked_key: Some(mask_key(trimmed)),
            });
        }
    }
    settings_status_at_path(&settings_path()?)
}

pub fn save_api_key(api_key: &str) -> Result<ApiKeyStatus, SettingsError> {
    save_api_key_at_path(&settings_path()?, api_key)
}

pub fn clear_api_key() -> Result<ApiKeyStatus, SettingsError> {
    clear_api_key_at_path(&settings_path()?)
}

pub fn project_paths(
    default_repo_root: &Path,
    default_graph_path: &Path,
) -> Result<ProjectPaths, SettingsError> {
    load_project_paths_at_path(&settings_path()?, default_repo_root, default_graph_path)
}

pub fn save_project_paths(
    repo_root: &str,
    graph_path: &str,
    default_repo_root: &Path,
    default_graph_path: &Path,
) -> Result<ProjectPaths, SettingsError> {
    save_project_paths_at_path(
        &settings_path()?,
        repo_root,
        graph_path,
        default_repo_root,
        default_graph_path,
    )
}
