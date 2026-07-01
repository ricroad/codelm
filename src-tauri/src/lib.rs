pub mod ai;
pub mod commands;
pub mod config;
pub mod graph;
pub mod progress;
pub mod settings;
pub mod source;
pub mod truth;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ai_feynman_feedback,
            commands::ai_generalize_feedback,
            commands::load_graph,
            commands::load_progress,
            commands::read_source,
            commands::read_truth_context,
            commands::api_key_status,
            commands::save_api_key,
            commands::clear_api_key,
            commands::ai_model_settings,
            commands::save_ai_model_settings,
            commands::project_paths,
            commands::save_project_paths,
            commands::save_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running code-reading");
}
