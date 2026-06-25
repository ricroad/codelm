import type { GraphEdge, KnowledgeGraph } from "@understand-anything/core/types";

export interface LayerEdgeAggregation {
  sourceLayerId: string;
  targetLayerId: string;
  count: number;
  edgeTypes: string[];
}

export interface PortalInfo {
  layerId: string;
  layerName: string;
  connectionCount: number;
}

/**
 * Aggregate edges between layers. Counts how many graph edges cross
 * from one layer to another. Only considers edges where both endpoints
 * are assigned to a layer.
 */
export function aggregateLayerEdges(
  graph: KnowledgeGraph,
): LayerEdgeAggregation[] {
  const nodeToLayer = new Map<string, string>();
  for (const layer of graph.layers) {
    for (const nodeId of layer.nodeIds) {
      nodeToLayer.set(nodeId, layer.id);
    }
  }

  // Key: "layerA|layerB" (sorted) → aggregation
  const pairMap = new Map<
    string,
    { sourceLayerId: string; targetLayerId: string; count: number; edgeTypes: Set<string> }
  >();

  for (const edge of graph.edges) {
    const sourceLayer = nodeToLayer.get(edge.source);
    const targetLayer = nodeToLayer.get(edge.target);
    if (!sourceLayer || !targetLayer) continue;
    if (sourceLayer === targetLayer) continue;

    // Canonical key so A→B and B→A merge
    const [a, b] =
      sourceLayer < targetLayer
        ? [sourceLayer, targetLayer]
        : [targetLayer, sourceLayer];
    const key = `${a}|${b}`;

    const existing = pairMap.get(key);
    if (existing) {
      existing.count++;
      existing.edgeTypes.add(edge.type);
    } else {
      pairMap.set(key, {
        sourceLayerId: a,
        targetLayerId: b,
        count: 1,
        edgeTypes: new Set([edge.type]),
      });
    }
  }

  return Array.from(pairMap.values()).map((p) => ({
    sourceLayerId: p.sourceLayerId,
    targetLayerId: p.targetLayerId,
    count: p.count,
    edgeTypes: Array.from(p.edgeTypes),
  }));
}

/**
 * Compute portal info for a given layer: which other layers are connected
 * and how many edges cross the boundary.
 * Accepts optional pre-computed aggregation to avoid redundant work.
 */
export function computePortals(
  graph: KnowledgeGraph,
  activeLayerId: string,
  precomputed?: LayerEdgeAggregation[],
): PortalInfo[] {
  const aggregated = precomputed ?? aggregateLayerEdges(graph);
  const layerNameMap = new Map(graph.layers.map((l) => [l.id, l.name]));

  const portalMap = new Map<string, number>();

  for (const agg of aggregated) {
    if (agg.sourceLayerId === activeLayerId) {
      portalMap.set(
        agg.targetLayerId,
        (portalMap.get(agg.targetLayerId) ?? 0) + agg.count,
      );
    } else if (agg.targetLayerId === activeLayerId) {
      portalMap.set(
        agg.sourceLayerId,
        (portalMap.get(agg.sourceLayerId) ?? 0) + agg.count,
      );
    }
  }

  return Array.from(portalMap.entries()).map(([layerId, count]) => ({
    layerId,
    layerName: layerNameMap.get(layerId) ?? layerId,
    connectionCount: count,
  }));
}

/**
 * For a given layer, find which file nodes in that layer connect to a
 * specific external layer. Returns the set of node IDs in activeLayer
 * that have edges crossing to targetLayerId.
 */
export function findCrossLayerFileNodes(
  graph: KnowledgeGraph,
  activeLayerId: string,
  targetLayerId: string,
): Set<string> {
  const activeNodeIds = new Set(
    graph.layers.find((l) => l.id === activeLayerId)?.nodeIds ?? [],
  );
  const targetNodeIds = new Set(
    graph.layers.find((l) => l.id === targetLayerId)?.nodeIds ?? [],
  );

  const result = new Set<string>();
  for (const edge of graph.edges) {
    if (activeNodeIds.has(edge.source) && targetNodeIds.has(edge.target)) {
      result.add(edge.source);
    }
    if (activeNodeIds.has(edge.target) && targetNodeIds.has(edge.source)) {
      result.add(edge.target);
    }
  }
  return result;
}

export interface AggregatedContainerEdge {
  sourceContainerId: string;
  targetContainerId: string;
  count: number;
  edgeTypes: string[];
}

export interface ContainerEdgeBuckets {
  intraContainer: GraphEdge[];
  interContainerAggregated: AggregatedContainerEdge[];
}

/**
 * Bucket edges into intra-container (preserved) and inter-container
 * (aggregated by directed (source,target) container pair).
 *
 * Direction is significant: A→B and B→A produce two independent
 * aggregated edges. Edges whose source or target has no entry in
 * `nodeToContainer` are silently dropped; callers that need a strict
 * mode should pre-filter.
 */
export function aggregateContainerEdges(
  edges: GraphEdge[],
  nodeToContainer: Map<string, string>,
): ContainerEdgeBuckets {
  const intra: GraphEdge[] = [];
  const interMap = new Map<
    string,
    {
      sourceContainerId: string;
      targetContainerId: string;
      count: number;
      edgeTypes: Set<string>;
    }
  >();

  for (const e of edges) {
    const sc = nodeToContainer.get(e.source);
    const tc = nodeToContainer.get(e.target);
    if (!sc || !tc) continue;
    if (sc === tc) {
      intra.push(e);
      continue;
    }
    const key = JSON.stringify([sc, tc]);
    const existing = interMap.get(key);
    if (existing) {
      existing.count++;
      existing.edgeTypes.add(e.type);
    } else {
      interMap.set(key, {
        sourceContainerId: sc,
        targetContainerId: tc,
        count: 1,
        edgeTypes: new Set([e.type]),
      });
    }
  }

  const interContainerAggregated: AggregatedContainerEdge[] = [...interMap.values()].map(
    (v) => ({
      sourceContainerId: v.sourceContainerId,
      targetContainerId: v.targetContainerId,
      count: v.count,
      edgeTypes: [...v.edgeTypes],
    }),
  );

  return { intraContainer: intra, interContainerAggregated };
}
