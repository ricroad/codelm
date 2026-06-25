pub mod commands;
pub mod config;
pub mod graph;
pub mod source;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::load_graph,
            commands::read_source,
        ])
        .run(tauri::generate_context!())
        .expect("error while running code-reading");
}
