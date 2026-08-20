import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { KeyValueStore } from "effect/unstable/persistence";

/**
 * 全 renderer 共享的 atom registry（P4-1）。
 *
 * React（`RegistryContext.Provider`）与命令式读写必须用**同一个** registry，
 * 否则 `useAtomValue` 与 store actions 各读各的状态会不一致。所有 store 模块的
 * 命令式读写、以及应用的 `RegistryProvider` 都引用这里。
 */
export const appAtomRegistry = AtomRegistry.make({});

/**
 * `Atom.kvs`（持久化 atom）共用的 KeyValueStore runtime，底层落盘到 `localStorage`。
 * 单一实例复用，避免每个持久化 atom 各建一个 KV store。
 */
export const kvsRuntime = Atom.runtime(KeyValueStore.layerStorage(() => window.localStorage));

/** 在共享 registry 上跑一个 atom Effect（命令式读/写，与 React 一致）。 */
export const runAtom = <A, E>(effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>): A =>
  Effect.runSync(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, appAtomRegistry)));
