use crate::ai::{request_feynman_feedback, FeynmanFeedback};
use crate::config::{default_graph_path, default_repo_root};
use crate::graph::{load_graph_from_paths, GraphLoadResponse};
use crate::source::{read_source_from_repo, SourceFile};
use crate::truth::{build_truth_context, TruthContext};

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

#[tauri::command]
pub fn read_truth_context(node_id: String) -> Result<TruthContext, String> {
    let repo_root = default_repo_root();
    let graph_path = default_graph_path(&repo_root);
    build_truth_context(&repo_root, &graph_path, &node_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn ai_feynman_feedback(
    node_id: String,
    user_explanation: String,
) -> Result<FeynmanFeedback, String> {
    let repo_root = default_repo_root();
    let graph_path = default_graph_path(&repo_root);
    request_feynman_feedback(&repo_root, &graph_path, &node_id, &user_explanation)
        .await
        .map_err(|err| err.to_string())
}
