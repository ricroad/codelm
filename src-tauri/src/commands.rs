use crate::ai::{
    request_feynman_feedback, request_generalize_feedback, FeynmanFeedback,
    GeneralizeConversationTurn, GeneralizeFeedback, GeneralizeMode, DEFAULT_MODEL,
};
use crate::config::{configured_project_paths, default_graph_path, default_repo_root};
use crate::graph::{load_graph_from_paths, GraphLoadResponse};
use crate::progress::{
    load_progress as load_progress_file, save_progress as save_progress_file, LearningProgress,
};
use crate::settings::{
    ai_model_settings as ai_model_settings_file, api_key_status as api_key_status_file,
    clear_api_key as clear_api_key_file, project_paths as project_paths_file,
    save_ai_model_settings as save_ai_model_settings_file, save_api_key as save_api_key_file,
    save_project_paths as save_project_paths_file, AiModelSettings, ApiKeyStatus, ProjectPaths,
};
use crate::source::{read_source_from_repo, SourceFile};
use crate::truth::{build_truth_context, TruthContext};

#[tauri::command]
pub fn load_graph() -> Result<GraphLoadResponse, String> {
    let (repo_root, graph_path) = configured_project_paths()?;
    load_graph_from_paths(&repo_root, &graph_path)
}

#[tauri::command]
pub fn read_source(path: String) -> Result<SourceFile, String> {
    let (repo_root, graph_path) = configured_project_paths()?;
    read_source_from_repo(&repo_root, &graph_path, &path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn read_truth_context(node_id: String) -> Result<TruthContext, String> {
    let (repo_root, graph_path) = configured_project_paths()?;
    build_truth_context(&repo_root, &graph_path, &node_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn ai_feynman_feedback(
    node_id: String,
    user_explanation: String,
) -> Result<FeynmanFeedback, String> {
    let (repo_root, graph_path) = configured_project_paths()?;
    request_feynman_feedback(&repo_root, &graph_path, &node_id, &user_explanation)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn ai_generalize_feedback(
    gen_var: String,
    user_response: String,
    conversation: Option<Vec<GeneralizeConversationTurn>>,
) -> Result<GeneralizeFeedback, String> {
    let (_repo_root, graph_path) = configured_project_paths()?;
    let mode = GeneralizeMode::from_str(&gen_var)
        .ok_or_else(|| format!("unknown generalize variant: {gen_var}"))?;
    let conversation = conversation.unwrap_or_default();
    request_generalize_feedback(&graph_path, mode, &user_response, &conversation)
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

#[tauri::command]
pub fn ai_model_settings() -> Result<AiModelSettings, String> {
    ai_model_settings_file(DEFAULT_MODEL).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_ai_model_settings(model: String) -> Result<AiModelSettings, String> {
    save_ai_model_settings_file(&model, DEFAULT_MODEL).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn project_paths() -> Result<ProjectPaths, String> {
    let default_repo = default_repo_root();
    let default_graph = default_graph_path(&default_repo);
    project_paths_file(&default_repo, &default_graph).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_project_paths(repo_root: String, graph_path: String) -> Result<ProjectPaths, String> {
    let default_repo = default_repo_root();
    let default_graph = default_graph_path(&default_repo);
    save_project_paths_file(&repo_root, &graph_path, &default_repo, &default_graph)
        .map_err(|err| err.to_string())
}
