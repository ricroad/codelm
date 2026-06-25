use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

use crate::truth::{build_truth_context, TruthContext, TruthError};

const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MODEL: &str = "claude-sonnet-4-6";

#[derive(Debug, Error)]
pub enum AiError {
    #[error("ANTHROPIC_API_KEY is not configured")]
    MissingApiKey,
    #[error("failed to build truth context: {0}")]
    Truth(String),
    #[error("Claude API request failed: {0}")]
    Http(String),
    #[error("Claude API returned status {status}: {body}")]
    ApiStatus { status: u16, body: String },
    #[error("Claude response did not contain text content")]
    EmptyResponse,
    #[error("failed to parse Claude feedback: {0}")]
    ResponseParse(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeynmanFeedbackPoint {
    pub kind: String,
    pub text: String,
    pub node_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeynmanConvergence {
    pub aligned: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeynmanFollowUp {
    pub question: String,
    pub target_concept: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeynmanFeedback {
    pub verdict: String,
    pub convergence: FeynmanConvergence,
    pub points: Vec<FeynmanFeedbackPoint>,
    pub mentor_comment: String,
    pub follow_up: FeynmanFollowUp,
    pub weak_points: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GeneralizeMode {
    Scenario,
    Counterfactual,
    TeachNewcomer,
}

impl GeneralizeMode {
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "X" | "scenario" => Some(Self::Scenario),
            "Y" | "counterfactual" => Some(Self::Counterfactual),
            "Z" | "teachNewcomer" | "teach_newcomer" => Some(Self::TeachNewcomer),
            _ => None,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Scenario => "X · 情景推演",
            Self::Counterfactual => "Y · 反事实",
            Self::TeachNewcomer => "Z · 教新人",
        }
    }

    fn prompt(self) -> &'static str {
        match self {
            Self::Scenario => {
                "新场景：拖参考图 + 提示词点『生成视频』，把链路从点击到出片串讲一遍。"
            }
            Self::Counterfactual => {
                "反事实：删掉 commands 层，让 hook 直接 fetch 模型，会坏在哪？请讲清后果链。"
            }
            Self::TeachNewcomer => {
                "新人追问：为什么不直接在按钮点击里调模型 API？讲到他能复述为止。"
            }
        }
    }

    fn rubric(self) -> &'static str {
        match self {
            Self::Scenario => {
                "重点检查每一跳是否覆盖：入口、状态、命令边界、模型调用、结果回写、失败处理。"
            }
            Self::Counterfactual => {
                "重点检查后果链是否成立：安全边界、可测试性、状态一致性、错误恢复、维护成本。"
            }
            Self::TeachNewcomer => {
                "你要扮演困惑新人，判断用户是否讲到新人能复述；如果还不行，给出新人追问。"
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralizeCoverage {
    pub covered: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralizeFeedbackPoint {
    pub kind: String,
    pub text: String,
    pub node_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralizeFeedback {
    pub verdict: String,
    pub coverage: GeneralizeCoverage,
    pub points: Vec<GeneralizeFeedbackPoint>,
    pub mentor_comment: String,
    pub follow_up: FeynmanFollowUp,
    pub weak_points: Vec<String>,
    pub newcomer_reply: Option<String>,
    pub understood: bool,
}

impl From<TruthError> for AiError {
    fn from(value: TruthError) -> Self {
        AiError::Truth(value.to_string())
    }
}

fn edge_lines(context: &TruthContext) -> String {
    let mut lines = Vec::new();
    for edge in &context.outgoing_edges {
        lines.push(format!(
            "outgoing: {} -> {} ({})",
            edge.relation,
            edge.other_node_name,
            edge.description.clone().unwrap_or_default()
        ));
    }
    for edge in &context.incoming_edges {
        lines.push(format!(
            "incoming: {} -> {} ({})",
            edge.other_node_name,
            edge.relation,
            edge.description.clone().unwrap_or_default()
        ));
    }
    if lines.is_empty() {
        "none".to_string()
    } else {
        lines.join("\n")
    }
}

pub fn build_feynman_prompt(context: &TruthContext, user_explanation: &str) -> String {
    let layer = context
        .layer
        .as_ref()
        .map(|layer| format!("{}: {}", layer.name, layer.description))
        .unwrap_or_else(|| "unknown".to_string());
    let snippet = context
        .source_snippet
        .as_ref()
        .map(|source| {
            format!(
                "{} L{}-L{}\n```{}\n{}\n```",
                source.path, source.start_line, source.end_line, source.language, source.content
            )
        })
        .unwrap_or_else(|| "source snippet unavailable".to_string());

    format!(
        r#"你要按费曼学习法核对用户对代码节点的讲解。

代码真相:
- node id: {node_id}
- name: {name}
- type: {node_type}
- summary: {summary}
- tags: {tags}
- layer: {layer}
- dependencies:
{edges}
- source:
{snippet}

用户讲解:
{user_explanation}

只返回 JSON，不要 markdown，不要解释。JSON shape:
{{
  "verdict": "一句话结论",
  "convergence": {{ "aligned": 0, "total": 4 }},
  "points": [
    {{ "kind": "hit|deviation|miss", "text": "逐点对照", "nodeRef": "可选节点id" }}
  ],
  "mentorComment": "导师点评",
  "followUp": {{ "question": "追问", "targetConcept": "目标概念" }},
  "weakPoints": ["薄弱概念"]
}}"#,
        node_id = context.node.id,
        name = context.node.name,
        node_type = context.node.node_type,
        summary = context.node.summary,
        tags = context.node.tags.join(", "),
        layer = layer,
        edges = edge_lines(context),
        snippet = snippet,
        user_explanation = user_explanation
    )
}

pub fn build_anthropic_request(model: &str, prompt: &str) -> Value {
    json!({
        "model": model,
        "max_tokens": 1200,
        "system": "你是费曼式代码学习导师。你必须基于代码真相逐点核对用户讲解，只返回指定 JSON。",
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    })
}

pub fn build_generalize_anthropic_request(model: &str, prompt: &str) -> Value {
    json!({
        "model": model,
        "max_tokens": 1400,
        "system": "你是费曼式代码学习导师，负责检验用户能否把代码链路迁移到新场景。你必须基于图谱路径和分层边界逐点核对，只返回指定 JSON。",
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    })
}

fn extract_json_object(raw: &str) -> Result<&str, AiError> {
    let start = raw
        .find('{')
        .ok_or_else(|| AiError::ResponseParse("missing JSON object start".to_string()))?;
    let end = raw
        .rfind('}')
        .ok_or_else(|| AiError::ResponseParse("missing JSON object end".to_string()))?;
    if end < start {
        return Err(AiError::ResponseParse(
            "invalid JSON object bounds".to_string(),
        ));
    }
    Ok(&raw[start..=end])
}

pub fn parse_feynman_feedback(raw: &str) -> Result<FeynmanFeedback, AiError> {
    let json_text = extract_json_object(raw)?;
    serde_json::from_str(json_text).map_err(|err| AiError::ResponseParse(err.to_string()))
}

pub fn parse_generalize_feedback(raw: &str) -> Result<GeneralizeFeedback, AiError> {
    let json_text = extract_json_object(raw)?;
    serde_json::from_str(json_text).map_err(|err| AiError::ResponseParse(err.to_string()))
}

fn api_key_from_env() -> Result<String, AiError> {
    std::env::var("ANTHROPIC_API_KEY")
        .or_else(|_| std::env::var("CLAUDE_API_KEY"))
        .map_err(|_| AiError::MissingApiKey)
        .map(|key| key.trim().to_string())
        .and_then(|key| {
            if key.is_empty() {
                Err(AiError::MissingApiKey)
            } else {
                Ok(key)
            }
        })
}

fn model_from_env() -> String {
    std::env::var("ANTHROPIC_MODEL")
        .ok()
        .map(|model| model.trim().to_string())
        .filter(|model| !model.is_empty())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string())
}

fn messages_url_from_env() -> String {
    std::env::var("ANTHROPIC_MESSAGES_URL")
        .ok()
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .unwrap_or_else(|| ANTHROPIC_MESSAGES_URL.to_string())
}

async fn call_anthropic(prompt: &str) -> Result<FeynmanFeedback, AiError> {
    let key = api_key_from_env()?;
    let model = model_from_env();
    let request = build_anthropic_request(&model, prompt);
    let response = reqwest::Client::new()
        .post(messages_url_from_env())
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|err| AiError::Http(err.to_string()))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| AiError::Http(err.to_string()))?;
    if !status.is_success() {
        return Err(AiError::ApiStatus {
            status: status.as_u16(),
            body,
        });
    }

    let value: Value =
        serde_json::from_str(&body).map_err(|err| AiError::ResponseParse(err.to_string()))?;
    let text = value
        .get("content")
        .and_then(Value::as_array)
        .and_then(|blocks| {
            blocks
                .iter()
                .filter(|block| block.get("type").and_then(Value::as_str) == Some("text"))
                .filter_map(|block| block.get("text").and_then(Value::as_str))
                .next()
        })
        .ok_or(AiError::EmptyResponse)?;
    parse_feynman_feedback(text)
}

async fn call_anthropic_for_generalize(prompt: &str) -> Result<GeneralizeFeedback, AiError> {
    let key = api_key_from_env()?;
    let model = model_from_env();
    let request = build_generalize_anthropic_request(&model, prompt);
    let response = reqwest::Client::new()
        .post(messages_url_from_env())
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|err| AiError::Http(err.to_string()))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| AiError::Http(err.to_string()))?;
    if !status.is_success() {
        return Err(AiError::ApiStatus {
            status: status.as_u16(),
            body,
        });
    }

    let value: Value =
        serde_json::from_str(&body).map_err(|err| AiError::ResponseParse(err.to_string()))?;
    let text = value
        .get("content")
        .and_then(Value::as_array)
        .and_then(|blocks| {
            blocks
                .iter()
                .filter(|block| block.get("type").and_then(Value::as_str) == Some("text"))
                .filter_map(|block| block.get("text").and_then(Value::as_str))
                .next()
        })
        .ok_or(AiError::EmptyResponse)?;
    parse_generalize_feedback(text)
}

fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn graph_layers_summary(graph: &Value) -> String {
    graph
        .get("layers")
        .and_then(Value::as_array)
        .map(|layers| {
            layers
                .iter()
                .take(12)
                .map(|layer| {
                    format!(
                        "- {}: {}",
                        string_field(layer, "name"),
                        string_field(layer, "description")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "- no layers".to_string())
}

fn graph_tour_summary(graph: &Value) -> String {
    graph
        .get("tour")
        .and_then(Value::as_array)
        .map(|tour| {
            tour.iter()
                .take(12)
                .map(|step| {
                    format!(
                        "{}. {} — {}",
                        step.get("order").and_then(Value::as_u64).unwrap_or(0),
                        string_field(step, "title"),
                        string_field(step, "description")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "no tour".to_string())
}

fn graph_edges_summary(graph: &Value) -> String {
    graph
        .get("edges")
        .and_then(Value::as_array)
        .map(|edges| {
            edges
                .iter()
                .take(20)
                .map(|edge| {
                    format!(
                        "- {} -> {} [{}] {}",
                        string_field(edge, "source"),
                        string_field(edge, "target"),
                        string_field(edge, "type"),
                        string_field(edge, "description")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "- no edges".to_string())
}

pub fn build_generalize_prompt(
    graph: &Value,
    mode: GeneralizeMode,
    user_response: &str,
) -> Result<String, AiError> {
    let project_name = graph
        .get("project")
        .and_then(|project| project.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("unknown project");

    Ok(format!(
        r#"你要检验用户是否能把代码知识图谱中的主链路泛化到新场景。

泛化模式: {label}
题目: {prompt}
评分重点: {rubric}

项目: {project_name}

学习路径:
{tour}

分层地图:
{layers}

关键依赖边样本:
{edges}

用户回答:
{user_response}

只返回 JSON，不要 markdown，不要解释。JSON shape:
{{
  "verdict": "一句话结论",
  "coverage": {{ "covered": 0, "total": 6 }},
  "points": [
    {{ "kind": "hit|deviation|miss", "text": "每跳覆盖/后果链/新人理解逐点核对", "nodeRef": "可选节点id" }}
  ],
  "mentorComment": "导师点评",
  "followUp": {{ "question": "追问", "targetConcept": "目标概念" }},
  "weakPoints": ["薄弱概念"],
  "newcomerReply": "Z 模式下新人复述；X/Y 可为空",
  "understood": false
}}"#,
        label = mode.label(),
        prompt = mode.prompt(),
        rubric = mode.rubric(),
        project_name = project_name,
        tour = graph_tour_summary(graph),
        layers = graph_layers_summary(graph),
        edges = graph_edges_summary(graph),
        user_response = user_response
    ))
}

pub async fn request_feynman_feedback(
    repo_root: &Path,
    graph_path: &Path,
    node_id: &str,
    user_explanation: &str,
) -> Result<FeynmanFeedback, AiError> {
    let context = build_truth_context(repo_root, graph_path, node_id)?;
    let prompt = build_feynman_prompt(&context, user_explanation);
    call_anthropic(&prompt).await
}

pub async fn request_generalize_feedback(
    graph_path: &Path,
    mode: GeneralizeMode,
    user_response: &str,
) -> Result<GeneralizeFeedback, AiError> {
    let raw = std::fs::read_to_string(graph_path).map_err(|err| AiError::Truth(err.to_string()))?;
    let graph: Value =
        serde_json::from_str(&raw).map_err(|err| AiError::ResponseParse(err.to_string()))?;
    let prompt = build_generalize_prompt(&graph, mode, user_response)?;
    call_anthropic_for_generalize(&prompt).await
}
