import { RefObject, useEffect, useRef, useState } from "react";
import { Graph, NodeEvent, CanvasEvent } from "@antv/g6";
import type { ElementDatum, GraphData, IElementEvent } from "@antv/g6";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { buildG6Data, getNeighborIds, type G6Data } from "./data";
import { resolveColors } from "./colors";

interface ContemplateCtx {
  selectedThoughtId: string | null;
  setSelectedThoughtId: (value: string | null) => void;
}

function styleNumber(datum: ElementDatum, key: string, fallback: number): number {
  const value = datum.style?.[key];
  return typeof value === "number" ? value : fallback;
}

function styleString(datum: ElementDatum, key: string, fallback: string): string {
  const value = datum.style?.[key];
  return typeof value === "string" ? value : fallback;
}

function isSameStructure(a: G6Data, b: G6Data): boolean {
  if (a.nodes.length !== b.nodes.length) return false;
  if (a.edges.length !== b.edges.length) return false;
  const aIds = new Set(a.nodes.map((n) => n.id));
  for (const n of b.nodes) if (!aIds.has(n.id)) return false;
  const aEdgeKeys = new Set(a.edges.map((e) => `${e.source}->${e.target}`));
  for (const e of b.edges) if (!aEdgeKeys.has(`${e.source}->${e.target}`)) return false;
  return true;
}

export function useGraphRenderer(
  containerRef: RefObject<HTMLDivElement | null>,
  ctx: ContemplateCtx,
  thoughts: ThoughtSummaryDTO[] | undefined,
  colorScheme?: string,
) {
  const graphRef = useRef<Graph | null>(null);
  const currentDataRef = useRef<G6Data>({ nodes: [], edges: [] });
  const nodeDataCacheRef = useRef(new Map<string, { title: string; body: string }>());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const selectedThoughtIdRef = useRef<string | null>(ctx.selectedThoughtId);

  useEffect(() => {
    selectedThoughtIdRef.current = ctx.selectedThoughtId;
  }, [ctx.selectedThoughtId]);

  const applyStates = (activeId: string | null) => {
    const graph = graphRef.current;
    const currentData = currentDataRef.current;
    if (!graph || !currentData.nodes.length) return;

    const neighbors = activeId ? getNeighborIds(activeId, currentData) : new Set<string>();
    const nodeStates: Record<string, string[]> = {};
    for (const n of currentData.nodes) {
      if (activeId) {
        if (n.id === activeId) nodeStates[n.id] = ["active"];
        else if (neighbors.has(n.id)) nodeStates[n.id] = ["neighbor"];
        else nodeStates[n.id] = ["inactive"];
      } else {
        nodeStates[n.id] = [];
      }
    }

    const edgeStates: Record<string, string[]> = {};
    for (const e of currentData.edges) {
      edgeStates[e.id] =
        activeId && e.source !== activeId && e.target !== activeId ? ["inactive"] : [];
    }
    graph.setElementState({ ...nodeStates, ...edgeStates }, false);
  };

  const syncData = async (items: ThoughtSummaryDTO[]) => {
    const graph = graphRef.current;
    if (!graph) return;
    const c = resolveColors();
    const nextData = buildG6Data(items, c);
    const nodeDataCache = nodeDataCacheRef.current;
    nodeDataCache.clear();
    for (const item of items) {
      nodeDataCache.set(item.id, { title: item.title ?? "", body: item.body ?? "" });
    }

    if (isSameStructure(currentDataRef.current, nextData)) {
      currentDataRef.current = nextData;
      graph.updateData({ nodes: nextData.nodes } as unknown as GraphData);
    } else {
      currentDataRef.current = nextData;
      const nodeCount = nextData.nodes.length;
      if (nodeCount > 0) {
        const radius = Math.max(nodeCount * 20, 150);
        nextData.nodes.forEach((node, i) => {
          node.style.x = Math.cos((2 * Math.PI * i) / nodeCount) * radius;
          node.style.y = Math.sin((2 * Math.PI * i) / nodeCount) * radius;
        });
      }
      graph.setData(nextData as unknown as GraphData);
      await graph.render();
    }

    const selectedId = selectedThoughtIdRef.current;
    if (selectedId && nextData.nodes.some((node) => node.id === selectedId)) {
      applyStates(selectedId);
    } else if (selectedId) {
      ctx.setSelectedThoughtId(null);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const c = resolveColors();

    const graph = new Graph({
      container,
      autoFit: "view",
      autoResize: true,
      padding: 96,
      animation: false,
      layout: {
        type: "force-atlas2",
        preventOverlap: true,
        nodeSize: 36,
        kr: 150,
        kg: 4,
        ks: 0.2,
        ksmax: 24,
        tao: 0.1,
        mode: "linlog",
        dissuadeHubs: false,
        barnesHut: false,
        prune: false,
        iterations: 300,
      },
      node: {
        style: {
          size: (d: ElementDatum) => styleNumber(d, "size", 20),
          fill: (d: ElementDatum) => styleString(d, "fill", c.ideaFill),
          stroke: (d: ElementDatum) => styleString(d, "stroke", c.ideaStroke),
          lineWidth: 2,
          labelText: (d: ElementDatum) => styleString(d, "labelText", ""),
          labelFill: c.labelColor,
          labelFontSize: 12.5,
          labelFontFamily: "Inter, -apple-system, sans-serif",
          labelPlacement: "bottom",
          labelOffsetY: 6,
          opacity: 1,
          shadowColor: "rgba(15,23,42,0.08)",
          shadowBlur: 8,
          shadowOffsetY: 3,
          cursor: "pointer",
        },
        state: {
          active: {
            stroke: c.selStroke,
            lineWidth: 3.5,
            shadowColor: c.selHalo,
            shadowBlur: 18,
            labelFill: c.activeLabelColor,
            labelFontWeight: 650,
          },
          neighbor: {
            labelFill: c.activeLabelColor,
            labelFontWeight: 560,
          },
          inactive: {
            fill: c.dimNodeColor,
            stroke: c.dimNodeColor,
            labelText: "",
            shadowBlur: 0,
            opacity: 0.26,
          },
        },
      },
      edge: {
        style: {
          stroke: c.edgeStroke,
          lineWidth: 1.25,
          opacity: 0.58,
          endArrow: true,
          endArrowSize: 5,
        },
        state: {
          inactive: {
            stroke: c.dimEdgeColor,
            opacity: 0.18,
          },
        },
      },
      plugins: [
        {
          type: "toolbar",
          key: "toolbar",
          position: "bottom-left",
          getItems: () => [
            { id: "zoom-in", value: "zoom-in", title: "放大" },
            { id: "zoom-out", value: "zoom-out", title: "缩小" },
            { id: "auto-fit", value: "auto-fit", title: "适配画布" },
            { id: "reset", value: "reset", title: "重置布局" },
          ],
          onClick: (value: string) => {
            switch (value) {
              case "zoom-in":
                graph.zoomBy(1.2);
                break;
              case "zoom-out":
                graph.zoomBy(0.8);
                break;
              case "auto-fit":
                graph.fitView();
                break;
              case "reset":
                graph.fitView();
                graph.zoomTo(1);
                break;
            }
          },
        },
      ],
      behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
    });

    graphRef.current = graph;

    graph.on(NodeEvent.CLICK, (evt: IElementEvent) => {
      const nodeId = evt.target.id;
      if (selectedThoughtIdRef.current === nodeId) {
        ctx.setSelectedThoughtId(null);
        applyStates(hoveredNodeId);
      } else {
        ctx.setSelectedThoughtId(nodeId);
        applyStates(nodeId);
      }
    });

    graph.on(CanvasEvent.CLICK, () => {
      if (selectedThoughtIdRef.current !== null) {
        ctx.setSelectedThoughtId(null);
        applyStates(hoveredNodeId);
      }
    });

    graph.on(NodeEvent.POINTER_ENTER, (evt: IElementEvent) => {
      setHoveredNodeId(evt.target.id);
      if (!selectedThoughtIdRef.current) applyStates(evt.target.id);
    });

    graph.on(NodeEvent.POINTER_LEAVE, (evt: IElementEvent) => {
      setHoveredNodeId((current) => {
        if (current !== evt.target.id) return current;
        if (!selectedThoughtIdRef.current) applyStates(null);
        return null;
      });
    });

    const onPointerMove = (event: PointerEvent) =>
      setCursorPos({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", onPointerMove);
    if (thoughts) void syncData(thoughts);

    return () => {
      graph.destroy();
      graphRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [containerRef, colorScheme]);

  useEffect(() => {
    if (!thoughts) return;
    void syncData(thoughts);
  }, [thoughts]);

  useEffect(() => {
    applyStates(ctx.selectedThoughtId ?? hoveredNodeId);
  }, [ctx.selectedThoughtId, hoveredNodeId]);

  return { hoveredNodeId, cursorPos, nodeDataCache: nodeDataCacheRef.current };
}
