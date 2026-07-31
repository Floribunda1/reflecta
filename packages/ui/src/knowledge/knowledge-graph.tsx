import { MultiUndirectedGraph } from "graphology";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
import Sigma from "sigma";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";
import { Button } from "../components/button";
import { ButtonGroup } from "../components/button-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import { buildGraphElementStates, type KnowledgeGraphData } from "./knowledge-graph-state";

export type KnowledgeGraphProps = {
  data: KnowledgeGraphData;
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
};

type GraphNodeAttributes = {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  degree: number;
  fixed?: boolean;
};

type GraphEdgeAttributes = {
  size: number;
  color: string;
};

type GraphModel = MultiUndirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>;
type GraphRenderer = Sigma<GraphNodeAttributes, GraphEdgeAttributes>;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LAYOUT_DURATION_MS = 1_400;
const DRAG_LAYOUT_DURATION_MS = 800;

const GRAPH_PALETTES = {
  light: {
    foreground: "#1c1917",
    node: "#78716c",
    neighbor: "#44403c",
    inactiveNode: "#d6d3d1",
    edge: "#d6d3d1",
    inactiveEdge: "#f5f5f4",
  },
  dark: {
    foreground: "#fafaf9",
    node: "#a8a29e",
    neighbor: "#d6d3d1",
    inactiveNode: "#44403c",
    edge: "#57534e",
    inactiveEdge: "#292524",
  },
} as const;

type GraphPalette = (typeof GRAPH_PALETTES)[keyof typeof GRAPH_PALETTES];

function getNodeSize(degree: number): number {
  return Math.min(10, 5 + Math.sqrt(Math.max(0, degree)));
}

function buildGraph(data: KnowledgeGraphData, palette: GraphPalette): GraphModel {
  const graph = new MultiUndirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
  const radius = Math.max(1, Math.sqrt(data.nodes.length));

  data.nodes.forEach((node, index) => {
    const angle = index * GOLDEN_ANGLE;
    const distance = radius * Math.sqrt((index + 1) / data.nodes.length);
    graph.addNode(node.id, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: getNodeSize(node.data.degree),
      label: node.data.title,
      color: palette.node,
      degree: node.data.degree,
    });
  });

  for (const edge of data.edges) {
    graph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, {
      size: 0.8,
      color: palette.edge,
    });
  }

  return graph;
}

function getTitleKey(data: KnowledgeGraphData): string {
  return data.nodes.map(({ id, data: { title } }) => `${id}:${title}`).join("|");
}

function reduceNode(
  node: string,
  attributes: GraphNodeAttributes,
  states: Record<string, string[]>,
  palette: GraphPalette,
): Partial<NodeDisplayData> {
  const nodeStates = states[node] ?? [];
  if (nodeStates.includes("selected") || nodeStates.includes("hovered")) {
    return {
      ...attributes,
      color: palette.foreground,
      forceLabel: true,
      size: attributes.size * 1.5,
      zIndex: 2,
    };
  }
  if (nodeStates.includes("selected-neighbor") || nodeStates.includes("hover-neighbor")) {
    return {
      ...attributes,
      color: palette.neighbor,
      forceLabel: true,
      size: attributes.size * 1.12,
      zIndex: 1,
    };
  }
  if (nodeStates.includes("selected-inactive") || nodeStates.includes("hover-inactive")) {
    return { ...attributes, color: palette.inactiveNode, label: null };
  }
  return {
    ...attributes,
    color: palette.node,
    forceLabel: false,
    size: attributes.size,
    zIndex: 0,
  };
}

function reduceEdge(
  edge: string,
  attributes: GraphEdgeAttributes,
  states: Record<string, string[]>,
  palette: GraphPalette,
): Partial<EdgeDisplayData> {
  const edgeStates = states[edge] ?? [];
  if (edgeStates.includes("selected-neighbor") || edgeStates.includes("hover-neighbor")) {
    return { ...attributes, color: palette.foreground, size: 1.3, zIndex: 1 };
  }
  if (edgeStates.includes("selected-inactive") || edgeStates.includes("hover-inactive")) {
    return { ...attributes, color: palette.inactiveEdge, size: 0.5 };
  }
  return { ...attributes, color: palette.edge, size: attributes.size, zIndex: 0 };
}

function GraphControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={label}
            onClick={onClick}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function KnowledgeGraph({ data, selectedId, onSelectionChange }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const graphRef = useRef<GraphModel | null>(null);
  const layoutTimerRef = useRef<number | null>(null);
  const focusStatesRef = useRef<Record<string, string[]>>({});
  const dataRef = useRef(data);
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef = useRef<string | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const { forcedTheme, resolvedTheme } = useTheme();
  const graphTheme = forcedTheme ?? resolvedTheme;

  dataRef.current = data;
  selectedIdRef.current = selectedId;
  onSelectionChangeRef.current = onSelectionChange;

  const topologyKey = useMemo(
    () =>
      [
        data.nodes.map(({ id }) => id).join(","),
        data.edges.map(({ id, source, target }) => `${id}:${source}:${target}`).join(","),
      ].join("|"),
    [data],
  );
  const titleKey = useMemo(() => getTitleKey(data), [data]);
  const renderedTitleKeyRef = useRef(titleKey);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = graphTheme === "dark" ? GRAPH_PALETTES.dark : GRAPH_PALETTES.light;
    const graph = buildGraph(dataRef.current, palette);
    focusStatesRef.current = buildGraphElementStates(dataRef.current, {
      selectedId: selectedIdRef.current,
      hoveredId: hoveredIdRef.current,
    });

    const renderer = new Sigma(graph, container, {
      defaultNodeColor: palette.node,
      defaultEdgeColor: palette.edge,
      defaultDrawNodeHover: () => undefined,
      hideLabelsOnMove: true,
      labelColor: { color: palette.foreground },
      labelDensity: 0.72,
      labelFont: "ui-sans-serif, system-ui, sans-serif",
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: 5.5,
      labelSize: 11,
      labelWeight: "400",
      maxCameraRatio: 8,
      minCameraRatio: 0.08,
      minEdgeThickness: 0.6,
      nodeReducer: (node, attributes) =>
        reduceNode(node, attributes, focusStatesRef.current, palette),
      edgeReducer: (edge, attributes) =>
        reduceEdge(edge, attributes, focusStatesRef.current, palette),
      stagePadding: 56,
      zIndex: true,
      zoomDuration: 120,
    });
    const layout = new FA2Layout(graph, {
      settings: {
        adjustSizes: true,
        barnesHutOptimize: graph.order >= 100,
        gravity: 0.06,
        linLogMode: true,
        scalingRatio: 12,
        slowDown: 5,
        strongGravityMode: true,
      },
    });

    rendererRef.current = renderer;
    graphRef.current = graph;
    container.dataset.graphReady = "false";
    hoveredIdRef.current = null;
    renderedTitleKeyRef.current = getTitleKey(dataRef.current);

    let pinnedNode: string | null = null;
    const stopLayout = () => {
      layout.stop();
      layoutTimerRef.current = null;
      if (pinnedNode) {
        graph.removeNodeAttribute(pinnedNode, "fixed");
        pinnedNode = null;
      }
      renderer.setCustomBBox(renderer.getBBox());
      renderer.refresh();
      container.dataset.graphReady = "true";
    };
    const startLayout = (duration: number) => {
      if (layoutTimerRef.current !== null) window.clearTimeout(layoutTimerRef.current);
      renderer.setCustomBBox(null);
      layout.start();
      container.dataset.graphReady = "false";
      layoutTimerRef.current = window.setTimeout(stopLayout, duration);
    };
    const applyFocus = () => {
      focusStatesRef.current = buildGraphElementStates(dataRef.current, {
        selectedId: selectedIdRef.current,
        hoveredId: hoveredIdRef.current,
      });
      renderer.scheduleRefresh();
    };
    const previewNode = ({ node }: { node: string }) => {
      hoveredIdRef.current = node;
      container.style.cursor = "pointer";
      applyFocus();
    };
    const endNodePreview = ({ node }: { node: string }) => {
      if (hoveredIdRef.current !== node) return;
      hoveredIdRef.current = null;
      container.style.cursor = "";
      applyFocus();
    };
    const selectNode = ({ node }: { node: string }) => {
      selectedIdRef.current = node;
      onSelectionChangeRef.current(node);
      applyFocus();
    };
    const clearSelection = () => {
      hoveredIdRef.current = null;
      selectedIdRef.current = null;
      onSelectionChangeRef.current(null);
      applyFocus();
    };

    let draggedNode: string | null = null;
    const mouseCaptor = renderer.getMouseCaptor();
    const startNodeDrag = ({
      node,
      event,
    }: {
      node: string;
      event: { preventSigmaDefault(): void };
    }) => {
      event.preventSigmaDefault();
      if (layoutTimerRef.current !== null) window.clearTimeout(layoutTimerRef.current);
      layoutTimerRef.current = null;
      layout.stop();
      if (pinnedNode) {
        graph.removeNodeAttribute(pinnedNode, "fixed");
        pinnedNode = null;
      }
      draggedNode = node;
      container.style.cursor = "grabbing";
      renderer.getCamera().disable();
    };
    const moveNode = (event: { x: number; y: number; preventSigmaDefault(): void }) => {
      if (!draggedNode) return;
      event.preventSigmaDefault();
      const position = renderer.viewportToGraph(event);
      graph.mergeNodeAttributes(draggedNode, position);
    };
    const endNodeDrag = () => {
      if (!draggedNode) return;
      graph.setNodeAttribute(draggedNode, "fixed", true);
      pinnedNode = draggedNode;
      draggedNode = null;
      container.style.cursor = "";
      renderer.getCamera().enable();
      startLayout(DRAG_LAYOUT_DURATION_MS);
    };

    renderer.on("enterNode", previewNode);
    renderer.on("leaveNode", endNodePreview);
    renderer.on("clickNode", selectNode);
    renderer.on("clickStage", clearSelection);
    renderer.on("downNode", startNodeDrag);
    mouseCaptor.on("mousemovebody", moveNode);
    mouseCaptor.on("mouseup", endNodeDrag);

    const resizeObserver = new ResizeObserver(() => {
      if (container.offsetWidth && container.offsetHeight) renderer.scheduleRender();
    });
    resizeObserver.observe(container);
    startLayout(LAYOUT_DURATION_MS);

    return () => {
      resizeObserver.disconnect();
      if (layoutTimerRef.current !== null) window.clearTimeout(layoutTimerRef.current);
      layoutTimerRef.current = null;
      layout.kill();
      renderer.kill();
      delete container.dataset.graphReady;
      container.style.cursor = "";
      rendererRef.current = null;
      graphRef.current = null;
    };
  }, [graphTheme, topologyKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || renderedTitleKeyRef.current === titleKey) return;

    const titles = new Map(data.nodes.map((node) => [node.id, node.data.title]));
    graph.updateEachNodeAttributes(
      (node, attributes) => ({ ...attributes, label: titles.get(node) ?? attributes.label }),
      { attributes: ["label"] },
    );
    renderedTitleKeyRef.current = titleKey;
  }, [data.nodes, titleKey]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    focusStatesRef.current = buildGraphElementStates(dataRef.current, {
      selectedId,
      hoveredId: hoveredIdRef.current,
    });
    renderer.scheduleRefresh();
  }, [selectedId]);

  if (data.nodes.length === 0) {
    return (
      <div
        data-testid="knowledge-wander-graph"
        data-node-count="0"
        data-edge-count="0"
        className="flex h-full min-h-64 w-full items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground"
        role="application"
        aria-label="知识漫步图谱"
      >
        还没有可展示的 Understanding 关系
      </div>
    );
  }

  const withRenderer = (action: (renderer: GraphRenderer) => void) => {
    const renderer = rendererRef.current;
    if (renderer) action(renderer);
  };

  return (
    <div
      data-testid="knowledge-wander-graph"
      data-node-count={data.nodes.length}
      data-edge-count={data.edges.length}
      data-selected-understanding-id={selectedId ?? ""}
      className="relative h-full min-h-0 w-full overflow-hidden bg-background"
      role="application"
      aria-label="知识漫步图谱"
    >
      <div ref={containerRef} className="absolute inset-0" />

      <div className="sr-only" aria-label="图谱节点">
        {data.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            data-node-id={node.id}
            data-node-degree={node.data.degree}
            onClick={() => onSelectionChange(node.id)}
          >
            打开理解：{node.data.title}
          </button>
        ))}
      </div>

      <TooltipProvider>
        <ButtonGroup
          orientation="vertical"
          className="absolute bottom-4 left-4 z-10 rounded-md shadow-xs"
        >
          <GraphControl
            label="缩小图谱"
            onClick={() =>
              withRenderer((renderer) => {
                void renderer.getCamera().animatedUnzoom({ duration: 120, factor: 1.25 });
              })
            }
          >
            <ZoomOut />
          </GraphControl>
          <GraphControl
            label="放大图谱"
            onClick={() =>
              withRenderer((renderer) => {
                void renderer.getCamera().animatedZoom({ duration: 120, factor: 1.25 });
              })
            }
          >
            <ZoomIn />
          </GraphControl>
          <GraphControl
            label="适应画布"
            onClick={() =>
              withRenderer((renderer) => {
                void renderer.getCamera().animatedReset({ duration: 180 });
              })
            }
          >
            <Maximize2 />
          </GraphControl>
        </ButtonGroup>
      </TooltipProvider>
    </div>
  );
}
