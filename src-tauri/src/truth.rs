use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::source::{read_source_from_repo, SourceError, SourceFile};

#[derive(Debug, Error)]
pub enum TruthError {
    #[error("failed to read graph: {0}")]
    GraphRead(String),
    #[error("failed to parse graph: {0}")]
    GraphParse(String),
    #[error("node not found")]
    NodeNotFound,
    #[error("failed to read source: {0}")]
    Source(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruthNode {
    pub id: String,
    pub node_type: String,
    pub name: String,
    pub file_path: Option<String>,
    pub line_range: Option<[usize; 2]>,
    pub summary: String,
    pub tags: Vec<String>,
    pub complexity: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruthLayer {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruthEdge {
    pub relation: String,
    pub direction: String,
    pub description: Option<String>,
    pub weight: f64,
    pub other_node_id: String,
    pub other_node_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSnippet {
    pub path: String,
    pub language: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruthContext {
    pub node: TruthNode,
    pub layer: Option<TruthLayer>,
    pub incoming_edges: Vec<TruthEdge>,
    pub outgoing_edges: Vec<TruthEdge>,
    pub source_snippet: Option<SourceSnippet>,
}

fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn optional_string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

fn string_array_field(value: &Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn line_range_field(value: &Value) -> Option<[usize; 2]> {
    let items = value.get("lineRange")?.as_array()?;
    if items.len() != 2 {
        return None;
    }
    let start = items[0].as_u64()? as usize;
    let end = items[1].as_u64()? as usize;
    if start == 0 || end < start {
        return None;
    }
    Some([start, end])
}

fn to_truth_node(value: &Value) -> TruthNode {
    TruthNode {
        id: string_field(value, "id"),
        node_type: string_field(value, "type"),
        name: string_field(value, "name"),
        file_path: optional_string_field(value, "filePath"),
        line_range: line_range_field(value),
        summary: string_field(value, "summary"),
        tags: string_array_field(value, "tags"),
        complexity: string_field(value, "complexity"),
    }
}

fn to_slash_path(path_value: &Path) -> String {
    path_value
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn relative_file_path(repo_root: &Path, file_path: &str) -> Result<String, TruthError> {
    let input = Path::new(file_path);
    let relative: PathBuf = if input.is_absolute() {
        input
            .strip_prefix(repo_root)
            .map_err(|_| TruthError::Source(SourceError::InvalidPath.to_string()))?
            .to_path_buf()
    } else {
        input.to_path_buf()
    };
    Ok(to_slash_path(&relative))
}

fn extract_snippet(source: SourceFile, line_range: Option<[usize; 2]>) -> SourceSnippet {
    let lines: Vec<&str> = source.content.split('\n').collect();
    let total_lines = source.line_count.max(1);
    let [start, end] = line_range.unwrap_or([1, total_lines.min(120)]);
    let start_line = start.clamp(1, total_lines);
    let end_line = end.clamp(start_line, total_lines);
    let content = lines[(start_line - 1)..end_line].join("\n");

    SourceSnippet {
        path: source.path,
        language: source.language,
        start_line,
        end_line,
        content,
    }
}

fn graph_layer_for_node(graph: &Value, node_id: &str) -> Option<TruthLayer> {
    graph
        .get("layers")?
        .as_array()?
        .iter()
        .find(|layer| {
            layer
                .get("nodeIds")
                .and_then(Value::as_array)
                .map(|ids| ids.iter().any(|id| id.as_str() == Some(node_id)))
                .unwrap_or(false)
        })
        .map(|layer| TruthLayer {
            id: string_field(layer, "id"),
            name: string_field(layer, "name"),
            description: string_field(layer, "description"),
        })
}

fn truth_edges_for_node(graph: &Value, node_id: &str) -> (Vec<TruthEdge>, Vec<TruthEdge>) {
    let node_names: HashMap<String, String> = graph
        .get("nodes")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .map(|node| (string_field(node, "id"), string_field(node, "name")))
        .collect();
    let mut incoming = Vec::new();
    let mut outgoing = Vec::new();

    for edge in graph
        .get("edges")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
    {
        let source = string_field(edge, "source");
        let target = string_field(edge, "target");
        let relation = string_field(edge, "type");
        let direction = string_field(edge, "direction");
        let description = optional_string_field(edge, "description");
        let weight = edge.get("weight").and_then(Value::as_f64).unwrap_or(1.0);

        if source == node_id {
            outgoing.push(TruthEdge {
                relation,
                direction,
                description,
                weight,
                other_node_id: target.clone(),
                other_node_name: node_names.get(&target).cloned().unwrap_or(target),
            });
        } else if target == node_id {
            incoming.push(TruthEdge {
                relation,
                direction,
                description,
                weight,
                other_node_id: source.clone(),
                other_node_name: node_names.get(&source).cloned().unwrap_or(source),
            });
        }
    }

    (incoming, outgoing)
}

pub fn build_truth_context(
    repo_root: &Path,
    graph_path: &Path,
    node_id: &str,
) -> Result<TruthContext, TruthError> {
    let raw = std::fs::read_to_string(graph_path)
        .map_err(|err| TruthError::GraphRead(err.to_string()))?;
    let graph: Value =
        serde_json::from_str(&raw).map_err(|err| TruthError::GraphParse(err.to_string()))?;
    let node_value = graph
        .get("nodes")
        .and_then(Value::as_array)
        .and_then(|nodes| nodes.iter().find(|node| node.get("id").and_then(Value::as_str) == Some(node_id)))
        .ok_or(TruthError::NodeNotFound)?;
    let node = to_truth_node(node_value);
    let layer = graph_layer_for_node(&graph, node_id);
    let (incoming_edges, outgoing_edges) = truth_edges_for_node(&graph, node_id);
    let source_snippet = node
        .file_path
        .as_deref()
        .map(|file_path| {
            let safe_path = relative_file_path(repo_root, file_path)?;
            let source = read_source_from_repo(repo_root, graph_path, &safe_path)
                .map_err(|err| TruthError::Source(err.to_string()))?;
            Ok::<SourceSnippet, TruthError>(extract_snippet(source, node.line_range))
        })
        .transpose()?;

    Ok(TruthContext {
        node,
        layer,
        incoming_edges,
        outgoing_edges,
        source_snippet,
    })
}
