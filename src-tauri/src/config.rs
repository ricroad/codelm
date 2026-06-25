use std::path::{Path, PathBuf};

pub fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri should live inside the workspace root")
        .to_path_buf()
}

pub fn default_repo_root() -> PathBuf {
    workspace_root().join("../画布项目/frontend-repo")
}

pub fn default_graph_path(repo_root: &Path) -> PathBuf {
    repo_root
        .join(".understand-anything")
        .join("knowledge-graph.json")
}
