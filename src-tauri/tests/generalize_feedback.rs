use code_reading_lib::ai::{
    build_generalize_prompt, build_generalize_prompt_with_history, parse_generalize_feedback,
    GeneralizeConversationTurn, GeneralizeMode,
};

fn fixture_graph() -> serde_json::Value {
    serde_json::json!({
        "version": "1",
        "project": {
            "name": "fixture",
            "languages": ["TypeScript"],
            "frameworks": ["React"],
            "description": "Canvas app",
            "analyzedAt": "2026-06-23T06:43:22.788Z",
            "gitCommitHash": "graph-sha"
        },
        "nodes": [
            {
                "id": "src/App.tsx",
                "type": "file",
                "name": "App.tsx",
                "summary": "Starts the app shell.",
                "tags": ["entry"],
                "complexity": "simple"
            },
            {
                "id": "src/commands/ai.ts",
                "type": "module",
                "name": "ai.ts",
                "summary": "Isolates model commands.",
                "tags": ["commands", "ai"],
                "complexity": "moderate"
            }
        ],
        "edges": [
            {
                "source": "src/App.tsx",
                "target": "src/commands/ai.ts",
                "type": "calls",
                "direction": "forward",
                "description": "UI reaches the command boundary.",
                "weight": 0.8
            }
        ],
        "layers": [
            {
                "id": "layer:ui",
                "name": "UI Layer",
                "description": "React user interface",
                "nodeIds": ["src/App.tsx"]
            },
            {
                "id": "layer:commands",
                "name": "Command Layer",
                "description": "Browser and model command adapters",
                "nodeIds": ["src/commands/ai.ts"]
            }
        ],
        "tour": [
            {
                "order": 1,
                "title": "应用启动路径",
                "description": "Start from the app shell.",
                "nodeIds": ["src/App.tsx"]
            },
            {
                "order": 2,
                "title": "AI 生成链路",
                "description": "Follow UI intent into command boundaries.",
                "nodeIds": ["src/commands/ai.ts"]
            }
        ]
    })
}

#[test]
fn generalize_prompt_contains_variant_and_route_map() {
    let graph = fixture_graph();
    let prompt = build_generalize_prompt(
        &graph,
        GeneralizeMode::Counterfactual,
        "如果 hook 直接 fetch 模型，会泄露 key，也会绕过命令边界。",
    )
    .unwrap();

    assert!(prompt.contains("Y · 反事实"));
    assert!(prompt.contains("删掉 commands 层"));
    assert!(prompt.contains("应用启动路径"));
    assert!(prompt.contains("AI 生成链路"));
    assert!(prompt.contains("Command Layer"));
    assert!(prompt.contains("UI reaches the command boundary"));
    assert!(prompt.contains("如果 hook 直接 fetch 模型"));
}

#[test]
fn teach_newcomer_prompt_contains_dialog_history() {
    let graph = fixture_graph();
    let history = vec![
        GeneralizeConversationTurn {
            speaker: "learner".to_string(),
            text: "UI 只表达用户意图。".to_string(),
        },
        GeneralizeConversationTurn {
            speaker: "newcomer".to_string(),
            text: "我还是不懂，为什么不能直接调 API？".to_string(),
        },
    ];
    let prompt = build_generalize_prompt_with_history(
        &graph,
        GeneralizeMode::TeachNewcomer,
        "因为 commands 层负责 key、安全边界和错误恢复。",
        &history,
    )
    .unwrap();

    assert!(prompt.contains("历史对话"));
    assert!(prompt.contains("learner: UI 只表达用户意图。"));
    assert!(prompt.contains("newcomer: 我还是不懂，为什么不能直接调 API？"));
    assert!(prompt.contains("因为 commands 层负责 key、安全边界和错误恢复。"));
}

#[test]
fn parses_generalize_feedback_json() {
    let raw = r#"```json
{
  "verdict": "迁移方向成立",
  "coverage": { "covered": 3, "total": 5 },
  "points": [
    { "kind": "hit", "text": "覆盖了 UI 到命令层。" },
    { "kind": "miss", "text": "漏了失败状态回写。" }
  ],
  "mentorComment": "补齐资产回写和错误恢复。",
  "followUp": { "question": "如果模型失败，哪一层负责恢复？", "targetConcept": "失败状态" },
  "weakPoints": ["失败状态"],
  "newcomerReply": "我理解了，不能绕过命令层。",
  "understood": false
}
```"#;

    let feedback = parse_generalize_feedback(raw).unwrap();

    assert_eq!(feedback.verdict, "迁移方向成立");
    assert_eq!(feedback.coverage.covered, 3);
    assert_eq!(feedback.points[1].kind, "miss");
    assert_eq!(
        feedback.newcomer_reply.as_deref(),
        Some("我理解了，不能绕过命令层。")
    );
    assert!(!feedback.understood);
}
