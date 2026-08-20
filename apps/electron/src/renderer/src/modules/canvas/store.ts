import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { runAtom } from "@renderer/lib/atoms";
import type { CanvasDocument, CanvasViewport } from "@reflecta/ui/canvas";

/**
 * 画布文档 store（迁移到 Effect atoms）：React Flow 为交互 / 语义权威，本 store
 * 是其镜像数据源。
 *
 * - `document`：当前画布全量文档（元素 / 连线 id 零映射）；
 *   事件桥（React Flow 变更 → 回写）+ 外部失效双向维护；
 * - `viewport`：M1-5 恢复 / updateViewport 提交；
 * - `selection`：选中 cell id 集合，右侧面板 / 搜索消费；
 * - 撤销重做不属于当前 React Flow Core 集成。
 *
 * 状态以 `@effect/atom-react` atoms 承载，读写都经 `canvasRegistry`（模块级单例），
 * React（`RegistryProvider` 注入同一 registry）与命令式（`Atom.get/set`）共享一致状态。
 */

export type CanvasStoreState = {
  selectedCanvasId: string | null;
  document: CanvasDocument;
  viewport: CanvasViewport | null;
  selection: string[];
};

export type CanvasStoreActions = {
  /** 打开 / 关闭画布；切换时清空文档镜像与会话态 */
  selectCanvas: (canvasId: string | null) => void;
  /** 事件桥回写：React Flow 变更后的完整文档状态（防抖 saveCanvas 由上层负责） */
  setDocument: (document: CanvasDocument) => void;
  /** 视口变更 settle 后回写（updateViewport） */
  setViewport: (viewport: CanvasViewport) => void;
  setSelection: (cellIds: string[]) => void;
  reset: () => void;
};

export type CanvasStore = CanvasStoreState & CanvasStoreActions;

export const initialCanvasState: CanvasStoreState = {
  selectedCanvasId: null,
  document: { elements: [], edges: [] },
  viewport: null,
  selection: [],
};

/** 全局 store 的 atoms（React 经 `useAtom` / 命令式经 `canvasRegistry` 读写）。
 * `Atom.keepAlive`：即使无订阅者也保持挂载缓存——等同 zustand 模块单例的持久性，
 * 避免卸载后 idle TTL 自动 dispose 重置状态（zustand 的 `getState` 行为）。 */
export const selectedCanvasIdAtom: Atom.Writable<
  CanvasStoreState["selectedCanvasId"],
  CanvasStoreState["selectedCanvasId"]
> = Atom.keepAlive(Atom.make(initialCanvasState.selectedCanvasId));
export const documentAtom: Atom.Writable<CanvasDocument, CanvasDocument> = Atom.keepAlive(
  Atom.make(initialCanvasState.document),
);
export const viewportAtom: Atom.Writable<CanvasViewport | null, CanvasViewport | null> =
  Atom.keepAlive(Atom.make<CanvasViewport | null>(initialCanvasState.viewport));
export const selectionAtom: Atom.Writable<string[], string[]> = Atom.keepAlive(
  Atom.make(initialCanvasState.selection),
);

const runWith = <A, E>(effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>): A =>
  runAtom(effect);

const resetAll = Effect.gen(function* () {
  yield* Atom.set(selectedCanvasIdAtom, initialCanvasState.selectedCanvasId);
  yield* Atom.set(documentAtom, initialCanvasState.document);
  yield* Atom.set(viewportAtom, initialCanvasState.viewport);
  yield* Atom.set(selectionAtom, initialCanvasState.selection);
});

/** 全局 store 命令式 actions（对应旧 `useCanvasStore` 的 actions）。 */
export const canvasStoreActions: CanvasStoreActions = {
  selectCanvas: (canvasId) =>
    runWith(
      Effect.gen(function* () {
        yield* Atom.set(selectedCanvasIdAtom, canvasId);
        yield* Atom.set(documentAtom, initialCanvasState.document);
        yield* Atom.set(viewportAtom, initialCanvasState.viewport);
        yield* Atom.set(selectionAtom, initialCanvasState.selection);
      }),
    ),
  setDocument: (document) => runWith(Atom.set(documentAtom, document)),
  setViewport: (viewport) => runWith(Atom.set(viewportAtom, viewport)),
  setSelection: (cellIds) => runWith(Atom.set(selectionAtom, cellIds)),
  reset: () => runWith(resetAll),
};

/** 读全局 store 的单个字段（命令式 / getState 等价，与 React 共享 registry）。 */
export const readCanvasState = <A>(atom: Atom.Atom<A>): A => runWith(Atom.get(atom));

// 便于单测 / 多实例（e.g. 只读预览不共享交互态）。
// atoms 状态按 registry 隔离：每实例独立 registry + 独立 atom 定义。
export function createCanvasStore(initialState: CanvasStoreState = initialCanvasState) {
  const registry = AtomRegistry.make({});
  const sel = Atom.make<CanvasStoreState["selectedCanvasId"]>(initialState.selectedCanvasId);
  const doc = Atom.make<CanvasDocument>(initialState.document);
  const vp = Atom.make<CanvasViewport | null>(initialState.viewport);
  const selected = Atom.make<string[]>(initialState.selection);

  const run = <A, E>(effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>): A =>
    Effect.runSync(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));
  const read = <A>(atom: Atom.Atom<A>): A => run(Atom.get(atom));
  const write = <A>(atom: Atom.Writable<A, A>, value: A) => run(Atom.set(atom, value));

  const selectCanvas = (canvasId: string | null) =>
    run(
      Effect.gen(function* () {
        yield* Atom.set(sel, canvasId);
        yield* Atom.set(doc, initialState.document);
        yield* Atom.set(vp, initialState.viewport);
        yield* Atom.set(selected, initialState.selection);
      }),
    );

  const getState = (): CanvasStore => ({
    selectedCanvasId: read(sel),
    document: read(doc),
    viewport: read(vp),
    selection: read(selected),
    selectCanvas,
    setDocument: (document) => {
      write(doc, document);
    },
    setViewport: (viewport) => {
      write(vp, viewport);
    },
    setSelection: (cellIds) => {
      write(selected, cellIds);
    },
    reset: () => {
      run(
        Effect.gen(function* () {
          yield* Atom.set(sel, initialState.selectedCanvasId);
          yield* Atom.set(doc, initialState.document);
          yield* Atom.set(vp, initialState.viewport);
          yield* Atom.set(selected, initialState.selection);
        }),
      );
    },
  });

  return { getState };
}

export type CanvasStoreApi = ReturnType<typeof createCanvasStore>;
