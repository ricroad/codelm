use std::path::{Path, PathBuf};

use crate::settings;

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

pub fn configured_project_paths() -> Result<(PathBuf, PathBuf), String> {
    let default_repo = default_repo_root();
    let default_graph = default_graph_path(&default_repo);
    let paths =
        settings::project_paths(&default_repo, &default_graph).map_err(|err| err.to_string())?;
    Ok((
        PathBuf::from(paths.repo_root),
        PathBuf::from(paths.graph_path),
    ))
}
