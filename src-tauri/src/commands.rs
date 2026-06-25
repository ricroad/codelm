use crate::ai::{
    request_feynman_feedback, request_generalize_feedback, FeynmanFeedback, GeneralizeFeedback,
    GeneralizeMode,
};
use crate::config::{default_graph_path, default_repo_root};
use crate::graph::{load_graph_from_paths, GraphLoadResponse};
use crate::progress::{
    load_progress as load_progress_file, save_progress as save_progress_file, LearningProgress,
};
use crate::settings::{
    api_key_status as api_key_status_file, clear_api_key as clear_api_key_file,
    save_api_key as save_api_key_file, ApiKeyStatus,
};
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

#[tauri::command]
pub async fn ai_generalize_feedback(
    gen_var: String,
    user_response: String,
) -> Result<GeneralizeFeedback, String> {
    let repo_root = default_repo_root();
    let graph_path = default_graph_path(&repo_root);
    let mode = GeneralizeMode::from_str(&gen_var)
        .ok_or_else(|| format!("unknown generalize variant: {gen_var}"))?;
    request_generalize_feedback(&graph_path, mode, &user_response)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn load_progress() -> Result<LearningProgress, String> {
    load_progress_file().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_progress(progress: LearningProgress) -> Result<(), String> {
    save_progress_file(&progress).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn api_key_status() -> Result<ApiKeyStatus, String> {
    api_key_status_file().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_api_key(api_key: String) -> Result<ApiKeyStatus, String> {
    save_api_key_file(&api_key).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn clear_api_key() -> Result<ApiKeyStatus, String> {
    clear_api_key_file().map_err(|err| err.to_string())
}
