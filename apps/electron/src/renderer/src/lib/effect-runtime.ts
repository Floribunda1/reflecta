import { Layer, ManagedRuntime } from "effect";

/**
 * Renderer 根 Effect runtime（P4-0）。
 *
 * LLMS 约定：从应用 Layer 构建**一个** runtime，供非 Effect 侧（React hooks、
 * queryFn、事件回调）调用程序。后续服务（P4-2 并发原语等）经 `AppLayer` 的
 * `Layer.provide` 汇入后重建 `AppRuntime`。
 *
 * 生命周期：renderer 应用常驻（app-lifetime），模块级创建即可；`ManagedRuntime`
 * 资源在进程存活期间保持，无需在 SPA 卸载时 dispose。
 */
export const AppLayer: Layer.Layer<never, never, never> = Layer.empty;

export const AppRuntime = ManagedRuntime.make(AppLayer);

/** 在非 Effect 侧跑一个 renderer 程序（Promise 形态）。 */
export const runPromise = AppRuntime.runPromise.bind(AppRuntime);
