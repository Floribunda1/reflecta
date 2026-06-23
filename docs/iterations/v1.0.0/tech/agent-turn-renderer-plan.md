# Agent Turn Renderer Implementation Plan

> 状态：Draft
>
> 日期：2026-06-18
>
> 目标：修正 Reflecta Agent Chat 的核心渲染模型，让 thinking、tool activity、assistant text、proposal、evidence 按一个 assistant turn 的真实顺序呈现，而不是把文本和工具日志拆开堆放。
>
> 上游文档：
>
> - `docs/iterations/v1.0.0/product/agent-product-taste-requirements.md`
> - `docs/iterations/v1.0.0/product/agent-ux-gap-analysis.md`
> - `CONTEXT.md`

## 1. Problem

当前 `apps/electron/src/renderer/src/modules/chat/index.tsx` 的 message rendering 是：

```ts
const text = messageText(message);
const toolParts = message.parts.filter((part) => isToolUIPart(part));
```

然后先渲染合并后的 text，再渲染所有 tool parts。

这个实现会稳定地产生错误体验：

- Tool 永远被统一放到 assistant 回答底部。
- `tool -> text -> tool -> text` 的真实顺序丢失。
- 连续 tool 不能折叠成一个工作阶段。
- Thinking / activity 只能变成 `...` 或缺失。
- Proposal card 容易变成回答后的附属日志，而不是 turn 中的行动请求。
- Evidence 无法和 Agent 实际读取过程建立关系。

这不是卡片样式问题，是 Turn Renderer 错了。

## 2. Requirements

### R1. Ordered Agent Turn

Assistant message 必须按 `message.parts` 顺序渲染。

验收：

- 如果 parts 顺序是 `tool -> text -> tool -> text`，UI 也必须按这个顺序展示。
- 不再把所有 text 合并到一个块里。
- 不再把所有 tool 统一挪到底部。

### R2. Tool Activity Grouping

相邻的只读 tool 必须按语义折叠为 Tool Activity Group。

验收：

- 连续多个 search/read tool 默认显示为一个 `查找相关内容` group。
- 连续 graph tool 默认显示为一个 `查看关联` group。
- 中间出现 assistant text 后，新的 tool activity 另起一组。
- group 可展开/收起。
- 默认摘要不显示内部 tool name。

### R3. Thinking Summary

Agent running 但还没有可见正文时，必须显示 Thinking Summary。

验收：

- 首 token 前不显示空白或单独 `...`。
- tool running 时显示当前 activity。
- turn 完成后 thinking 默认折叠成 summary。
- 展开内容是过程摘要，不是 raw chain-of-thought。

### R4. Proposal Position And Control

Proposal card 必须作为 ordered parts 中的 block 渲染，不能作为底部 tool log。

验收：

- Proposal 出现在它被提出的位置。
- Proposal card 显示 `确认 / 拒绝 / 忽略`。
- `确认` 写入。
- `拒绝` 不写入，并把下一步交给 AI。
- `忽略` 不写入，并让 Agent 停住等待用户输入。
- 不提供手动编辑 proposal 字段。

### R5. Evidence Footer

Assistant turn 完成后，显示本轮实际读取过的 evidence。

验收：

- Evidence 只来自实际 tool output 中读取到的 Understanding / Context / Domain。
- 用户手动 `@` 但 Agent 没读取的对象不能算 evidence。
- evidence chips 可点击跳转。
- 太多 evidence 折叠为 `+N`。

### R6. Recovery

错误和停止状态必须就地呈现。

验收：

- stream error 保留 partial result。
- tool error 留在对应 Tool Activity Group 内。
- stop 显示为 `已停止`，不是 error。
- retry / continue 入口靠近出错或停止的位置。

## 3. Non-Goals

- 不引入右侧 Inspector。
- 不做 prompt preset。
- 不展示 raw chain-of-thought。
- 不默认展示 raw JSON。
- 不整体迁移到 assistant-ui。
- 不引入新的 agent workflow engine。
- 不做 e2e 测试，先用 renderer unit tests 和手动运行验收覆盖核心路径。

## 4. Libraries And Existing Building Blocks

优先用现有成熟能力：

- AI SDK / `@ai-sdk/react`：继续使用 `useChat` 和 `UIMessage.parts`。
- `streamdown`：继续负责 streaming markdown。
- shadcn/cmdk：继续负责 `@` picker。
- shadcn/Radix Collapsible：用于 Thinking Summary 和 Tool Activity Group 的展开/收起。
- lucide-react：用于 activity 状态图标。

暂不引入 assistant-ui：

- 当前项目已经有 AI SDK message parts 和 shadcn/Radix primitives。
- 这次核心缺陷是本地 renderer 把 parts 拆错了，不需要为了修正 ordered rendering 引入一套完整 chat UI runtime。
- 如果后续要重做 Thread / Composer / Message primitives，再评估 assistant-ui 整体迁移。

## 5. Proposed Design

### 5.1 Normalize Parts Into Turn Blocks

新增纯函数模块：

```text
apps/electron/src/renderer/src/modules/chat/turn-blocks.ts
```

核心类型：

```ts
type AgentTurnBlock =
  | { kind: "text"; text: string }
  | { kind: "thinking"; status: "running" | "done" | "stopped" | "error"; summary: string }
  | {
      kind: "tool-group";
      groupType: "lookup" | "graph" | "proposal" | "other";
      parts: AgentToolPart[];
    }
  | { kind: "proposal"; part: AgentToolPart; proposalType: ProposalType }
  | { kind: "evidence"; refs: AgentContextRef[] };
```

Rules:

- Iterate `message.parts` once, in order.
- Adjacent text parts can merge only when no tool/reasoning/proposal part sits between them.
- Adjacent read/search tool parts become one `tool-group`.
- Proposal tool parts become `proposal` blocks.
- Unknown tool parts become `tool-group` with `groupType: "other"`.
- Evidence is derived after block creation from completed read tool outputs.

Keep this function pure and tested. This is the smallest check that prevents regression back to bottom-stacked tools.

### 5.2 Message Renderer

新增 renderer component area inside chat module:

```text
apps/electron/src/renderer/src/modules/chat/message-renderer.tsx
```

Responsibilities:

- Render user messages as bubble.
- Render assistant messages as ordered blocks.
- Keep existing message actions: copy, edit user, regenerate assistant.
- Use existing `Streamdown` for text blocks.
- Use existing Candidate card logic, but route it through ordered blocks.

Do not move all chat state out of `index.tsx` yet. The first pass can pass handlers down as props.

### 5.3 Tool Activity Group

新增:

```text
apps/electron/src/renderer/src/modules/chat/tool-activity.tsx
```

Default rendering:

```text
▸ 查找相关内容 · 搜索 4 条，读取 2 条
```

Expanded rendering:

```text
查找相关内容 · 完成
- 搜索了 3 条 Understanding / 1 条 Context
- 读取了「拖延与自我保护」
- 读取了「真正的恶是放弃进步」
```

Mapping:

| Tool kind                                  | Group    | Running          | Done           |
| ------------------------------------------ | -------- | ---------------- | -------------- |
| search / understanding list / context list | lookup   | 正在查找相关内容 | 查找了相关内容 |
| understanding get / context get            | lookup   | 正在读取内容     | 读取了相关内容 |
| domain list / inspect                      | lookup   | 正在查看领域目录 | 查看了领域目录 |
| graph neighborhood / path                  | graph    | 正在查看关联     | 查看了关联     |
| proposal tools                             | proposal | 正在准备候选项   | 准备了候选项   |
| unknown                                    | other    | 正在使用工具     | 使用了工具     |

Raw JSON:

- hidden by default.
- allowed only behind dev-only detail if needed.

### 5.4 Thinking Summary

新增:

```text
apps/electron/src/renderer/src/modules/chat/thinking-summary.tsx
```

Rules:

- If last assistant turn is busy and has no visible text/proposal yet, show `正在理解问题`.
- If current visible block is a running lookup group, show `正在查找相关内容`.
- If lookup group has finished and text is streaming, collapse thinking into `查找并读取了 N 条相关内容`.
- If stopped, show `已停止`.
- If error, show `生成中断`.

This is status narration, not reasoning display.

### 5.5 Proposal Cards

Modify current candidate cards:

- Remove inline editing from `CandidateUnderstandingCard`.
- Add `忽略`.
- Keep `确认 / 拒绝 / 忽略` status in the card.
- Render proposal cards through ordered turn blocks.

Backend/runtime follow-up:

- Add `ignored` to the persisted proposal status model.
- Add a distinct IPC action:
  - `ignoreToolInvocation({ threadId, messageId, toolCallId })`
- `拒绝` should trigger a next AI step. The minimal version can send a hidden/tool result continuation if existing AI SDK approval path supports it; otherwise keep the card status and enqueue a short assistant continuation through the existing runtime.

### 5.6 Evidence Footer

Add pure extractor:

```text
apps/electron/src/renderer/src/modules/chat/evidence.ts
```

Rules:

- Extract refs only from completed tool outputs.
- Deduplicate by `type:id`.
- Keep first 3 visible, collapse rest.
- Do not use user message `metadata.contextRefs` as evidence.

Initial supported outputs:

- `understandings[]`
- `contexts[]`
- `understanding`
- `context`
- graph nodes that represent understandings

## 6. Phase Plan

### Phase 1: Pure Turn Block Model

Files:

- Add `turn-blocks.ts`
- Add `turn-blocks.test.ts`

Work:

- Define `AgentTurnBlock`.
- Implement ordered part normalization.
- Implement adjacent tool grouping.
- Detect proposal blocks with existing `proposalTypeFor` logic moved into pure helper.

Tests:

- `tool -> text -> tool -> text` preserves order.
- four adjacent lookup tools produce one group.
- lookup tools separated by text produce two groups.
- proposal tool becomes proposal block.

Verification:

- `bun run --filter '@reflecta/electron' test:renderer`
- `bun run --filter '@reflecta/electron' typecheck`

### Phase 2: Ordered Message Renderer

Files:

- Add `message-renderer.tsx`
- Update `index.tsx`

Work:

- Replace current `messageText + toolParts.map` rendering path for assistant messages.
- Keep user message rendering simple.
- Keep existing copy/edit/regenerate behavior.
- Continue using `Streamdown`.

Tests:

- Add renderer tests only if existing setup can mount components cheaply.
- Otherwise rely on `turn-blocks.test.ts` for ordering logic and manual screenshot verification.

Verification:

- A generated answer with interleaved tool/text no longer stacks tools at the bottom.

### Phase 3: Tool Activity Group UI

Files:

- Add `tool-activity.tsx`
- Add `tool-activity-summary.ts`
- Add `tool-activity-summary.test.ts`

Work:

- Render grouped lookup / graph / other tool blocks.
- Use shadcn/Radix Collapsible.
- Replace raw JSON default view with user-readable summaries.
- Keep dev-only raw detail optional.

Tests:

- Search outputs summarize counts.
- Understanding/context reads summarize names.
- Error output produces user-readable failed item.

Verification:

- Screenshot case with four searches renders as one collapsible `查找相关内容` group.

### Phase 4: Thinking Summary

Files:

- Add `thinking-summary.tsx`
- Update `message-renderer.tsx`

Work:

- Show initial thinking state before visible text.
- Collapse thinking after text starts.
- Show stopped/error state.

Tests:

- Pure helper maps busy/no visible blocks to `正在理解问题`.
- Running lookup maps to `正在查找相关内容`.
- Done lookup maps to compact summary.

### Phase 5: Proposal Control

Files:

- Update candidate card components.
- Possibly update chat IPC/runtime if `ignored` must persist.

Work:

- Remove inline edit fields.
- Add `忽略`.
- Ensure proposal appears in ordered position.
- Distinguish `拒绝` and `忽略` control flow.

Verification:

- Confirm writes.
- Reject marks card rejected and allows AI continuation.
- Ignore marks card ignored and focuses composer.

### Phase 6: Evidence Footer

Files:

- Add `evidence.ts`
- Add `evidence.test.ts`
- Update `message-renderer.tsx`

Work:

- Extract evidence from completed read tool outputs.
- Show chips at turn footer.
- Do not show user `@` refs as evidence unless read by tool.

Verification:

- Answer with `understanding_get` shows that understanding as evidence.
- User `@` without tool read does not show false evidence.

## 7. Acceptance Checklist

The plan is complete when:

- Tool cards are no longer uniformly stacked at the bottom of assistant messages.
- Consecutive lookup tools collapse into one Tool Activity Group.
- Thinking is visible before first text and can be expanded/collapsed.
- Assistant text renders in sequence with tool groups.
- Proposal cards render in sequence and support `确认 / 拒绝 / 忽略`.
- Raw JSON is gone from normal user default UI.
- Evidence footer only reflects actual tool-read materials.
- Existing renderer tests pass.
- Electron typecheck passes.

## 8. Risks

### AI SDK Part Shape Drift

Risk:

- Tool part shape may vary across AI SDK versions or persisted messages.

Mitigation:

- Use `isToolUIPart`, `isTextUIPart`, `getToolName`.
- Keep unknown parts renderable through a fallback block.
- Unit-test representative persisted message parts.

### Proposal Status Migration

Risk:

- Existing approval status types only cover `pending / approved / rejected`.

Mitigation:

- Extend the status model to include `ignored`.
- Keep old persisted `pending / approved / rejected` values compatible.
- Add tests for ignored status round-trip if persistence code changes.

### Overbuilding The Renderer

Risk:

- Building a mini assistant-ui clone.

Mitigation:

- Only implement ordered blocks and adjacent grouping.
- Use existing Radix Collapsible.
- Re-evaluate assistant-ui only if Thread/Composer/Message primitives keep expanding.

## 9. Open Questions With Recommended Defaults

### Q1. Should we add assistant-ui now?

Recommended answer: no.

Reason:

- The current defect is caused by local render ordering, and AI SDK already supplies message parts.
- Existing shadcn/Radix components cover collapsible UI.
- Add assistant-ui only if we decide to replace the whole chat primitive stack.

### Q2. Should Thinking display raw reasoning?

Recommended answer: no.

Reason:

- The product need is legibility, not raw chain-of-thought.
- Show process summaries derived from tool/activity state.

### Q3. Should every tool be visible?

Recommended answer: yes, but grouped and summarized.

Reason:

- Agent Interaction Legibility requires traceability.
- Grouping prevents activity from becoming noise.

### Q4. Should Evidence ship in the first implementation slice?

Recommended answer: after ordered renderer and tool grouping.

Reason:

- Evidence depends on correctly reading ordered tool outputs.
- Shipping it before fixing renderer order would preserve the wrong model.

## 10. Definition Of Done For First Slice

First slice should stop after Phase 3.

It is done when:

- Ordered block rendering exists.
- Consecutive lookup tools group.
- Current screenshot failure no longer reproduces.
- Tests cover ordered grouping.
- Typecheck passes.

Thinking, proposal control, and evidence are next slices, not prerequisites for fixing the bottom-stacked tool failure.
