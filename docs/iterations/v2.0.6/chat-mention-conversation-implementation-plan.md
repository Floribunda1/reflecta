# Chat @ 对话 · 实现 Plan

> 日期：2026-09-04
>
> 状态：待用户确认后实施
>
> 范围：chat 域新增可 @ 的实体类型「对话」（conversation = AgentSession）。覆盖契约层、@ 面板、agent 只读工具、消息渲染/跳转、tool 活动 UI、Storybook。不涉及：会话进入检索（`retrieve_knowledge`）、insights recap、dashboard 统计、CLI。
>
> 依据：现有 @ 机制（understanding/context/domain/canvas）的「轻量目录 + 只读工具」模式；`docs/references/product/value-proposition.md`（「AI 对话」是 Context 的 `ai` medium 经历）；`docs/references/technical/storybook-principles.md`；`packages/ui/src/chat/tool.surface.test.ts` 的单向完整性校验。
>
> 测试设施（现状）：
>
> - `packages/ui`：vitest（`bun run test`），typecheck，`tool.surface.test.ts` 强制「每个 activity 工具都有 icon 映射 / 摘要桶 / Storybook 完成态 fixture」
> - Electron main：vitest（`bun run test:main`，`pi-readonly-tools.test.ts` / `pi-prompt.test.ts` 模式）
> - Electron renderer：vitest，storybook（`agent-compositions.stories.tsx`）
> - E2E：playwright + feature 文件（`bun run test:e2e:acceptance`）

---

## 目标与关键设计决策

在 chat 中 `@` 一个历史对话，使 agent 能读取该对话内容。读取形态复用现有「导出 Markdown」的渲染管线（`# title` + `## 用户 / ## Agent` + 正文），保证 token 有界、与导出同形、单一真源。

三个已定 / 待确认决策：

| #   | 决策                                                                                                                                                                                                                                     | 状态           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| D1  | 实体类型命名 `conversation`（wire type），wiki-link 前缀 `s`（`[[s:id]]`，复用现有 sessionId）。术语：UI 文案「对话」，避免与运行时 session 概念混淆                                                                                     | 已定           |
| D2  | `session_read` 读取形态 = 导出 Markdown 渲染管线；渲染函数从 renderer 迁到 main 侧共享，**导出与读取同形**                                                                                                                               | 已定           |
| D3  | 读取内容里**保留**实体引用原文（`[[u:id]]` 不替换为标题），使 agent 可回链调用 `understanding_get`；导出保持现状（面向人读替换为标题）。截断策略：最近 N 条消息 + 总字符上限（常量，默认建议 ~20k chars），读取输出携带 `truncated` 标记 | **待用户确认** |

## 依赖图

```
Phase 1 (契约) ──> Phase 2 (共享渲染 + 截断) ──> Phase 3 (session_read 工具)
      │                    │                           │
      └──> Phase 4 (@ 面板) ┘                           └──> Phase 6 (tool UI + Storybook)
      └──> Phase 5 (渲染/跳转) （Phase 5 依赖 Phase 1）
```

- 每 phase 独立可合并、可验证：phase 结束时测试全绿 + commit（Angular 约定）。
- 测试与实现同 phase 推进：核心逻辑（codec、渲染、截断）先写单测再实现；Storybook fixture 与 tool 注册同 phase（`tool.surface.test.ts` 会红灯兜底）。
- 契约分层：Phase 3 的 `session_read` 进入 `PI_READ_ONLY_TOOL_NAMES` 时，Phase 6 的 icon / 摘要桶 / fixture 必须同步，否则 `tool.surface.test.ts` 红灯——这是强制门禁，不是可选项。

---

## Phase 1 — 契约与类型（L0）

范围：为 conversation 打通 wire format 与双链解析。

- `packages/shared/src/agent/session.ts`：`AgentContextRef.type` literal 联合加 `"conversation"`（preload typings 纯 re-export，自动同步）。
- `packages/shared/src/app/entity-reference-codec.ts`（双链唯一解析实现）：加前缀 `s`（`entityTypeByPrefix` / `prefixByEntityType` / `ENTITY_REFERENCE_PATTERN` 及派生 pattern / `normalizeEntityReferenceEscapes`）。历史数据无会话链接，无需迁移。
- `packages/ui/src/chat/entity.ts`：`ChatEntityType` 加 `conversation`；`ChatEntityTypePresentation` 的 `canOpen` 语义不变（open → 跳线程）。

验收：

- codec 单测覆盖 `[[s:id]]` 扫描 / 收集 / 替换 / 转义归一化（沿用 `entity-reference-codec.test.ts` 的保护规则断言：围栏代码、行内代码、转义、链接 label）。
- typecheck / lint / 全部 test 绿。commit `feat(chat): add conversation entity type and wiki-link codec`.

---

## Phase 2 — 共享「会话 → Markdown」渲染 + 截断（核心，L2 前半）

范围：把 `exportThreadMarkdown`（`apps/electron/src/renderer/src/modules/chat/session/thread-action-menu-items.tsx`）的渲染逻辑迁到 main 侧纯函数，导出与 agent 读取共用；定义截断策略。

- 新增 main 侧共享函数（如 `apps/electron/src/main/services/agent/conversation-markdown.ts`）：输入 `AgentMessageProjection[]`（或事件日志），输出 Markdown + 元数据 `{ messageCount, charCount, truncated, keptMessageCount }`。
- 渲染规则与现状导出一致（`# title`、`## 用户/Agent`、trim、跳过空消息），但按 D3 保留 `[[u:id]]` 原文。
- 截断：最近 N 条消息优先 + 总字符上限（常量，ponytail 注释标记升级路径：需要摘要时再加 LLM 摘要管道）。
- renderer 导出路径改调共享函数（删除重复实现）。

验收：

- 单测覆盖：渲染形状、截断行为（超限时保留最近消息、`truncated` 标记）、与导出现状输出等价（除 D3 引用保留差异）。
- 导出功能回归可用（手测 + 现有测试绿）。commit `feat(chat): share conversation-to-markdown rendering with truncation`.

---

## Phase 3 — session_read 只读工具（L2 后半）

范围：agent 侧新增读取对话的能力。

- `packages/shared/src/agent/tools.ts`：`PI_READ_ONLY_TOOL_NAMES` 加 `session_read`，`PI_TOOL_LABELS` 加「读取对话」。
- `apps/electron/src/main/services/agent/pi-readonly-tools.ts`：注册 `session_read`（参数 `{ sessionId }`），经 `pi-session-log` 读会话事件并走 Phase 2 渲染，返回 `{ title, markdown, ...meta }`。会话不存在返回明确的 not-found 错误（沿用 tagged not-found 模式）。

验收：

- main 单测（`pi-readonly-tools.test.ts` 模式）：正常读取 / 会话不存在 / 截断标记。
- `pi-prompt.test.ts` 的 context type label 覆盖 conversation。
- **`tool.surface.test.ts` 此刻红灯是预期的**，Phase 6 补齐（先记录在 plan，不为此阻塞 Phase 3 合并？—— 否，按契约分层原则，Phase 3 与 Phase 6 同一 commit 不强制，但合并前必须全绿，见 Phase 6）。commit `feat(agent): add session_read read-only tool`.

---

## Phase 4 — @ 面板（L1）

范围：composer 输入侧可搜索/选中对话。

- `apps/electron/src/renderer/src/modules/chat/adapters/chat-composer-adapter.tsx`：`searchEntities` 加第 5 并行源——`chat.listThreads()`（已有 RPC）本地按标题过滤；无关键词时全量列出。
- `apps/electron/src/renderer/src/modules/chat/context/context-candidates.ts`：加 `conversation` 桶（subtitle：标题 + 更新时间，复用 `AgentSessionSummary`）+ type 筛选 + 混合排序计分。
- `packages/ui/src/chat/composer/context-picker.tsx`（`TYPE_TABS` / 空态文案）+ `chat-composer.tsx`（`ENTITY_TAB_ORDER`）：加「对话」tab。
- 编辑消息回填：`toEntity` 泛型覆盖，无额外改动。

验收：

- `context-candidates.test.ts` 覆盖 conversation 桶与排序。
- @ 面板手测：空关键词列出 / 按标题过滤 / tab 切换 / 已选中去重。commit `feat(chat): list and select conversations in mention picker`.

---

## Phase 5 — 消息渲染与跳转（L3）

范围：`[[s:id]]` 在消息内的解析、标题展示与打开动作。

- `apps/electron/src/renderer/src/modules/capture/queries.ts` `getEntityDisplay`：conversation 分支 → `chat.listThreads`（或单查 RPC）取标题。
- `apps/electron/src/renderer/src/modules/chat/adapters/chat-entity-adapter.tsx`：`typeLabel` 加「对话」；`canOpen` 加 conversation（打开 = 跳转该线程，复用现有线程导航）。
- `agent-turn-view.ts` / `chat-message-adapter.tsx`：catalog chip（「@ 了 X」）的 type label 覆盖。
- `onEntityOpen`：conversation 不走 inspector，走线程切换。

验收：

- 单测：entity label 解析 / canOpen。
- 手测：消息内 `[[s:id]]` 渲染为对话 chip，点击跳到对应线程；被删除会话显示「引用不可用」。commit `feat(chat): resolve and open conversation entity references`.

---

## Phase 6 — Tool 活动 UI + Storybook（L5/L6，测试强制）

范围：`session_read` 在活动区的展示形态 + Storybook 样本。**Phase 3 注册工具后，`tool.surface.test.ts` 红灯直到本 phase 完成**，故本 phase 与 Phase 3 之间不得 release。

- `apps/electron/src/renderer/src/modules/chat/execution/activity-presentation.ts`：`TOOL_ICON_KIND` 加 icon；`TOOL_BUCKET` 加摘要桶（不得落 other 兜底）。
- `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`：
  - `TOOL_DONE_SUMMARY` 加完成行（如「读取了对话「标题」」）。
  - `toolDetails()` 加专属详情视图（设计见下）。
- `packages/ui/src/chat/tool-fixtures.ts`：`completedTools` 加 `tool("session_read", { sessionId }, [...])` 完成态样本，输出体现真实形态（title + 消息数/字符数 + `truncated` 标记 + markdown 预览片段）——fixture 形态是 detailView 的输入契约。
- `packages/ui/src/chat/tool.stories.tsx`：ToolStory 加一行卡片；`agent-compositions.stories.tsx` 按 storybook-principles MECE 加组合场景（如「@ 对话 → 读取 → 回应」的完整 turn；成功 / 截断 / not-found 分 case）。

session_read 详情视图（建议，落地时以 fixture 契约为准）：

- 会话卡：标题 + 「N 条消息 · M 字符」
- **截断提示行**（`truncated` 时显式展示「读取了最近 N 轮」，避免用户误以为 agent 看到完整对话）
- Markdown 预览（复用 Markdown 渲染，`[[u:id]]` 自然渲染为可点击引用）
- 「打开对话」动作 → Phase 5 的跳转

验收：

- `tool.surface.test.ts` 全绿（icon / 摘要桶 / fixture 三者同步）。
- Storybook 各 case 手动过一遍（状态完备 + MECE）。commit `feat(chat): surface session_read activity and storybook fixtures`.

---

## 明确不做（本期范围外）

- 会话进检索（`retrieve_knowledge` 索引 conversation）——检索是知识图的事，@ 是显式引用。
- 会话 → Context（`ai` medium）沉淀联动——与 @ 正交，后续单独排期。
- CLI 的 @ 支持、insights recap / dashboard 统计——不触碰。

## 回归门禁

- 每 phase 结束：该域 vitest + typecheck + lint 全绿，commit（Angular 约定）。
- Phase 6 结束：`bun run test:e2e:acceptance` 冒烟（chat 套件），确认无回归。
- release 前按 `docs/references/technical/release-process.md` 走版本收口。

## 开放点

- D3 截断常量（N 条 / 字符上限）最终值，建议首版 `keptMessages ≈ 20` + `maxChars ≈ 20000`，待真实会话实测后调。
- 「读取全部 vs 最近 N 条」的用户预期：若用户 @ 一个长对话是为了问"那次聊了啥"，最近 N 条可能不够；首版以截断标记 + 详情预览兜底，后续按反馈决定是否加「AI 摘要」通道（d2 已预留姿势）。
