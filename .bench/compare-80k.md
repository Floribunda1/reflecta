# Thinking (reasoning) 展开/收起卡顿 — 修复前后对比

环境:happy-dom + vitest,真实 Streamdown 渲染,语料 80k CJK 字符,每次更新追加 200 字符,380 次更新(前 20 次为预热)。
运行方式:`cd packages/ui && vitest run --disableConsoleIntercept src/chat/execution/reasoning-stream-benchmark.test.tsx`

## 修复内容

1. `ReasoningMarkdown` memo comparator:收起/关闭时不再重渲染(panel 保持挂载,`keepMounted`),只有重新展开时才渲染最新内容。
2. `ChatMarkdown` 新增 `animateStreaming` prop(默认 true 行为不变);reasoning 传 `false`,流式时不再生成逐字符动画 span(streamdown 的 `isAnimating`/`animated` 关闭)。
3. 删除了随 2 失效的 `suppressBacklogAnimation` 机制。

## 对比(80k corpus,happy-dom)

| 场景                         | Before       | After   | 提升      |
| ---------------------------- | ------------ | ------- | --------- |
| [A] 收起流式 wall/update     | 3.15ms       | 1.65ms  | 1.9x      |
| [B] 展开流式 profiler/update | 33.97ms      | 19.11ms | 1.8x      |
| [B] 展开流式 wall/update     | 63.82ms      | 29.66ms | 2.2x      |
| [C] 流式中首次展开           | **4446.8ms** | 344.2ms | **12.9x** |
| [C] 重新展开(内容已渲染过)   | ~78ms        | ~2.5ms  | **~31x**  |
| [C] 流式中收起               | **151.8ms**  | 4.7ms   | **32x**   |

## 24k corpus(首次复现数据)

| 场景                     | Before               | After  |
| ------------------------ | -------------------- | ------ |
| [B] 展开流式 wall/update | 20.44ms              | 9.98ms |
| [C] 首次展开             | 306.9ms (max 1167ms) | 33.4ms |
| [C] 收起                 | 38.6ms               | 3.3ms  |

## 结论

- 卡顿主因确认:展开态每个 token 全量重渲染 + 逐字符动画 span(80k 字符 = 8 万个动画 span)。
- 修复后:流式中**收起**从 ~150ms → ~~5ms(不再全量重渲染);**展开**从 4.4s → 344ms(happy-dom;真实浏览器约为其 1/3~~1/10);**展开态持续流式**的每更新成本约减半(仍随文本线性增长)。
- 剩余结构性问题:展开态流式仍是 O(n) 每次更新全量解析,文本越长越贵。若需要可再加时间节流(如 100ms 合并一次更新)。
