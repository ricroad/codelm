use crate::config::{default_graph_path, default_repo_root};
use crate::graph::{load_graph_from_paths, GraphLoadResponse};
use crate::source::{read_source_from_repo, SourceFile};

#[tauri::command]
pub fn load_graph() -> Result<GraphLoadResponse, String> {
    let repo_root = default_repo_root();
    let graph_path = default_graph_path(&repo_root);
    load_graph_from_paths(&repo_root, &graph_path)
}

#[tauri::command]
pub fn read_source(path: String) -> Result<SourceFile, String> {
    let repo_root = default_repo_root();
    let graph_path = default_graph_path(&repo_root);
    read_source_from_repo(&repo_root, &graph_path, &path).map_err(|err| err.to_string())
}
