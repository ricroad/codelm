use code_reading_lib::settings::{
    clear_api_key_at_path, load_api_key_at_path, save_api_key_at_path, settings_status_at_path,
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
