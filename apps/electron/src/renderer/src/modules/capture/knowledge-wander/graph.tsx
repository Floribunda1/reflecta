import type { Graph as G6Graph, IElementEvent } from "@antv/g6";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraphData } from "./graph-data";
import { buildGraphSelectionStates } from "./graph-data";
import { readKnowledgeGraphTheme } from "./graph-theme";

function topologyKey(data: KnowledgeGraphData): string {
  return `${data.nodes.map(({ id }) => id).join("|")}::${data.edges.map(({ id }) => id).join("|")}`;
}

function titleKey(data: KnowledgeGraphData): string {
  return data.nodes.map(({ id, data: nodeData }) => `${id}:${nodeData.title}`).join("|");
}

export function KnowledgeGraph({
  data,
  selectedUnderstandingId,
  onSelect,
}: {
  data: KnowledgeGraphData;
  selectedUnderstandingId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<G6Graph | null>(null);
  const dataRef = useRef(data);
  const selectedRef = useRef(selectedUnderstandingId);
  const hoveredRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const graphTopologyKey = useMemo(() => topologyKey(data), [data]);
  const graphTitleKey = useMemo(() => titleKey(data), [data]);

  dataRef.current = data;
  selectedRef.current = selectedUnderstandingId;
  onSelectRef.current = onSelect;

  const applyElementStates = useCallback((graph: G6Graph) => {
    const focusId = hoveredRef.current ?? selectedRef.current;
    const states = buildGraphSelectionStates(dataRef.current, focusId);
    void graph.setElementState(states, false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let graph: G6Graph | null = null;
    let observer: ResizeObserver | null = null;
    setReady(false);
    setFailed(false);

    void import("@antv/g6")
      .then(async ({ Graph, GraphEvent, NodeEvent }) => {
        if (cancelled) return;
        const theme = readKnowledgeGraphTheme();

        graph = new Graph({
          container,
          autoResize: false,
          animation: false,
          data: dataRef.current,
          zoomRange: [0.1, 4],
          padding: 48,
          layout: {
            type: "d3-force",
            preLayout: false,
            animation: true,
            iterations: 300,
            manyBody: { strength: -80, distanceMax: 360 },
            link: { distance: 72, strength: 0.45, iterations: 1 },
            collide: { radius: 14, strength: 0.8, iterations: 1 },
            x: { strength: 0.025 },
            y: { strength: 0.025 },
          },
          behaviors: [
            "drag-canvas",
            { type: "zoom-canvas", animation: false },
            { type: "drag-element-force", fixed: true },
          ],
          node: {
            type: "circle",
            style: {
              size: 4.5,
              fill: theme.foreground,
              stroke: theme.foreground,
              lineWidth: 0,
              cursor: "pointer",
              labelText: (datum) => String(datum.data?.title ?? "未命名理解"),
              labelPlacement: "bottom",
              labelOffsetY: 5,
              labelFill: theme.foreground,
              labelFontSize: 12,
              labelFontWeight: 400,
              labelLineHeight: 16,
              labelTextAlign: "center",
              labelWordWrap: true,
              labelMaxWidth: 180,
              labelMaxLines: 1,
              labelTextOverflow: "ellipsis",
              labelOpacity: 1,
              halo: false,
            },
            state: {
              selected: {
                halo: false,
                lineWidth: 0,
                labelOpacity: 1,
                labelFontWeight: 500,
              },
              related: {
                opacity: 1,
                labelOpacity: 1,
              },
              dimmed: {
                opacity: 0.18,
                labelOpacity: 0.18,
              },
            },
          },
          edge: {
            type: "line",
            style: {
              stroke: theme.mutedForeground,
              lineWidth: 0.8,
              opacity: 0.3,
              halo: false,
            },
            state: {
              selected: {
                stroke: theme.foreground,
                lineWidth: 1,
                opacity: 0.72,
                halo: false,
              },
              dimmed: {
                opacity: 0.05,
                halo: false,
              },
            },
          },
        });

        graphRef.current = graph;
        graph.once(GraphEvent.AFTER_DRAW, () => {
          if (!cancelled) setReady(true);
        });
        graph.on(NodeEvent.CLICK, (event) => {
          onSelectRef.current(String((event as IElementEvent).target.id));
        });
        graph.on(NodeEvent.POINTER_ENTER, (event) => {
          hoveredRef.current = String((event as IElementEvent).target.id);
          if (graph) applyElementStates(graph);
        });
        graph.on(NodeEvent.POINTER_LEAVE, () => {
          hoveredRef.current = null;
          if (graph) applyElementStates(graph);
        });
        await graph.render();
        if (cancelled) return;
        await graph.fitView({ when: "always", direction: "both" }, false);

        observer = new ResizeObserver(() => {
          if (container.clientWidth > 0 && container.clientHeight > 0) graph?.resize();
        });
        observer.observe(container);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      graph?.destroy();
      if (graphRef.current === graph) graphRef.current = null;
    };
  }, [applyElementStates, graphTopologyKey, resolvedTheme]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.updateNodeData(
      data.nodes.map((node) => ({
        id: node.id,
        data: node.data,
      })),
    );
    void graph.draw().then(() => applyElementStates(graph));
  }, [applyElementStates, data.nodes, graphTitleKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph) applyElementStates(graph);
  }, [applyElementStates, selectedUnderstandingId]);

  return (
    <section
      data-testid="knowledge-wander-graph"
      className="relative h-full overflow-hidden bg-background"
    >
      <div ref={containerRef} className="h-full w-full" />
      <div className="sr-only" aria-label="图谱理解">
        {data.nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => onSelect(node.id)}>
            {node.data.title}
          </button>
        ))}
      </div>

      {!ready && !failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Skeleton className="size-24 rounded-full" />
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          图谱加载失败
        </div>
      ) : null}
    </section>
  );
}
