use code_reading_lib::ai::{
    build_anthropic_request, build_feynman_prompt, parse_feynman_feedback,
};
use code_reading_lib::truth::{
    SourceSnippet, TruthContext, TruthEdge, TruthLayer, TruthNode,
};

fn fixture_context() -> TruthContext {
    TruthContext {
        node: TruthNode {
            id: "file:src/App.tsx".to_string(),
            node_type: "file".to_string(),
            name: "App.tsx".to_string(),
            file_path: Some("src/App.tsx".to_string()),
            line_range: Some([10, 20]),
            summary: "Renders the app shell and wires providers.".to_string(),
            tags: vec!["react".to_string(), "entry".to_string()],
            complexity: "moderate".to_string(),
        },
        layer: Some(TruthLayer {
            id: "layer:ui".to_string(),
            name: "UI Layer".to_string(),
            description: "React entry and layout shell.".to_string(),
        }),
        incoming_edges: vec![TruthEdge {
            relation: "depends_on".to_string(),
            direction: "forward".to_string(),
            description: Some("Router enters the app shell.".to_string()),
            weight: 0.7,
            other_node_id: "module:router".to_string(),
            other_node_name: "Router".to_string(),
        }],
        outgoing_edges: vec![TruthEdge {
            relation: "calls".to_string(),
            direction: "forward".to_string(),
            description: Some("App calls API setup.".to_string()),
            weight: 0.8,
            other_node_id: "module:api".to_string(),
            other_node_name: "API Client".to_string(),
        }],
        source_snippet: Some(SourceSnippet {
            path: "src/App.tsx".to_string(),
            language: "tsx".to_string(),
            start_line: 10,
            end_line: 20,
            content: "export function App() { return <main />; }".to_string(),
        }),
    }
}

#[test]
fn prompt_contains_truth_context_and_user_explanation() {
    let prompt = build_feynman_prompt(
        &fixture_context(),
        "App 是入口，负责把 provider 和页面壳接起来。",
    );

    assert!(prompt.contains("App.tsx"));
    assert!(prompt.contains("UI Layer"));
    assert!(prompt.contains("API Client"));
    assert!(prompt.contains("Router"));
    assert!(prompt.contains("export function App"));
    assert!(prompt.contains("App 是入口"));
}

#[test]
fn anthropic_request_uses_messages_api_shape() {
    let request = build_anthropic_request(
        "claude-sonnet-4-6",
        "请按 JSON 返回",
    );

    assert_eq!(request["model"], "claude-sonnet-4-6");
    assert_eq!(request["max_tokens"], 1200);
    assert_eq!(request["messages"][0]["role"], "user");
    assert_eq!(request["messages"][0]["content"], "请按 JSON 返回");
    assert!(request["system"].as_str().unwrap().contains("费曼"));
}

#[test]
fn parses_fenced_feedback_json_from_claude_text() {
    let raw = r#"```json
{
  "verdict": "基本到位",
  "convergence": { "aligned": 3, "total": 4 },
  "points": [
    { "kind": "hit", "text": "讲到了入口职责。", "nodeRef": "file:src/App.tsx" },
    { "kind": "miss", "text": "漏了 API 边界。" }
  ],
  "mentorComment": "继续补上下游依赖。",
  "followUp": { "question": "API Client 变更会影响哪里？", "targetConcept": "关键依赖流向" },
  "weakPoints": ["关键依赖流向"]
}
```"#;

    let feedback = parse_feynman_feedback(raw).unwrap();

    assert_eq!(feedback.verdict, "基本到位");
    assert_eq!(feedback.convergence.aligned, 3);
    assert_eq!(feedback.points[0].node_ref.as_deref(), Some("file:src/App.tsx"));
    assert_eq!(feedback.follow_up.target_concept, "关键依赖流向");
    assert_eq!(feedback.weak_points, vec!["关键依赖流向"]);
}
