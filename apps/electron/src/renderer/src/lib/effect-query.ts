import { createEffectQueryFromManagedRuntime } from "effect-query";
import { AppRuntime } from "./effect-runtime";

/**
 * Renderer 与 TanStack Query 的 Effect 接缝（D3：effect-query）。
 *
 * 用 AppRuntime 构造单个 `EffectQuery`，query/mutation 的 `queryFn`/`mutationFn`
 * 直接写 Effect 程序（在单一 runtime 上运行，typed error 经 `EffectQueryFailure`
 * 包一层、可用 `.match` 分发）。非 Effect 侧用 `useQuery(effectQuery.queryOptions(...))`
 * / `useMutation(effectQuery.mutationOptions(...))` 消费。
 */
export const effectQuery = createEffectQueryFromManagedRuntime(AppRuntime);
