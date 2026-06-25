use std::collections::HashMap;

use code_reading_lib::progress::{
    load_progress_from_path, save_progress_to_path, LearningProgress, NodeProgress,
};
use tempfile::tempdir;

#[test]
fn missing_progress_file_returns_default_progress() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("progress.json");

    let progress = load_progress_from_path(&path).unwrap();

    assert_eq!(progress.streak_days, 1);
    assert!(progress.nodes.is_empty());
}

#[test]
fn saves_and_loads_progress_round_trip() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("nested/progress.json");
    let mut nodes = HashMap::new();
    nodes.insert(
        "file:src/App.tsx".to_string(),
        NodeProgress {
            attempts: 2,
            best_convergence: 0.75,
            status: "attempted".to_string(),
            weak_concepts: vec!["关键依赖流向".to_string()],
        },
    );
    let progress = LearningProgress {
        nodes,
        streak_days: 3,
    };

    save_progress_to_path(&path, &progress).unwrap();
    let loaded = load_progress_from_path(&path).unwrap();

    assert_eq!(loaded.streak_days, 3);
    assert_eq!(loaded.nodes["file:src/App.tsx"].attempts, 2);
    assert_eq!(loaded.nodes["file:src/App.tsx"].best_convergence, 0.75);
    assert_eq!(
        loaded.nodes["file:src/App.tsx"].weak_concepts,
        vec!["关键依赖流向"]
    );
}
