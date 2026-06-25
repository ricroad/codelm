use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProgressError {
    #[error("failed to resolve progress path")]
    Path,
    #[error("failed to read progress: {0}")]
    Read(String),
    #[error("failed to parse progress: {0}")]
    Parse(String),
    #[error("failed to write progress: {0}")]
    Write(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeProgress {
    pub attempts: u32,
    pub best_convergence: f64,
    pub status: String,
    pub weak_concepts: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningProgress {
    pub nodes: HashMap<String, NodeProgress>,
    pub streak_days: u32,
}

pub fn default_progress() -> LearningProgress {
    LearningProgress {
        nodes: HashMap::new(),
        streak_days: 1,
    }
}

pub fn progress_path() -> Result<PathBuf, ProgressError> {
    if let Ok(path) = std::env::var("CODE_READING_PROGRESS_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let home = std::env::var("HOME").map_err(|_| ProgressError::Path)?;
    Ok(PathBuf::from(home).join(".code-reading/progress.json"))
}

pub fn load_progress_from_path(path: &Path) -> Result<LearningProgress, ProgressError> {
    if !path.exists() {
        return Ok(default_progress());
    }
    let raw = std::fs::read_to_string(path).map_err(|err| ProgressError::Read(err.to_string()))?;
    serde_json::from_str(&raw).map_err(|err| ProgressError::Parse(err.to_string()))
}

pub fn save_progress_to_path(
    path: &Path,
    progress: &LearningProgress,
) -> Result<(), ProgressError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| ProgressError::Write(err.to_string()))?;
    }
    let raw = serde_json::to_string_pretty(progress)
        .map_err(|err| ProgressError::Write(err.to_string()))?;
    std::fs::write(path, raw).map_err(|err| ProgressError::Write(err.to_string()))
}

pub fn load_progress() -> Result<LearningProgress, ProgressError> {
    load_progress_from_path(&progress_path()?)
}

pub fn save_progress(progress: &LearningProgress) -> Result<(), ProgressError> {
    save_progress_to_path(&progress_path()?, progress)
}
