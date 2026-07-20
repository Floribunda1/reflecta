import {
  CanvasEvent,
  Graph,
  NodeEvent,
  type ElementDatum,
  type IPointerEvent,
  type NodeData,
} from "@antv/g6";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@renderer/components/ui/button";
import { ButtonGroup } from "@renderer/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";
import { buildGraphElementStates, type KnowledgeGraphData } from "./graph-data";

type KnowledgeGraphProps = {
  data: KnowledgeGraphData;
  selectedUnderstandingId: string | null;
  onSelect: (understandingId: string) => void;
};

type GraphColors = {
  foreground: string;
  mutedForeground: string;
  primary: string;
  border: string;
};

const FIT_VIEW_OPTIONS = { when: "overflow", direction: "both" } as const;

function readGraphColors(): GraphColors {
  const probe = document.createElement("div");
  probe.className = "pointer-events-none fixed invisible";

  const foreground = document.createElement("span");
  foreground.className = "text-foreground";
  const mutedForeground = document.createElement("span");
  mutedForeground.className = "text-muted-foreground";
  const primary = document.createElement("span");
  primary.className = "bg-primary";
  const border = document.createElement("span");
  border.className = "border border-border";

  probe.append(foreground, mutedForeground, primary, border);
  document.body.append(probe);

  const colors = {
    foreground: getComputedStyle(foreground).color,
    mutedForeground: getComputedStyle(mutedForeground).color,
    primary: getComputedStyle(primary).backgroundColor,
    border: getComputedStyle(border).borderTopColor,
  };
  probe.remove();
  return colors;
}

function getNodeDegree(node: NodeData): number {
  const degree = node.data?.degree;
  return typeof degree === "number" ? degree : 0;
}

function getNodeTitle(node: NodeData): string {
  const title = node.data?.title;
  return typeof title === "string" ? title : "";
}

function labelPriority(element: NodeData): number {
  const states = element.states ?? [];
  if (states.includes("hovered")) return 4;
  if (states.includes("selected")) return 3;
  if (states.includes("hover-neighbor")) return 2;
  if (states.includes("selected-neighbor")) return 2;
  return getNodeDegree(element);
}

function getTitleKey(data: KnowledgeGraphData): string {
  return data.nodes.map(({ id, data: { title } }) => `${id}:${title}`).join("|");
}

function getEventTargetId(event: IPointerEvent): string | null {
  return "id" in event.target ? String(event.target.id) : null;
}

async function syncFocus(
  graph: Graph,
  data: KnowledgeGraphData,
  selectedUnderstandingId: string | null,
  hoveredUnderstandingId: string | null,
) {
  await graph.setElementState(
    buildGraphElementStates(data, {
      selectedId: selectedUnderstandingId,
      hoveredId: hoveredUnderstandingId,
    }),
    false,
  );
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

export function KnowledgeGraph({ data, selectedUnderstandingId, onSelect }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const graphReadyRef = useRef(false);
  const dataRef = useRef(data);
  const selectedUnderstandingIdRef = useRef(selectedUnderstandingId);
  const hoveredUnderstandingIdRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const { resolvedTheme } = useTheme();

  dataRef.current = data;
  selectedUnderstandingIdRef.current = selectedUnderstandingId;
  onSelectRef.current = onSelect;

  const topologyKey = useMemo(
    () =>
      [data.nodes.map(({ id }) => id).join(","), data.edges.map(({ id }) => id).join(",")].join(
        "|",
      ),
    [data],
  );
  const titleKey = useMemo(() => getTitleKey(data), [data]);
  const renderedTitleKeyRef = useRef(titleKey);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = readGraphColors();
    const graph = new Graph({
      container,
      data: dataRef.current,
      animation: true,
      padding: 48,
      zoomRange: [0.2, 4],
      layout: {
        type: "d3-force",
        animation: true,
        iterations: 220,
        alphaDecay: 0.035,
        velocityDecay: 0.38,
        manyBody: {
          strength: -180,
          distanceMax: 720,
        },
        link: {
          distance: 128,
          strength: 0.26,
          iterations: 1,
        },
        collide: {
          radius: 20,
          strength: 0.82,
          iterations: 1,
        },
        x: { strength: 0.014 },
        y: { strength: 0.014 },
      },
      node: {
        type: "circle",
        style: {
          size: (node) => Math.min(10, 7 + Math.sqrt(getNodeDegree(node))),
          fill: colors.mutedForeground,
          stroke: "transparent",
          lineWidth: 6,
          opacity: 1,
          cursor: "pointer",
          label: true,
          labelText: getNodeTitle,
          labelPlacement: "bottom",
          labelOffsetY: 3,
          labelFill: colors.foreground,
          labelFontFamily: "ui-sans-serif, system-ui, sans-serif",
          labelFontSize: 9,
          labelFontWeight: 400,
          labelOpacity: 0.68,
          labelWordWrap: true,
          labelMaxWidth: 120,
          labelMaxLines: 1,
          labelTextOverflow: "...",
        },
        state: {
          hovered: {
            fill: colors.foreground,
            size: 10,
            opacity: 1,
            labelOpacity: 1,
            labelFontWeight: 500,
          },
          "hover-neighbor": {
            opacity: 0.9,
            labelOpacity: 0.82,
          },
          "hover-inactive": {
            opacity: 0.14,
            labelOpacity: 0.08,
          },
          selected: {
            fill: colors.primary,
            size: 10,
            opacity: 1,
            labelOpacity: 1,
            labelFontWeight: 500,
          },
          "selected-neighbor": {
            opacity: 0.9,
            labelOpacity: 0.82,
          },
          "selected-inactive": {
            opacity: 0.16,
            labelOpacity: 0.08,
          },
        },
      },
      edge: {
        type: "line",
        style: {
          stroke: colors.border,
          lineWidth: 0.6,
          opacity: 0.28,
        },
        state: {
          hovered: {
            stroke: colors.foreground,
            lineWidth: 1.2,
            opacity: 0.72,
          },
          "hover-neighbor": {
            stroke: colors.foreground,
            lineWidth: 1.2,
            opacity: 0.72,
          },
          "hover-inactive": { opacity: 0.06 },
          "selected-neighbor": {
            stroke: colors.primary,
            lineWidth: 1.15,
            opacity: 0.68,
          },
          "selected-inactive": { opacity: 0.06 },
        },
      },
      behaviors: [
        "drag-canvas",
        { type: "zoom-canvas", animation: false, sensitivity: 1 },
        {
          type: "drag-element-force",
          trigger: [],
          fixed: false,
          enable: (event: IPointerEvent) => event.targetType === "node",
        },
        {
          type: "auto-adapt-label",
          padding: 5,
          sort: (left: ElementDatum, right: ElementDatum) =>
            labelPriority(right as NodeData) - labelPriority(left as NodeData),
        },
      ],
    });

    graphRef.current = graph;
    graphReadyRef.current = false;
    container.dataset.graphReady = "false";
    hoveredUnderstandingIdRef.current = null;
    renderedTitleKeyRef.current = getTitleKey(dataRef.current);

    const applyFocus = () => {
      if (graphRef.current !== graph || !graphReadyRef.current) return;
      void syncFocus(
        graph,
        dataRef.current,
        selectedUnderstandingIdRef.current,
        hoveredUnderstandingIdRef.current,
      );
    };
    const previewNode = (event: IPointerEvent) => {
      hoveredUnderstandingIdRef.current = getEventTargetId(event);
      applyFocus();
    };
    const endNodePreview = (event: IPointerEvent) => {
      if (hoveredUnderstandingIdRef.current !== getEventTargetId(event)) return;
      hoveredUnderstandingIdRef.current = null;
      applyFocus();
    };
    const selectNode = (event: IPointerEvent) => {
      const id = getEventTargetId(event);
      if (!id) return;
      selectedUnderstandingIdRef.current = id;
      onSelectRef.current(id);
      applyFocus();
    };
    const keepSelection = () => {
      hoveredUnderstandingIdRef.current = null;
      applyFocus();
    };
    graph.on(NodeEvent.POINTER_ENTER, previewNode);
    graph.on(NodeEvent.POINTER_LEAVE, endNodePreview);
    graph.on(NodeEvent.CLICK, selectNode);
    graph.on(CanvasEvent.CLICK, keepSelection);

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      graph.resize(width, height);
    });
    resizeObserver.observe(container);

    void graph
      .render()
      .then(async () => {
        if (graphRef.current !== graph) return;
        graphReadyRef.current = true;
        await graph.fitView(FIT_VIEW_OPTIONS, { duration: 180 });
        if (graphRef.current !== graph) return;
        const currentTitleKey = getTitleKey(dataRef.current);
        if (renderedTitleKeyRef.current !== currentTitleKey) {
          graph.updateNodeData(
            dataRef.current.nodes.map(({ id, data: nodeData }) => ({ id, data: nodeData })),
          );
          await graph.draw();
          renderedTitleKeyRef.current = currentTitleKey;
        }
        await syncFocus(
          graph,
          dataRef.current,
          selectedUnderstandingIdRef.current,
          hoveredUnderstandingIdRef.current,
        );
        container.dataset.graphReady = "true";
      })
      .catch((error) => console.error("Failed to render knowledge graph", error));

    return () => {
      resizeObserver.disconnect();
      graph.off(NodeEvent.POINTER_ENTER, previewNode);
      graph.off(NodeEvent.POINTER_LEAVE, endNodePreview);
      graph.off(NodeEvent.CLICK, selectNode);
      graph.off(CanvasEvent.CLICK, keepSelection);
      graphReadyRef.current = false;
      delete container.dataset.graphReady;
      graphRef.current = null;
      graph.destroy();
    };
  }, [resolvedTheme, topologyKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !graphReadyRef.current || renderedTitleKeyRef.current === titleKey) return;
    renderedTitleKeyRef.current = titleKey;
    graph.updateNodeData(data.nodes.map(({ id, data }) => ({ id, data })));
    void graph.draw();
  }, [data.nodes, titleKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !graphReadyRef.current) return;
    void syncFocus(
      graph,
      dataRef.current,
      selectedUnderstandingId,
      hoveredUnderstandingIdRef.current,
    );
  }, [selectedUnderstandingId]);

  const withGraph = (action: (graph: Graph) => void) => {
    const graph = graphRef.current;
    if (graph) action(graph);
  };

  return (
    <div
      data-testid="knowledge-wander-graph"
      data-node-count={data.nodes.length}
      data-edge-count={data.edges.length}
      data-selected-understanding-id={selectedUnderstandingId ?? ""}
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
            onClick={() => onSelect(node.id)}
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
            onClick={() => withGraph((graph) => void graph.zoomBy(0.8, { duration: 120 }))}
          >
            <ZoomOut />
          </GraphControl>
          <GraphControl
            label="放大图谱"
            onClick={() => withGraph((graph) => void graph.zoomBy(1.25, { duration: 120 }))}
          >
            <ZoomIn />
          </GraphControl>
          <GraphControl
            label="适应画布"
            onClick={() =>
              withGraph((graph) => void graph.fitView(FIT_VIEW_OPTIONS, { duration: 180 }))
            }
          >
            <Maximize2 />
          </GraphControl>
        </ButtonGroup>
      </TooltipProvider>
    </div>
  );
}
