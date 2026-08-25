import { useCallback, useSyncExternalStore } from "react";
import type { Graph } from "@antv/x6";
import type { CanvasElementDTO } from "@reflecta/shared";
import { EMPTY_CANVAS_SHAPE_DATA, type CanvasShapeData } from "./shape-context";

/**
 * 单张图的卡片取数桥。
 *
 * react-shape 卡片只拿到 `{ node, graph }`（x6-react-shape 注入），渲染目的地由
 * `@antv/x6-react-shape` 的单例 portal 决定，可能落进任意 provider 子树——
 * 以前靠 per-graph React context 传 shapeData / 写回通道，于是「卡片落进谁的子树」
 * 就决定它读到谁的 context（多图并存时会被最后挂载的图抢走）。
 *
 * 本模块把取数改成「卡片从自己这张 graph 反查桥」：每家 CanvasGraph 建一个桥、
 * 挂到自己的 graph 上；卡片用注入的 graph 从桥拿展示数据 / 写回通道（useSyncExternalStore
 * 订阅）。数据不再依赖 React context 落点 → 「context 被抢」不复存在。
 */
export type CanvasBridgeSnapshot = {
  shapeData: CanvasShapeData;
  updateElement: (element: CanvasElementDTO) => void;
};

export type CanvasBridge = {
  publish: (snapshot: CanvasBridgeSnapshot) => void;
  get: () => CanvasBridgeSnapshot;
  subscribe: (listener: () => void) => () => void;
};

const EMPTY_SNAPSHOT: CanvasBridgeSnapshot = {
  shapeData: EMPTY_CANVAS_SHAPE_DATA,
  updateElement: () => undefined,
};

const NOOP_SUBSCRIBE = () => () => {};

const bridges = new WeakMap<Graph, CanvasBridge>();

export function createCanvasBridge(): CanvasBridge {
  let snapshot: CanvasBridgeSnapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<() => void>();
  return {
    publish(next) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function attachCanvasBridge(graph: Graph, bridge: CanvasBridge): void {
  bridges.set(graph, bridge);
}

export function detachCanvasBridge(graph: Graph): void {
  bridges.delete(graph);
}

export function getCanvasBridge(graph: Graph | undefined): CanvasBridge | undefined {
  return graph ? bridges.get(graph) : undefined;
}

/** 卡片取数 hook：graph 缺失 / 桥未就位时退回空快照，保证渲染不崩。 */
export function useCanvasBridge(graph: Graph | undefined): CanvasBridgeSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => {
      const bridge = getCanvasBridge(graph);
      if (!bridge) return NOOP_SUBSCRIBE();
      return bridge.subscribe(listener);
    },
    [graph],
  );
  const getSnapshot = useCallback(() => getCanvasBridge(graph)?.get() ?? EMPTY_SNAPSHOT, [graph]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
