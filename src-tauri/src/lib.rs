pub mod ai;
pub mod commands;
pub mod config;
pub mod graph;
pub mod source;
pub mod truth;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ai_feynman_feedback,
            commands::load_graph,
            commands::read_source,
            commands::read_truth_context,
        ])
        .run(tauri::generate_context!())
        .expect("error while running code-reading");
}
