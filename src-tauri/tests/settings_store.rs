use code_reading_lib::settings::{
    clear_api_key_at_path, load_api_key_at_path, load_project_paths_at_path, save_api_key_at_path,
    save_project_paths_at_path, settings_status_at_path,
};
use tempfile::tempdir;

#[test]
fn settings_status_reports_missing_key() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("settings.json");

    let status = settings_status_at_path(&path).unwrap();

    assert!(!status.configured);
    assert_eq!(status.source, "none");
    assert_eq!(status.masked_key, None);
}

#[test]
fn saves_loads_and_masks_api_key() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("nested/settings.json");

    let status = save_api_key_at_path(&path, "sk-ant-api03-example-secret").unwrap();
    let loaded = load_api_key_at_path(&path).unwrap();

    assert!(status.configured);
    assert_eq!(status.source, "settings");
    assert_eq!(status.masked_key.as_deref(), Some("sk-a...cret"));
    assert_eq!(loaded.as_deref(), Some("sk-ant-api03-example-secret"));
}

#[test]
fn clearing_api_key_removes_saved_secret() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("settings.json");

    save_api_key_at_path(&path, "sk-ant-api03-example-secret").unwrap();
    let status = clear_api_key_at_path(&path).unwrap();
    let loaded = load_api_key_at_path(&path).unwrap();

    assert!(!status.configured);
    assert_eq!(status.source, "none");
    assert_eq!(loaded, None);
}

#[test]
fn project_paths_fall_back_to_default_repo_and_graph() {
    let temp = tempdir().unwrap();
    let settings_path = temp.path().join("settings.json");
    let default_repo = temp.path().join("repo");
    let default_graph = default_repo.join(".understand-anything/knowledge-graph.json");

    let paths = load_project_paths_at_path(&settings_path, &default_repo, &default_graph).unwrap();

    assert!(!paths.configured);
    assert_eq!(paths.source, "default");
    assert_eq!(paths.repo_root, default_repo.display().to_string());
    assert_eq!(paths.graph_path, default_graph.display().to_string());
}

#[test]
fn saves_project_repo_and_custom_graph_path() {
    let temp = tempdir().unwrap();
    let settings_path = temp.path().join("nested/settings.json");
    let default_repo = temp.path().join("default-repo");
    let default_graph = default_repo.join(".understand-anything/knowledge-graph.json");
    let repo = temp.path().join("custom-repo");
    let graph = temp.path().join("custom-graph.json");

    let saved = save_project_paths_at_path(
        &settings_path,
        &repo.display().to_string(),
        &graph.display().to_string(),
        &default_repo,
        &default_graph,
    )
    .unwrap();
    let loaded = load_project_paths_at_path(&settings_path, &default_repo, &default_graph).unwrap();

    assert!(saved.configured);
    assert_eq!(saved.source, "settings");
    assert_eq!(loaded.repo_root, repo.display().to_string());
    assert_eq!(loaded.graph_path, graph.display().to_string());
}

#[test]
fn blank_graph_path_uses_repo_default_graph() {
    let temp = tempdir().unwrap();
    let settings_path = temp.path().join("settings.json");
    let default_repo = temp.path().join("default-repo");
    let default_graph = default_repo.join(".understand-anything/knowledge-graph.json");
    let repo = temp.path().join("custom-repo");
    let repo_default_graph = repo.join(".understand-anything/knowledge-graph.json");

    let saved = save_project_paths_at_path(
        &settings_path,
        &repo.display().to_string(),
        "",
        &default_repo,
        &default_graph,
    )
    .unwrap();

    assert!(saved.configured);
    assert_eq!(saved.repo_root, repo.display().to_string());
    assert_eq!(saved.graph_path, repo_default_graph.display().to_string());
}
