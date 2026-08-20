# Reflecta 前端性能 Benchmark

长任务的性能回归与手工基准。这是一个**独立 Playwright suite**（`project: benchmark`），**不进常规回归门禁**——因为 Electron 性能测量噪声大，放进 `test:e2e` 会让全量测试 flaky。按需跑、人工看报告。

## 设计原则

- **测「卡」不测「慢」**：用户感知的卡 = 主线程 Long Task（>50ms 阻塞帧）与交互到稳定的延迟。基准同时输出两者。
- **数据必须可控**：所有场景用 fixture 灌确定性大量数据（领域树 / 长对话），卡顿可复现。
- **默认只报告不阻塞**：预算 soft 判 2x，只在 `REFLECTA_BENCH_ENFORCE=1` 时当断言失败。见 `perf/budget.ts`。
- **复用现有 e2e infra**：fixture 写入层、launch / seed 全复用 acceptance，零重复。

## 运行

```bash
# 完整跑（会先 build）
bun run test:e2e:benchmark

# 不 build，直接跑已构建产物
bun run --cwd apps/electron bench:report

# 想 把超预算当失败（人工设门禁时）
REFLECTA_BENCH_ENFORCE=1 bun run test:e2e:benchmark
```

> 需要可显示窗口的机器（macOS 桌面环境）。无头 CI 上 Electron 起不了窗口，本 suite 不适合无头跑。

## 场景

| 文件                                  | 场景                                                                | 指标                              |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `scenarios/domain-switch.spec.ts`     | 点击切换 domain（selectedDomainId → refetch → 网格重渲染）          | 交互延迟 + long task              |
| `scenarios/route-switch.spec.ts`      | 切路由（capture ⇆ agent），当前静态 import 无代码分割，mount 即执行 | 导航到可交互 + long task          |
| `scenarios/long-conversation.spec.ts` | 长会话：打开线程 / 虚拟列表滚动 / 轮次跳转面板展开收起              | 加载延迟 + 滚动帧 p95 + long task |

三个子场景都灌了 `TURNS=120`（240 条消息）的长对话。domain 场景灌 12 领域 × 30 understanding。

## 指标定义（`perf/perf-utils.ts`）

- **elapsedMs**：交互前后在 renderer 打 `performance.now()`，到稳定（settle）的墙钟差。含 fetch 等待与渲染。
- **longtask**：`PerformanceObserver` 采集 `longtask` 条目（>50ms 主线程阻塞），只统计「drain 后新增」。
- **帧间隔（滚动）**：`requestAnimationFrame` 采样相邻帧间隔；`p95Ms` 越接近 50ms 越接近掉帧。

## 噪音控制

- 首采样当 warmup，取后 3 次（median / 明细）。
- 预算判 2x（count / total）或中位数上界（elapsed）。
- 单 worker + 长 timeout，避免并发抢占影响计时。
- `settle()` 让出主线程后再读数，避免半程渲染带偏。

## 诊断模式（找「为什么卡」，非回归）

基准定位「有多卡」；诊断定位「卡在哪」。当显示可用时：

1. 在 `harness.ts` 里对目标场景开 Chromium trace：
   ```ts
   const cdp = await page.context().newCDPSession(page);
   await cdp.send("Tracing.start", { categories: ["-*", "devtools.timeline", "v8.execute", ...] });
   // ... 执行交互 ...
   const { value } = await cdp.send("Tracing.end");
   // 写 .json 拖进 devtools Performance / edge://tracing 看火焰图
   ```
2. 或在 Playwright 运行加 `--trace on`，拿 `.zip` trace 里的 `network`/`snapshot` 定位数据 waterfall 与渲染。

常见根因参考（来自代码阅读，需用 trace 验证）：

- 路由切换卡：router 静态 import（无代码分割）+ 目标页 mount 时并发 refetch（React Query waterfall）+ Effect RPC 往返。
- domain 切换卡：`prefsAtom.selectedDomainId` 变化 → `useCaptureUnderstandingList` refetch → 卡片网格与相关性树重渲染；`elapsedMs` 里 fetch 与重渲染叠加。
- 长会话滚动：虚拟列表 `measureElement` 动态测量 + `useAnimationFrameWithResizeObserver`。`maxMs`/`p95Ms` 反映该项。

## 待补（需真实模型）

- 「运行（追加渲染）」：当前用「轮次跳转展开」作交互渲染代理；真实流式回包路径的 bench 需接 model 后补（在 `long-conversation.spec.ts` 扩展）。
