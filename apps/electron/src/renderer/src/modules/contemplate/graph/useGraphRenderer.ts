import { ref, watch, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import { Graph, NodeEvent, CanvasEvent } from "@antv/g6";
import type { GraphData } from "@antv/g6";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { buildG6Data, getNeighborIds, type G6Data } from "./data";
import { resolveColors } from "./colors";

interface ContemplateCtx {
  selectedThoughtId: Ref<string | null>;
}

export function useGraphRenderer(
  containerRef: Ref<HTMLDivElement | null>,
  ctx: ContemplateCtx,
  thoughts: Ref<ThoughtSummaryDTO[] | undefined>,
) {
  let graph: Graph | null = null;
  let currentData: G6Data = { nodes: [], edges: [] };

  const hoveredNodeId = ref<string | null>(null);
  const cursorPos = ref({ x: 0, y: 0 });
  const nodeDataCache = new Map<string, { title: string; body: string }>();

  // ── Highlight / dim logic via G6 element states ─────────────────────────────

  function applyStates(activeId: string | null) {
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
      if (activeId && e.source !== activeId && e.target !== activeId) {
        edgeStates[e.id] = ["inactive"];
      } else {
        edgeStates[e.id] = [];
      }
    }

    graph.setElementState({ ...nodeStates, ...edgeStates }, false);
  }

  // ── Data sync ────────────────────────────────────────────────────────────────

  function isSameStructure(a: G6Data, b: G6Data): boolean {
    if (a.nodes.length !== b.nodes.length) return false;
    if (a.edges.length !== b.edges.length) return false;
    const aIds = new Set(a.nodes.map((n) => n.id));
    for (const n of b.nodes) if (!aIds.has(n.id)) return false;
    const aEdgeKeys = new Set(a.edges.map((e) => `${e.source}->${e.target}`));
    for (const e of b.edges) if (!aEdgeKeys.has(`${e.source}->${e.target}`)) return false;
    return true;
  }

  async function syncData(items: ThoughtSummaryDTO[]) {
    if (!graph) return;
    const c = resolveColors();
    const nextData = buildG6Data(items, c);

    nodeDataCache.clear();
    for (const item of items) {
      nodeDataCache.set(item.id, { title: item.title ?? "", body: item.body ?? "" });
    }

    if (isSameStructure(currentData, nextData)) {
      // Only attributes changed (title/body/label) — update in-place without resetting layout.
      currentData = nextData;
      graph.updateData({ nodes: nextData.nodes } as unknown as GraphData);
    } else {
      // Structural change — rebuild with fresh initial positions.
      currentData = nextData;
      const nodeCount = currentData.nodes.length;
      if (nodeCount > 0) {
        const radius = Math.max(nodeCount * 20, 150);
        currentData.nodes.forEach((node, i) => {
          node.style.x = Math.cos((2 * Math.PI * i) / nodeCount) * radius;
          node.style.y = Math.sin((2 * Math.PI * i) / nodeCount) * radius;
        });
      }

      graph.setData(currentData as unknown as GraphData);
      await graph.render();
    }

    // Restore selection state after update/render
    const sel = ctx.selectedThoughtId.value;
    if (sel && currentData.nodes.some((n) => n.id === sel)) {
      applyStates(sel);
    } else {
      if (sel) ctx.selectedThoughtId.value = null;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  const onPointerMove = (e: PointerEvent) => {
    cursorPos.value = { x: e.clientX, y: e.clientY };
  };

  onMounted(async () => {
    if (!containerRef.value) return;
    const c = resolveColors();

    graph = new Graph({
      container: containerRef.value,
      autoFit: "view",
      autoResize: true,
      padding: 96,
      animation: false,

      // ── Layout ───────────────────────────────────────────────────────────
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

      // ── Node style ───────────────────────────────────────────────────────
      node: {
        style: {
          size: (d: any) => d.style?.size ?? 20,
          fill: (d: any) => d.style?.fill ?? c.ideaFill,
          stroke: (d: any) => d.style?.stroke ?? c.ideaStroke,
          lineWidth: 2,
          labelText: (d: any) => d.style?.labelText ?? "",
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

      // ── Edge style ───────────────────────────────────────────────────────
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

      // ── Toolbar ──────────────────────────────────────────────────────────
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
            if (!graph) return;
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

      // ── Behaviors ────────────────────────────────────────────────────────
      behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
    });

    // ── Events ─────────────────────────────────────────────────────────────

    graph.on(NodeEvent.CLICK, (evt: any) => {
      const nodeId = evt.target.id;
      if (ctx.selectedThoughtId.value === nodeId) {
        ctx.selectedThoughtId.value = null;
        applyStates(hoveredNodeId.value);
      } else {
        ctx.selectedThoughtId.value = nodeId;
        applyStates(nodeId);
      }
    });

    graph.on(CanvasEvent.CLICK, () => {
      if (ctx.selectedThoughtId.value !== null) {
        ctx.selectedThoughtId.value = null;
        applyStates(hoveredNodeId.value);
      }
    });

    graph.on(NodeEvent.POINTER_ENTER, (evt: any) => {
      hoveredNodeId.value = evt.target.id;
      if (!ctx.selectedThoughtId.value) applyStates(evt.target.id);
    });

    graph.on(NodeEvent.POINTER_LEAVE, (evt: any) => {
      // POINTER_ENTER on the next node fires before POINTER_LEAVE on the previous one.
      // Guard against clearing the state if hoveredNodeId has already moved on.
      if (hoveredNodeId.value !== evt.target.id) return;
      hoveredNodeId.value = null;
      if (!ctx.selectedThoughtId.value) applyStates(null);
    });

    if (thoughts.value) {
      await syncData(thoughts.value);
    }

    window.addEventListener("pointermove", onPointerMove);
  });

  onUnmounted(() => {
    graph?.destroy();
    graph = null;
    window.removeEventListener("pointermove", onPointerMove);
  });

  // ── Watchers ─────────────────────────────────────────────────────────────────

  watch(
    () => thoughts.value,
    (items) => {
      if (!items) return;
      syncData(items);
    },
  );

  watch(
    () => ctx.selectedThoughtId.value,
    (newId) => {
      applyStates(newId ?? hoveredNodeId.value);
    },
  );

  return { hoveredNodeId, cursorPos, nodeDataCache };
}
