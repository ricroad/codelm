import { useDashboardStore } from "../store";
import { useI18n } from "../contexts/I18nContext";

// Shared layer color palette — used by LayerLegend, LayerClusterNode, PortalNode, and GraphView
export const LAYER_PALETTE = [
  { bg: "rgba(0, 102, 204, 0.10)", border: "rgba(0, 102, 204, 0.36)", label: "#0066cc" },
  { bg: "rgba(48, 164, 108, 0.10)", border: "rgba(48, 164, 108, 0.36)", label: "#30a46c" },
  { bg: "rgba(142, 92, 247, 0.10)", border: "rgba(142, 92, 247, 0.36)", label: "#8e5cf7" },
  { bg: "rgba(193, 132, 1, 0.12)", border: "rgba(193, 132, 1, 0.36)", label: "#c18401" },
  { bg: "rgba(214, 64, 159, 0.10)", border: "rgba(214, 64, 159, 0.34)", label: "#d6409f" },
  { bg: "rgba(8, 145, 178, 0.10)", border: "rgba(8, 145, 178, 0.36)", label: "#0891b2" },
  { bg: "rgba(91, 91, 214, 0.10)", border: "rgba(91, 91, 214, 0.34)", label: "#5b5bd6" },
  { bg: "rgba(220, 104, 3, 0.10)", border: "rgba(220, 104, 3, 0.34)", label: "#dc6803" },
  { bg: "rgba(18, 165, 148, 0.10)", border: "rgba(18, 165, 148, 0.34)", label: "#12a594" },
  { bg: "rgba(100, 116, 139, 0.12)", border: "rgba(100, 116, 139, 0.34)", label: "#64748b" },
];

export function getLayerColor(index: number) {
  return LAYER_PALETTE[index % LAYER_PALETTE.length];
}

export default function LayerLegend() {
  const graph = useDashboardStore((s) => s.graph);
  const navigationLevel = useDashboardStore((s) => s.navigationLevel);
  const activeLayerId = useDashboardStore((s) => s.activeLayerId);
  const { t } = useI18n();

  const layers = graph?.layers ?? [];
  const hasLayers = layers.length > 0;

  if (!hasLayers) return null;

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-text-secondary whitespace-nowrap">
        {navigationLevel === "overview"
          ? `${layers.length} ${t.layer.label}`
          : activeLayer?.name ?? t.layer.defaultName}
      </span>

      <div className="flex items-center gap-3">
        {layers.map((layer, i) => {
          const color = getLayerColor(i);
          const isActive = navigationLevel === "layer-detail" && layer.id === activeLayerId;
          return (
            <div key={layer.id} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  backgroundColor: color.label,
                  opacity: navigationLevel === "layer-detail" && !isActive ? 0.3 : 1,
                }}
              />
              <span
                className={`text-[11px] ${
                  isActive ? "text-text-primary font-medium" : "text-text-secondary"
                }`}
                style={{
                  opacity: navigationLevel === "layer-detail" && !isActive ? 0.4 : 1,
                }}
              >
                {layer.name}
                <span className="text-text-muted ml-0.5">
                  ({layer.nodeIds.length})
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
