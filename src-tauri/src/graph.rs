use std::path::Path;
use std::process::Command;

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct GraphLoadResponse {
    pub graph: Value,
    pub repo_root: String,
    pub graph_path: String,
    pub repo_git_commit_hash: Option<String>,
}

pub fn current_git_commit(repo_root: &Path) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .arg("rev-parse")
        .arg("HEAD")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub fn load_graph_from_paths(
    repo_root: &Path,
    graph_path: &Path,
) -> Result<GraphLoadResponse, String> {
    let raw = std::fs::read_to_string(graph_path)
        .map_err(|err| format!("failed to read graph {}: {err}", graph_path.display()))?;
    let graph: Value = serde_json::from_str(&raw)
        .map_err(|err| format!("failed to parse graph {}: {err}", graph_path.display()))?;

    Ok(GraphLoadResponse {
        graph,
        repo_root: repo_root.display().to_string(),
        graph_path: graph_path.display().to_string(),
        repo_git_commit_hash: current_git_commit(repo_root),
    })
}
