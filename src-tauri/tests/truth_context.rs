use std::fs;

use code_reading_lib::truth::{build_truth_context, TruthError};
use tempfile::tempdir;

fn write_fixture(root: &std::path::Path) -> std::path::PathBuf {
    fs::create_dir_all(root.join("src")).unwrap();
    fs::write(
        root.join("src/App.tsx"),
        "line one\nexport function App() {\n  return <main />;\n}\n",
    )
    .unwrap();

    let graph_dir = root.join(".understand-anything");
    fs::create_dir_all(&graph_dir).unwrap();
    let graph_path = graph_dir.join("knowledge-graph.json");
    let graph = serde_json::json!({
        "version": "1",
        "project": {
            "name": "fixture",
            "languages": ["TypeScript"],
            "frameworks": ["React"],
            "description": "fixture graph",
            "analyzedAt": "2026-06-23T06:43:22.788Z",
            "gitCommitHash": "graph-sha"
        },
        "nodes": [
            {
                "id": "file:src/App.tsx",
                "type": "file",
                "name": "App.tsx",
                "filePath": "src/App.tsx",
                "lineRange": [2, 3],
                "summary": "Renders the application shell.",
                "tags": ["react", "shell"],
                "complexity": "simple"
            },
            {
                "id": "module:api",
                "type": "module",
                "name": "API Client",
                "summary": "Calls backend commands.",
                "tags": ["api"],
                "complexity": "moderate"
            },
            {
                "id": "module:router",
                "type": "module",
                "name": "Router",
                "summary": "Routes users into the app.",
                "tags": ["routing"],
                "complexity": "simple"
            }
        ],
        "edges": [
            {
                "source": "file:src/App.tsx",
                "target": "module:api",
                "type": "calls",
                "direction": "forward",
                "description": "App calls the API client.",
                "weight": 0.8
            },
            {
                "source": "module:router",
                "target": "file:src/App.tsx",
                "type": "depends_on",
                "direction": "forward",
                "description": "Router depends on the app shell.",
                "weight": 0.6
            }
        ],
        "layers": [{
            "id": "layer:ui",
            "name": "UI Layer",
            "description": "React user interface",
            "nodeIds": ["file:src/App.tsx", "module:router"]
        }],
        "tour": []
    });
    fs::write(&graph_path, serde_json::to_vec(&graph).unwrap()).unwrap();
    graph_path
}

#[test]
fn builds_truth_context_for_a_graph_node() {
    let temp = tempdir().unwrap();
    let graph_path = write_fixture(temp.path());

    let context = build_truth_context(temp.path(), &graph_path, "file:src/App.tsx").unwrap();

    assert_eq!(context.node.id, "file:src/App.tsx");
    assert_eq!(context.node.name, "App.tsx");
    assert_eq!(context.node.summary, "Renders the application shell.");
    assert_eq!(context.node.tags, vec!["react", "shell"]);
    assert_eq!(context.layer.unwrap().name, "UI Layer");

    let snippet = context.source_snippet.unwrap();
    assert_eq!(snippet.path, "src/App.tsx");
    assert_eq!(snippet.start_line, 2);
    assert_eq!(snippet.end_line, 3);
    assert!(snippet.content.contains("export function App"));
    assert!(snippet.content.contains("return <main />"));
    assert!(!snippet.content.contains("line one"));

    assert_eq!(context.outgoing_edges.len(), 1);
    assert_eq!(context.outgoing_edges[0].other_node_id, "module:api");
    assert_eq!(context.outgoing_edges[0].other_node_name, "API Client");
    assert_eq!(context.incoming_edges.len(), 1);
    assert_eq!(context.incoming_edges[0].other_node_id, "module:router");
    assert_eq!(context.incoming_edges[0].other_node_name, "Router");
}

#[test]
fn returns_node_not_found_for_unknown_node_id() {
    let temp = tempdir().unwrap();
    let graph_path = write_fixture(temp.path());

    let err = build_truth_context(temp.path(), &graph_path, "missing").unwrap_err();

    assert!(matches!(err, TruthError::NodeNotFound));
}
