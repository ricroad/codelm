use std::fs;

use code_reading_lib::source::{read_source_from_repo, SourceError};
use tempfile::tempdir;

fn write_graph(root: &std::path::Path, file_path: &str) -> std::path::PathBuf {
    let graph_dir = root.join(".understand-anything");
    fs::create_dir_all(&graph_dir).unwrap();
    let graph_path = graph_dir.join("knowledge-graph.json");
    let graph = serde_json::json!({
        "version": "1",
        "project": {
            "name": "fixture",
            "languages": [],
            "frameworks": [],
            "description": "",
            "analyzedAt": "2026-06-23T06:43:22.788Z",
            "gitCommitHash": "graph-sha"
        },
        "nodes": [{
            "id": "file:src/App.tsx",
            "type": "file",
            "name": "App.tsx",
            "filePath": file_path,
            "summary": "",
            "tags": [],
            "complexity": "simple"
        }],
        "edges": [],
        "layers": [],
        "tour": []
    });
    fs::write(&graph_path, serde_json::to_vec(&graph).unwrap()).unwrap();
    graph_path
}

#[test]
fn rejects_path_traversal() {
    let temp = tempdir().unwrap();
    let graph_path = write_graph(temp.path(), "src/App.tsx");

    let err = read_source_from_repo(temp.path(), &graph_path, "../secret.ts").unwrap_err();

    assert!(matches!(err, SourceError::InvalidPath));
}

#[test]
fn rejects_files_not_listed_in_graph() {
    let temp = tempdir().unwrap();
    let graph_path = write_graph(temp.path(), "src/App.tsx");
    fs::create_dir_all(temp.path().join("src")).unwrap();
    fs::write(
        temp.path().join("src/Other.tsx"),
        "export const other = true;\n",
    )
    .unwrap();

    let err = read_source_from_repo(temp.path(), &graph_path, "src/Other.tsx").unwrap_err();

    assert!(matches!(err, SourceError::NotInGraph));
}

#[test]
fn reads_whitelisted_source_file() {
    let temp = tempdir().unwrap();
    let graph_path = write_graph(temp.path(), "src/App.tsx");
    fs::create_dir_all(temp.path().join("src")).unwrap();
    fs::write(
        temp.path().join("src/App.tsx"),
        "export const app = true;\n",
    )
    .unwrap();

    let source = read_source_from_repo(temp.path(), &graph_path, "src/App.tsx").unwrap();

    assert_eq!(source.path, "src/App.tsx");
    assert_eq!(source.language, "tsx");
    assert_eq!(source.line_count, 2);
    assert!(source.content.contains("export const app"));
}
