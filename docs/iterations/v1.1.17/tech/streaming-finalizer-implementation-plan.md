# Streaming Finalizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用可流式渲染、可校验、可失败的 Reflecta finalizer 替代 Pi Agent 普通正文作为最终可见答案来源。

**Architecture:** Pi Agent 继续负责 reasoning、tool、approval 工作流；普通 Pi `text_delta` 只作为内部 draft，不再进入最终答案 UI。Reflecta 在 Pi run 结束后启动单独的 provider-native structured-output finalizer，流式产出 `assistant.final.partial`，最终只持久化通过 schema 与 entity catalog 校验的 `AgentTextPart[]`。

**Tech Stack:** Electron main process、Pi Coding Agent、`@earendil-works/pi-ai/base` streaming helpers、AJV、TypeScript shared Agent events、Streamdown renderer、Vitest、Playwright。

---

## 0. 先读这些文档

- `docs/iterations/v1.1.17/tech/final-answer-protocol-qualification.md`
- `docs/references/technical/frontend-guide.md`
- `docs/references/technical/architecture/unit-test-principles.md`
- `docs/references/technical/architecture/test-case-principles.md`

## 1. 目标状态

最终用户看到的 Agent 回复来自这条链路：

```text
Pi Agent reasoning/tool/approval stream
  -> internal piDraftText
  -> runAgentFinalizer()
  -> assistant.final.partial live events
  -> final assistant.turn snapshot
```

最终用户不再看到：

- Pi Agent 普通 `assistant.text.delta` 直接形成的最终回答。
- 模型手写的 `<entity_ref />`、JSON、YAML、`[[ref:*]]`、`U1/D1/[1]` 伪协议。
- 不在 catalog 里的 `entity_ref` 被 fallback 成成功文本。

## 2. 文件结构

### Shared protocol

- Modify: `apps/electron/src/preload/typings/agent.ts`

### Main process

- Create: `apps/electron/src/main/services/agent/agent-finalizer.ts`
- Create: `apps/electron/src/main/services/agent/agent-finalizer.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-text-parts.ts`
- Modify: `apps/electron/src/main/services/agent/agent-text-parts.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-run-accumulator.ts`
- Modify: `apps/electron/src/main/services/agent/agent-run-accumulator.test.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`

### Renderer

- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

### E2E

- Modify: `apps/electron/e2e/agent/agent-fixture-store.ts`
- Modify: `apps/electron/e2e/agent/structured-results.spec.ts`
- Modify: `apps/electron/e2e/agent/features/structured-results.feature`

## 3. Non-goals

- 不新增 Vercel AI SDK 依赖。
- 不做正文 parser。
- 不从 title 反查 entity。
- 不迁移历史普通 assistant text 去补引用。
- 不保留 `reflecta_final_answer` optional tool 作为最终答案主通道。

## 4. Task 1: Add Streaming Final Answer Events

**Files:**

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Test: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

- [ ] **Step 1: Add failing reducer tests**

Append these tests to `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts` inside the existing `describe` block:

```ts
test("streams finalizer partial as a streaming assistant text block", () => {
  const state = reduceAgentSession([
    { ...base, id: "evt_1", type: "run.started" },
    {
      ...base,
      id: "evt_2",
      type: "assistant.final.partial",
      messageId: "assistant_1",
      text: "放在三观下面，继续",
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
        { type: "text", text: "下面" },
      ],
      previewText: "，继续",
    },
  ]);

  expect(state.messages[0]).toMatchObject({
    id: "assistant_1",
    role: "assistant",
    text: "放在三观下面，继续",
    blocks: [
      {
        kind: "text",
        text: "放在三观下面，继续",
        parts: [
          { type: "text", text: "放在" },
          { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
          { type: "text", text: "下面" },
        ],
        previewText: "，继续",
        state: "streaming",
      },
    ],
  });
});

test("final assistant turn replaces streaming finalizer preview", () => {
  const state = reduceAgentSession([
    { ...base, id: "evt_1", type: "run.started" },
    {
      ...base,
      id: "evt_2",
      type: "assistant.final.partial",
      messageId: "assistant_1",
      text: "放在三观下面，继续",
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
        { type: "text", text: "下面" },
      ],
      previewText: "，继续",
    },
    {
      ...base,
      id: "evt_3",
      type: "assistant.turn",
      messageId: "assistant_1",
      text: "放在三观下面。",
      blocks: [
        {
          kind: "text",
          text: "放在三观下面。",
          parts: [
            { type: "text", text: "放在" },
            { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
            { type: "text", text: "下面。" },
          ],
          state: "done",
          createdAt: base.createdAt,
        },
      ],
    },
  ]);

  expect(state.messages[0]).toMatchObject({
    text: "放在三观下面。",
    blocks: [
      {
        kind: "text",
        text: "放在三观下面。",
        previewText: undefined,
        state: "done",
      },
    ],
  });
});

test("marks finalizer failure as a failed assistant text block", () => {
  const state = reduceAgentSession([
    { ...base, id: "evt_1", type: "run.started" },
    {
      ...base,
      id: "evt_2",
      type: "assistant.final.failed",
      messageId: "assistant_1",
      error: "引用实体不存在: domain/missing",
    },
  ]);

  expect(state.messages[0]).toMatchObject({
    id: "assistant_1",
    role: "assistant",
    text: "",
    blocks: [
      {
        kind: "text",
        text: "",
        state: "failed",
        error: "引用实体不存在: domain/missing",
      },
    ],
  });
});
```

- [ ] **Step 2: Run reducer test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: FAIL because `assistant.final.partial` and `assistant.final.failed` are not valid agent events.

- [ ] **Step 3: Add shared event and block types**

In `apps/electron/src/preload/typings/agent.ts`, add these types after `AgentAssistantTextDelta`:

```ts
export type AgentAssistantFinalPartial = AgentEventBase & {
  type: "assistant.final.partial";
  runId: string;
  messageId: string;
  text: string;
  parts: AgentTextPart[];
  previewText?: string;
};

export type AgentAssistantFinalFailed = AgentEventBase & {
  type: "assistant.final.failed";
  runId: string;
  messageId: string;
  error: string;
};
```

Extend `AgentLiveEvent`:

```ts
export type AgentLiveEvent =
  | AgentAssistantTextDelta
  | AgentAssistantFinalPartial
  | AgentAssistantFinalFailed
  | AgentAssistantReasoningDelta
  | AgentToolStarted
  | AgentToolCompleted
  | AgentToolFailed;
```

Extend the text block variant in `AgentReducedAssistantBlock`:

```ts
  | {
      kind: "text";
      text: string;
      parts?: AgentTextPart[];
      previewText?: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
      createdAt: string;
    };
```

Add final event names to `isAgentEvent`:

```ts
[
  "assistant.text.delta",
  "assistant.final.partial",
  "assistant.final.failed",
  "assistant.reasoning.delta",
  "tool.started",
  "tool.completed",
  "tool.failed",
].includes(value.type);
```

- [ ] **Step 4: Add reducer helpers**

In `apps/electron/src/preload/typings/agent.ts`, add these helpers near `upsertAssistantText`:

```ts
function upsertAssistantFinalPartial(
  messages: AgentReducedMessage[],
  event: AgentAssistantFinalPartial,
): AgentReducedMessage[] {
  const block: Extract<AgentReducedAssistantBlock, { kind: "text" }> = {
    kind: "text",
    text: event.text,
    parts: event.parts,
    ...(event.previewText ? { previewText: event.previewText } : {}),
    state: "streaming",
    createdAt: event.createdAt,
  };
  return upsertAssistantFinalBlock(messages, event, block, event.text);
}

function upsertAssistantFinalFailed(
  messages: AgentReducedMessage[],
  event: AgentAssistantFinalFailed,
): AgentReducedMessage[] {
  const block: Extract<AgentReducedAssistantBlock, { kind: "text" }> = {
    kind: "text",
    text: "",
    state: "failed",
    error: event.error,
    createdAt: event.createdAt,
  };
  return upsertAssistantFinalBlock(messages, event, block, "");
}

function upsertAssistantFinalBlock(
  messages: AgentReducedMessage[],
  event: AgentAssistantFinalPartial | AgentAssistantFinalFailed,
  block: Extract<AgentReducedAssistantBlock, { kind: "text" }>,
  text: string,
): AgentReducedMessage[] {
  const index = messages.findIndex((message) => message.id === event.messageId);
  if (index < 0) {
    return [
      ...messages,
      {
        id: event.messageId,
        role: "assistant",
        text,
        runId: event.runId,
        createdAt: event.createdAt,
        blocks: [block],
      },
    ];
  }
  return messages.map((message, messageIndex) => {
    if (messageIndex !== index) return message;
    const blocks = message.blocks ?? [];
    const lastTextIndex = blocks.findLastIndex((current) => current.kind === "text");
    const nextBlocks =
      lastTextIndex < 0
        ? [...blocks, block]
        : blocks.map((current, blockIndex) => (blockIndex === lastTextIndex ? block : current));
    return { ...message, text, blocks: nextBlocks };
  });
}
```

Wire them in `reduceAgentSessionEvent` before `assistant.turn`:

```ts
if (event.type === "assistant.final.partial") {
  return {
    ...state,
    sessionId: event.sessionId,
    messages: upsertAssistantFinalPartial(state.messages, event),
  };
}

if (event.type === "assistant.final.failed") {
  return {
    ...state,
    sessionId: event.sessionId,
    messages: upsertAssistantFinalFailed(state.messages, event),
  };
}
```

- [ ] **Step 5: Run reducer test and verify it passes**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts
rtk git commit -m "feat(agent): add streaming final answer events"
```

## 5. Task 2: Render Streaming Final Blocks

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Test: `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`

- [ ] **Step 1: Add failing renderer tests**

Append these tests to `apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx`:

```tsx
test("renders validated finalizer parts with plain preview text", () => {
  renderMessageList({
    messages: [
      {
        id: "assistant_1",
        role: "assistant",
        text: '放在三观下面 <entity_ref type="domain" entityId="domain_ai" />',
        createdAt: "2026-07-01T00:00:00.000Z",
        blocks: [
          {
            kind: "text",
            text: '放在三观下面 <entity_ref type="domain" entityId="domain_ai" />',
            parts: [
              { type: "text", text: "放在" },
              { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
              { type: "text", text: "下面" },
            ],
            previewText: ' <entity_ref type="domain" entityId="domain_ai" />',
            state: "streaming",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
    ],
    entityCatalog: [
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
      {
        key: "domain:domain_ai",
        entity: { type: "domain", id: "domain_ai", title: "AI" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ],
  });

  expect(container?.querySelectorAll('[data-slot="wiki-link"]')).toHaveLength(1);
  expect(container?.querySelector('[data-slot="wiki-link"]')?.textContent).toContain("三观");
  expect(container?.textContent).toContain("<entity_ref");
  expect(container?.textContent).toContain("domain_ai");
});

test("renders finalizer failure as a failed answer state", () => {
  renderMessageList({
    messages: [
      {
        id: "assistant_1",
        role: "assistant",
        text: "",
        createdAt: "2026-07-01T00:00:00.000Z",
        blocks: [
          {
            kind: "text",
            text: "",
            state: "failed",
            error: "引用实体不存在: domain/missing",
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
    ],
    entityCatalog: [],
  });

  expect(
    container?.querySelector('[data-testid="agent-final-answer-error"]')?.textContent,
  ).toContain("引用实体不存在: domain/missing");
});
```

- [ ] **Step 2: Run renderer test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: FAIL because `previewText`, `state`, and `error` are not rendered.

- [ ] **Step 3: Extend turn view types**

In `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`, update `AgentTurnBlock` and `InternalTurnBlock` text variants:

```ts
export type AgentTurnBlock =
  | {
      kind: "text";
      text: string;
      parts?: AgentTextPart[];
      previewText?: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
    }
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "tool-activity"; activity: ToolActivityView }
  | { kind: "proposal"; proposal: ProposalView };
```

```ts
type InternalTurnBlock =
  | {
      kind: "text";
      text: string;
      parts?: AgentTextPart[];
      previewText?: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
    }
  | { kind: "reasoning"; text: string; status: AgentReasoningView["status"] }
  | { kind: "tool-group"; groupType: ToolGroupType; blocks: AgentToolBlock[] }
  | { kind: "proposal"; proposal: ProposalView };
```

Replace `appendText` with:

```ts
function appendText(
  blocks: InternalTurnBlock[],
  text: string,
  parts?: AgentTextPart[],
  previewText?: string,
  state?: "streaming" | "done" | "failed",
  error?: string,
) {
  if (!text && !previewText && !error) return;
  const last = blocks.at(-1);
  if (!parts && !previewText && !state && !error && last?.kind === "text" && !last.parts) {
    last.text += text;
    return;
  }
  blocks.push({
    kind: "text",
    text,
    ...(parts ? { parts } : {}),
    ...(previewText ? { previewText } : {}),
    ...(state ? { state } : {}),
    ...(error ? { error } : {}),
  });
}
```

Update the caller in `buildAgentTurnView`:

```ts
appendText(internalBlocks, block.text, block.parts, block.previewText, block.state, block.error);
```

- [ ] **Step 4: Render preview and failure**

In `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`, update `StructuredTextBody` props:

```tsx
function StructuredTextBody({
  parts,
  previewText,
  entityCatalog,
  onInspectContextRef,
  findState,
}: {
  parts: AgentTextPart[];
  previewText?: string;
  entityCatalog: AgentEntityCatalogEntry[];
  onInspectContextRef?: (ref: InspectableContextRef) => void;
  findState?: ChatFindRenderState;
}) {
  return (
    <MarkdownBody
      value={`${markdownFromStructuredParts(parts, entityCatalog)}${previewText ?? ""}`}
      onInspectContextRef={onInspectContextRef}
      entityCatalog={entityCatalog}
      findState={findState}
      convertReferenceMarkdown={false}
    />
  );
}
```

Inside the text block renderer, add a failure branch before the structured/plain branches:

```tsx
{
  block.state === "failed" ? (
    <div
      data-testid="agent-final-answer-error"
      className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      最终答案生成失败：{block.error ?? "未知错误"}
    </div>
  ) : block.parts ? (
    <StructuredTextBody
      parts={block.parts}
      previewText={block.previewText}
      entityCatalog={entityCatalog}
      onInspectContextRef={onInspectContextRef}
    />
  ) : (
    <MarkdownBody
      value={block.text}
      onInspectContextRef={onInspectContextRef}
      entityCatalog={entityCatalog}
      findState={findState}
    />
  );
}
```

- [ ] **Step 5: Run renderer test and verify it passes**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/messages/message-list.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx apps/electron/src/renderer/src/modules/chat/messages/message-list.test.tsx
rtk git commit -m "feat(agent): render streaming final answers"
```

## 6. Task 3: Add Strict Final Answer Part Validation

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-text-parts.ts`
- Test: `apps/electron/src/main/services/agent/agent-text-parts.test.ts`

- [ ] **Step 1: Add failing validation tests**

Append these tests to `apps/electron/src/main/services/agent/agent-text-parts.test.ts`:

```ts
test("validates final answer parts against the entity catalog", () => {
  const result = validateFinalAnswerParts(
    [
      { type: "text", text: "放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
      { type: "text", text: "下面。" },
    ],
    [
      {
        key: "domain:domain_1",
        entity: { type: "domain", id: "domain_1", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_1", toolName: "domain_inspect" },
      },
    ],
  );

  expect(result).toEqual({
    ok: true,
    text: "放在三观下面。",
    parts: [
      { type: "text", text: "放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
      { type: "text", text: "下面。" },
    ],
  });
});

test("rejects final answer parts when an entity id is missing from the catalog", () => {
  const result = validateFinalAnswerParts(
    [{ type: "entity_ref", entityType: "domain", entityId: "missing", fallbackText: "三观" }],
    [],
  );

  expect(result).toEqual({
    ok: false,
    error: "引用实体不存在: domain/missing",
  });
});
```

- [ ] **Step 2: Run validation test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-text-parts.test.ts
```

Expected: FAIL because `validateFinalAnswerParts` is missing.

- [ ] **Step 3: Add strict validator without changing history fallback**

In `apps/electron/src/main/services/agent/agent-text-parts.ts`, keep `normalizeAgentTextParts` unchanged for historical data and add:

```ts
export type ValidateFinalAnswerPartsResult =
  | { ok: true; text: string; parts: AgentTextPart[] }
  | { ok: false; error: string };

export function validateFinalAnswerParts(
  parts: AgentTextPart[],
  catalog: AgentEntityCatalogEntry[],
): ValidateFinalAnswerPartsResult {
  const entries = new Map(catalog.map((entry) => [entry.key, entry]));
  let text = "";

  for (const part of parts) {
    if (part.type === "text") {
      text += part.text;
      continue;
    }

    const entry = entries.get(catalogKey(part));
    if (!entry) {
      return { ok: false, error: `引用实体不存在: ${part.entityType}/${part.entityId}` };
    }
    text += entityTitle(entry, part.fallbackText);
  }

  return { ok: true, text, parts };
}
```

- [ ] **Step 4: Run validation test and verify it passes**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-text-parts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/electron/src/main/services/agent/agent-text-parts.ts apps/electron/src/main/services/agent/agent-text-parts.test.ts
rtk git commit -m "feat(agent): validate final answer entity refs strictly"
```

## 7. Task 4: Build the Pure Streaming Finalizer Adapter

**Files:**

- Create: `apps/electron/src/main/services/agent/agent-finalizer.ts`
- Test: `apps/electron/src/main/services/agent/agent-finalizer.test.ts`

- [ ] **Step 1: Add failing finalizer tests**

Create `apps/electron/src/main/services/agent/agent-finalizer.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { runAgentFinalizer } from "./agent-finalizer";

async function* chunks(values: string[]) {
  for (const value of values) yield value;
}

const catalog = [
  {
    key: "domain:domain_1",
    entity: { type: "domain" as const, id: "domain_1", title: "三观" },
    origin: { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "domain_inspect" },
  },
];

describe("runAgentFinalizer", () => {
  test("streams stable parts and preview text before returning the final answer", async () => {
    const onPartial = vi.fn();
    const result = await runAgentFinalizer(
      {
        userQuestion: "这个理解放在哪里",
        piDraftText: "放在三观下面。",
        toolResults: [],
        entityCatalog: catalog,
        requiresEntityRefs: true,
        onPartial,
      },
      {
        streamJson: () =>
          chunks([
            '{"parts":[{"type":"text","text":"放在"},',
            '{"type":"entity_ref","entityType":"domain","entityId":"domain_1","fallbackText":"三观"},',
            '{"type":"text","text":"下面。"}]}',
          ]),
      },
    );

    expect(result).toEqual({
      text: "放在三观下面。",
      parts: [
        { type: "text", text: "放在" },
        {
          type: "entity_ref",
          entityType: "domain",
          entityId: "domain_1",
          fallbackText: "三观",
        },
        { type: "text", text: "下面。" },
      ],
    });
    expect(onPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("放在"),
        parts: expect.arrayContaining([{ type: "text", text: "放在" }]),
      }),
    );
  });

  test("retries once and fails when final answer references a missing entity", async () => {
    const onPartial = vi.fn();
    await expect(
      runAgentFinalizer(
        {
          userQuestion: "这个理解放在哪里",
          piDraftText: "放在三观下面。",
          toolResults: [],
          entityCatalog: catalog,
          requiresEntityRefs: true,
          onPartial,
        },
        {
          maxAttempts: 2,
          streamJson: () =>
            chunks([
              '{"parts":[{"type":"entity_ref","entityType":"domain","entityId":"missing","fallbackText":"三观"}]}',
            ]),
        },
      ),
    ).rejects.toThrow("引用实体不存在: domain/missing");
  });

  test("fails when entity refs are required but the final answer has none", async () => {
    await expect(
      runAgentFinalizer(
        {
          userQuestion: "根据知识库回答",
          piDraftText: "三观相关。",
          toolResults: [],
          entityCatalog: catalog,
          requiresEntityRefs: true,
          onPartial: vi.fn(),
        },
        {
          streamJson: () => chunks(['{"parts":[{"type":"text","text":"三观相关。"}]}']),
        },
      ),
    ).rejects.toThrow("缺少必要实体引用");
  });
});
```

- [ ] **Step 2: Run finalizer test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: FAIL because `agent-finalizer.ts` is missing.

- [ ] **Step 3: Implement pure finalizer orchestration**

Create `apps/electron/src/main/services/agent/agent-finalizer.ts`:

```ts
import Ajv from "ajv";
import { parseJsonWithRepair, parseStreamingJson } from "@earendil-works/pi-ai/base";
import type { AgentEntityCatalogEntry, AgentTextPart } from "@shared/agent";
import { validateFinalAnswerParts } from "./agent-text-parts";

export type FinalAnswer = {
  parts: AgentTextPart[];
};

export type RunAgentFinalizerInput = {
  userQuestion: string;
  piDraftText: string;
  toolResults: unknown[];
  entityCatalog: AgentEntityCatalogEntry[];
  requiresEntityRefs: boolean;
  signal?: AbortSignal;
  onPartial: (partial: { text: string; parts: AgentTextPart[]; previewText?: string }) => void;
};

export type RunAgentFinalizerResult = {
  text: string;
  parts: AgentTextPart[];
};

export type AgentFinalizerDeps = {
  maxAttempts?: number;
  streamJson: (input: RunAgentFinalizerInput, attempt: number) => AsyncIterable<string>;
};

export const FINAL_ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "text"],
            properties: {
              type: { type: "string", const: "text" },
              text: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "entityType", "entityId"],
            properties: {
              type: { type: "string", const: "entity_ref" },
              entityType: {
                type: "string",
                enum: ["understanding", "context", "domain"],
              },
              entityId: { type: "string", minLength: 1 },
              fallbackText: { type: "string", nullable: true },
            },
          },
        ],
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true });
const validateFinalAnswerJson = ajv.compile<FinalAnswer>(FINAL_ANSWER_JSON_SCHEMA);

function stablePartsFromPartial(value: unknown): AgentTextPart[] {
  if (!value || typeof value !== "object" || !("parts" in value) || !Array.isArray(value.parts)) {
    return [];
  }
  return value.parts.flatMap((part) => {
    if (!part || typeof part !== "object" || !("type" in part)) return [];
    if (part.type === "text" && "text" in part && typeof part.text === "string") {
      return [{ type: "text" as const, text: part.text }];
    }
    if (
      part.type === "entity_ref" &&
      "entityType" in part &&
      (part.entityType === "understanding" ||
        part.entityType === "context" ||
        part.entityType === "domain") &&
      "entityId" in part &&
      typeof part.entityId === "string"
    ) {
      return [
        {
          type: "entity_ref" as const,
          entityType: part.entityType,
          entityId: part.entityId,
          ...("fallbackText" in part && typeof part.fallbackText === "string"
            ? { fallbackText: part.fallbackText }
            : {}),
        },
      ];
    }
    return [];
  });
}

function hasEntityRef(parts: AgentTextPart[]) {
  return parts.some((part) => part.type === "entity_ref");
}

function splitPreviewText(parts: AgentTextPart[]): {
  committedParts: AgentTextPart[];
  previewText?: string;
} {
  const last = parts.at(-1);
  if (last?.type !== "text") return { committedParts: parts };
  return {
    committedParts: parts.slice(0, -1),
    ...(last.text ? { previewText: last.text } : {}),
  };
}

function finalAnswerFromRawJson(rawJson: string): FinalAnswer {
  const parsed = parseJsonWithRepair<unknown>(rawJson);
  if (!validateFinalAnswerJson(parsed)) {
    const message = ajv.errorsText(validateFinalAnswerJson.errors, { separator: "; " });
    throw new Error(`最终答案结构化失败: ${message}`);
  }
  return parsed;
}

async function runOneAttempt(
  input: RunAgentFinalizerInput,
  deps: AgentFinalizerDeps,
  attempt: number,
) {
  let rawJson = "";
  for await (const chunk of deps.streamJson(input, attempt)) {
    input.signal?.throwIfAborted();
    rawJson += chunk;
    const partial = parseStreamingJson<Partial<FinalAnswer>>(rawJson);
    const parts = stablePartsFromPartial(partial);
    const { committedParts, previewText } = splitPreviewText(parts);
    const validated = validateFinalAnswerParts(committedParts, input.entityCatalog);
    if (validated.ok) {
      input.onPartial({
        text: `${validated.text}${previewText ?? ""}`,
        parts: validated.parts,
        ...(previewText ? { previewText } : {}),
      });
    }
  }

  const finalAnswer = finalAnswerFromRawJson(rawJson);
  if (input.requiresEntityRefs && !hasEntityRef(finalAnswer.parts)) {
    throw new Error("缺少必要实体引用");
  }
  const validated = validateFinalAnswerParts(finalAnswer.parts, input.entityCatalog);
  if (!validated.ok) throw new Error(validated.error);
  input.onPartial({ text: validated.text, parts: validated.parts });
  return validated;
}

export async function runAgentFinalizer(
  input: RunAgentFinalizerInput,
  deps: AgentFinalizerDeps,
): Promise<RunAgentFinalizerResult> {
  const maxAttempts = deps.maxAttempts ?? 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runOneAttempt(input, deps, attempt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("最终答案生成失败");
}
```

- [ ] **Step 4: Run finalizer test and verify it passes**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/electron/src/main/services/agent/agent-finalizer.ts apps/electron/src/main/services/agent/agent-finalizer.test.ts
rtk git commit -m "feat(agent): add streaming finalizer adapter"
```

## 8. Task 5: Add Provider Structured Stream Factory

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-finalizer.ts`
- Test: `apps/electron/src/main/services/agent/agent-finalizer.test.ts`

- [ ] **Step 1: Add failing payload patch tests**

Append these tests to `apps/electron/src/main/services/agent/agent-finalizer.test.ts`:

```ts
test("patches OpenAI Responses payload with structured text format", () => {
  expect(
    withFinalAnswerStructuredOutput({
      model: "gpt-4o",
      input: [],
      stream: true,
      store: false,
    }),
  ).toMatchObject({
    text: {
      format: {
        type: "json_schema",
        name: "reflecta_final_answer",
        strict: true,
        schema: expect.objectContaining({ required: ["parts"] }),
      },
    },
  });
});

test("patches OpenAI Chat Completions payload with response_format", () => {
  expect(
    withFinalAnswerStructuredOutput({
      model: "gpt-4o",
      messages: [],
      stream: true,
    }),
  ).toMatchObject({
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "reflecta_final_answer",
        strict: true,
        schema: expect.objectContaining({ required: ["parts"] }),
      },
    },
  });
});
```

Update the import in the test:

```ts
import { runAgentFinalizer, withFinalAnswerStructuredOutput } from "./agent-finalizer";
```

- [ ] **Step 2: Run finalizer test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: FAIL because `withFinalAnswerStructuredOutput` is missing.

- [ ] **Step 3: Add payload patcher and provider stream factory**

In `apps/electron/src/main/services/agent/agent-finalizer.ts`, extend imports:

```ts
import {
  getModel,
  parseJsonWithRepair,
  parseStreamingJson,
  stream,
  type Api,
  type Context,
  type Model,
} from "@earendil-works/pi-ai/base";
import type { ResolvedAiModelConfig } from "../../config";
```

Add these helpers:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function withFinalAnswerStructuredOutput(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if ("input" in payload) {
    return {
      ...payload,
      text: {
        ...(isRecord(payload.text) ? payload.text : {}),
        format: {
          type: "json_schema",
          name: "reflecta_final_answer",
          strict: true,
          schema: FINAL_ANSWER_JSON_SCHEMA,
        },
      },
    };
  }
  if ("messages" in payload) {
    return {
      ...payload,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reflecta_final_answer",
          strict: true,
          schema: FINAL_ANSWER_JSON_SCHEMA,
        },
      },
    };
  }
  return payload;
}

export function resolveFinalizerModel(providerId: string, modelId: string): Model<Api> {
  const model = (getModel as (provider: string, modelId: string) => Model<Api> | undefined)(
    providerId,
    modelId,
  );
  if (!model) throw new Error(`Finalizer model not found: ${providerId}/${modelId}`);
  return model;
}

export function buildFinalizerContext(input: RunAgentFinalizerInput): Context {
  return {
    systemPrompt:
      "你是 Reflecta 的最终答案格式化器。只输出符合 schema 的 JSON。parts 中可以交替使用 text 和 entity_ref。entity_ref.entityId 必须来自给定 entityCatalog，不允许编造。",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          userQuestion: input.userQuestion,
          piDraftText: input.piDraftText,
          toolResults: input.toolResults,
          entityCatalog: input.entityCatalog,
          requiresEntityRefs: input.requiresEntityRefs,
        }),
        timestamp: Date.now(),
      },
    ],
  };
}

export function createPiAiFinalizerStream(input: {
  modelConfig: ResolvedAiModelConfig;
  apiKey: string;
}): AgentFinalizerDeps["streamJson"] {
  const model = resolveFinalizerModel(input.modelConfig.provider.id, input.modelConfig.model.id);
  return async function* streamJson(finalizerInput) {
    const eventStream = stream(model, buildFinalizerContext(finalizerInput), {
      apiKey: input.apiKey,
      temperature: 0,
      onPayload: (payload) => withFinalAnswerStructuredOutput(payload),
    });
    for await (const event of eventStream) {
      if (event.type === "text_delta") yield event.delta;
    }
  };
}
```

- [ ] **Step 4: Run finalizer tests and verify they pass**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/electron/src/main/services/agent/agent-finalizer.ts apps/electron/src/main/services/agent/agent-finalizer.test.ts
rtk git commit -m "feat(agent): add provider structured finalizer stream"
```

## 9. Task 6: Integrate Finalizer Into PiAgentHost

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/agent-run-accumulator.ts`
- Test: `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- Test: `apps/electron/src/main/services/agent/agent-run-accumulator.test.ts`
- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`

- [ ] **Step 1: Add failing accumulator tests**

Append to `apps/electron/src/main/services/agent/agent-run-accumulator.test.ts`:

```ts
test("keeps streaming finalizer partials in the active run snapshot", () => {
  const accumulator = new AgentRunAccumulator();

  accumulator.append({
    ...base,
    id: "evt_final_partial",
    type: "assistant.final.partial",
    text: "放在三观下面，继续",
    parts: [
      { type: "text", text: "放在" },
      { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
      { type: "text", text: "下面" },
    ],
    previewText: "，继续",
  });

  expect(
    accumulator.toAssistantTurn({
      ...base,
      id: "turn_1",
      type: "assistant.turn",
    }).blocks,
  ).toEqual([
    {
      kind: "text",
      text: "放在三观下面，继续",
      parts: [
        { type: "text", text: "放在" },
        { type: "entity_ref", entityType: "domain", entityId: "domain_1" },
        { type: "text", text: "下面" },
      ],
      previewText: "，继续",
      state: "streaming",
      createdAt: base.createdAt,
    },
  ]);
});

test("persists final answer failure in the active run snapshot", () => {
  const accumulator = new AgentRunAccumulator();

  accumulator.append({
    ...base,
    id: "evt_final_failed",
    type: "assistant.final.failed",
    error: "引用实体不存在: domain/missing",
  });

  expect(
    accumulator.toAssistantTurn({
      ...base,
      id: "turn_1",
      type: "assistant.turn",
    }).blocks,
  ).toEqual([
    {
      kind: "text",
      text: "",
      state: "failed",
      error: "引用实体不存在: domain/missing",
      createdAt: base.createdAt,
    },
  ]);
});
```

- [ ] **Step 2: Run accumulator test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-run-accumulator.test.ts
```

Expected: FAIL because `AgentRunAccumulator.append` does not handle finalizer events.

- [ ] **Step 3: Update accumulator**

In `apps/electron/src/main/services/agent/agent-run-accumulator.ts`, `AgentLiveEvent` already includes finalizer events after Task 1. Add these branches after `assistant.text.delta`:

```ts
if (event.type === "assistant.final.partial") {
  this.replaceFinalTextBlock({
    kind: "text",
    text: event.text,
    parts: event.parts,
    ...(event.previewText ? { previewText: event.previewText } : {}),
    state: "streaming",
    createdAt: event.createdAt,
  });
  return;
}

if (event.type === "assistant.final.failed") {
  this.replaceFinalTextBlock({
    kind: "text",
    text: "",
    state: "failed",
    error: event.error,
    createdAt: event.createdAt,
  });
  return;
}
```

Add this private method:

```ts
  private replaceFinalTextBlock(block: Extract<AgentAssistantTurnBlock, { kind: "text" }>): void {
    const index = this.blocks.findLastIndex((current) => current.kind === "text");
    if (index < 0) {
      this.blocks = [...this.blocks, block];
      return;
    }
    this.blocks = this.blocks.map((current, blockIndex) => (blockIndex === index ? block : current));
  }
```

Update `appendFinalAnswer` to mark success:

```ts
  appendFinalAnswer(event: FinalAnswerEvent): void {
    this.replaceFinalTextBlock({
      kind: "text",
      text: event.text,
      parts: event.parts,
      state: "done",
      createdAt: event.createdAt,
    });
  }
```

- [ ] **Step 4: Add failing PiAgentHost integration tests**

In `apps/electron/src/main/services/agent/pi-agent-host.test.ts`, add a finalizer test helper near existing helpers:

```ts
function finalizerSuccess(parts: AgentTextPart[]) {
  return vi.fn(async (input: RunAgentFinalizerInput) => {
    const text = parts
      .map((part) => (part.type === "text" ? part.text : (part.fallbackText ?? part.entityId)))
      .join("");
    input.onPartial({ text, parts });
    return { text, parts };
  });
}
```

Update imports:

```ts
import type { AgentTextPart } from "@shared/agent";
import type { RunAgentFinalizerInput } from "./agent-finalizer";
```

Also update the existing `./pi-agent-host` import so it imports `AGENT_EVENT_CHANNEL` and no longer imports `REFLECTA_FINAL_ANSWER_TOOL_NAME`:

```ts
import {
  AGENT_EVENT_CHANNEL,
  buildThreadTitleContext,
  configurePiRuntimeAuth,
  createPiResourceLoader,
  extractAssistantError,
  loadAgentSystemPrompt,
  normalizeGeneratedThreadTitle,
  PiAgentHost,
} from "./pi-agent-host";
```

Add these tests inside `describe("PiAgentHost", () => { ... })`:

```ts
test("uses finalizer output as the persisted final answer instead of Pi text", async () => {
  const root = tempRoot();
  const log = new AgentSessionLog(root);
  const thread = log.createSession("新对话");
  const manager = await log.openSession(thread.id);
  let listener: ((event: unknown) => void) | undefined;
  createAgentSessionMock.mockResolvedValueOnce({
    session: {
      sessionManager: manager,
      subscribe: (next: (event: unknown) => void) => {
        listener = next;
        return () => {};
      },
      prompt: vi.fn(async () => {
        listener?.({
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            delta: '<entity_ref type="domain" entityId="domain_1" />',
          },
        });
        listener?.({
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: '<entity_ref type="domain" entityId="domain_1" />' }],
            provider: "openai",
            model: "gpt-4o",
            stopReason: "stop",
          },
        });
      }),
      getContextUsage: vi.fn(() => undefined),
      dispose: vi.fn(),
      abort: vi.fn(),
    },
  });
  const finalizer = finalizerSuccess([
    { type: "text", text: "放在" },
    { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
    { type: "text", text: "下面。" },
  ]);
  const webContents = { isDestroyed: () => false, send: vi.fn() };

  await (
    new PiAgentHost(root, undefined, finalizer) as unknown as {
      sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
    }
  ).sendMessage(
    {
      type: "message.send",
      sessionId: thread.id,
      text: "放在哪里",
      contextRefs: [{ type: "domain", id: "domain_1", title: "三观" }],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    },
    webContents as never,
  );

  const events = await new AgentSessionLog(root).readEvents(thread.id);
  expect(events.find((event) => event.type === "assistant.turn")).toMatchObject({
    text: "放在三观下面。",
    blocks: [
      {
        kind: "text",
        text: "放在三观下面。",
        state: "done",
        parts: [
          { type: "text", text: "放在" },
          { type: "entity_ref", entityType: "domain", entityId: "domain_1", fallbackText: "三观" },
          { type: "text", text: "下面。" },
        ],
      },
    ],
  });
  expect(events.map((event) => event.type)).not.toContain("assistant.text.delta");
  expect(webContents.send).toHaveBeenCalledWith(
    AGENT_EVENT_CHANNEL,
    expect.objectContaining({ type: "assistant.final.partial" }),
  );
});

test("persists a failed final answer block when finalizer validation fails", async () => {
  const root = tempRoot();
  const log = new AgentSessionLog(root);
  const thread = log.createSession("新对话");
  const manager = await log.openSession(thread.id);
  let listener: ((event: unknown) => void) | undefined;
  createAgentSessionMock.mockResolvedValueOnce({
    session: {
      sessionManager: manager,
      subscribe: (next: (event: unknown) => void) => {
        listener = next;
        return () => {};
      },
      prompt: vi.fn(async () => {
        listener?.({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "草稿" },
        });
        listener?.({
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "草稿" }],
            provider: "openai",
            model: "gpt-4o",
            stopReason: "stop",
          },
        });
      }),
      getContextUsage: vi.fn(() => undefined),
      dispose: vi.fn(),
      abort: vi.fn(),
    },
  });
  const finalizer = vi.fn(async () => {
    throw new Error("引用实体不存在: domain/missing");
  });
  const webContents = { isDestroyed: () => false, send: vi.fn() };

  await (
    new PiAgentHost(root, undefined, finalizer) as unknown as {
      sendMessage: (command: unknown, webContents: unknown) => Promise<void>;
    }
  ).sendMessage(
    {
      type: "message.send",
      sessionId: thread.id,
      text: "放在哪里",
      contextRefs: [{ type: "domain", id: "domain_1", title: "三观" }],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    },
    webContents as never,
  );

  const events = await new AgentSessionLog(root).readEvents(thread.id);
  expect(events.find((event) => event.type === "assistant.turn")).toMatchObject({
    blocks: [
      {
        kind: "text",
        text: "",
        state: "failed",
        error: "引用实体不存在: domain/missing",
      },
    ],
  });
  expect(events.find((event) => event.type === "run.failed")).toMatchObject({
    error: "引用实体不存在: domain/missing",
  });
});
```

- [ ] **Step 5: Run host tests and verify they fail**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-run-accumulator.test.ts src/main/services/agent/pi-agent-host.test.ts
```

Expected: FAIL because `PiAgentHost` has no finalizer injection and still emits Pi text as final text.

- [ ] **Step 6: Wire finalizer into PiAgentHost**

In `apps/electron/src/main/services/agent/pi-agent-host.ts`, import finalizer APIs:

```ts
import {
  createPiAiFinalizerStream,
  runAgentFinalizer,
  type RunAgentFinalizerInput,
  type RunAgentFinalizerResult,
} from "./agent-finalizer";
```

Add type near `AssistantTurnMetadata`:

```ts
type AgentFinalizer = (
  input: RunAgentFinalizerInput,
  modelConfig: ResolvedAiModelConfig,
) => Promise<RunAgentFinalizerResult>;
```

Update constructor:

```ts
  constructor(
    private readonly contentStorageRoot = getContentStorageRoot(),
    private readonly titleGenerator = generateAgentThreadTitle,
    private readonly finalizer: AgentFinalizer = defaultAgentFinalizer,
  ) {
    this.sessionLog = new AgentSessionLog(contentStorageRoot);
  }
```

Add default finalizer near `configurePiRuntimeAuth`:

```ts
async function finalizerApiKey(modelConfig: ResolvedAiModelConfig): Promise<string> {
  return modelConfig.catalog.authType === "codex"
    ? (await getCodexCredentials()).accessToken
    : modelConfig.provider.apiKey;
}

async function defaultAgentFinalizer(
  input: RunAgentFinalizerInput,
  modelConfig: ResolvedAiModelConfig,
): Promise<RunAgentFinalizerResult> {
  return runAgentFinalizer(input, {
    streamJson: createPiAiFinalizerStream({
      modelConfig,
      apiKey: await finalizerApiKey(modelConfig),
    }),
  });
}
```

In `createSession`, keep the resolved model config available to `sendMessage`:

```ts
const created = await createAgentSession({
  agentDir,
  authStorage,
  customTools: [
    ...createPiReadOnlyTools(command.files, {
      collectToolOutput: (toolName, toolCallId, output) =>
        entityCatalog.collectToolOutput(toolName, toolCallId, output),
    }),
    ...createPiWriteTools({
      onApproval: ({ toolCallId }) => this.waitForToolApproval(command.sessionId, toolCallId),
    }),
  ],
  cwd: this.contentStorageRoot,
  model,
  modelRegistry,
  resourceLoader: createPiResourceLoader(),
  sessionManager,
  settingsManager,
  thinkingLevel: thinkingLevelFor(command.reasoningLevel ?? getActiveAgentReasoningLevel()),
  tools: [...PI_READ_ONLY_TOOL_NAMES, ...PI_APPROVAL_TOOL_NAMES],
});
return { ...created, modelConfig };
```

In `sendMessage`, read the model config from `createSession` and rename `assistantText` to `piDraftText`:

```ts
const created = await this.createSession(command, manager, entityCatalog);
session = created.session;
const modelConfig = created.modelConfig;
```

For Pi `text_delta`, keep the draft but stop emitting live answer text:

```ts
if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
  piDraftText += event.assistantMessageEvent.delta;
  assistantActivity = true;
  return;
}
```

For `message_end && !piDraftText`, keep fallback draft only:

```ts
if (event.type === "message_end" && !piDraftText) {
  const finalText = extractAssistantText(event.message);
  if (!finalText) return;
  piDraftText = finalText;
  assistantActivity = true;
}
```

After `await session.prompt(...)` and before emitting `assistant.turn`, run finalizer:

```ts
const finalAnswer = await this.finalizer(
  {
    userQuestion: command.text,
    piDraftText,
    toolResults: accumulator.toolResults(),
    entityCatalog: entityCatalog.snapshot(),
    requiresEntityRefs: entityCatalog.snapshot().length > 0,
    onPartial: (partial) => {
      const event = this.createEvent({
        type: "assistant.final.partial",
        sessionId: command.sessionId,
        runId,
        messageId: assistantMessageId,
        ...partial,
      });
      accumulator.append(event);
      this.emitLive(webContents, event);
    },
  },
  modelConfig,
);

accumulator.appendFinalAnswer({
  id: `evt_${nanoid()}`,
  sessionId: command.sessionId,
  runId,
  messageId: assistantMessageId,
  createdAt: new Date().toISOString(),
  ...finalAnswer,
});
```

Replace the existing `catch (error)` body in `sendMessage` with this body:

```ts
} catch (error) {
  emitRunStarted();
  if (this.cancelledRunIds.has(runId)) return;
  const errorText = formatAgentError(error);
  const finalFailed = this.createEvent({
    type: "assistant.final.failed",
    sessionId: command.sessionId,
    runId,
    messageId: assistantMessageId,
    error: errorText,
  });
  accumulator.append(finalFailed);
  this.emitLive(webContents, finalFailed);
  emit(
    accumulator.toAssistantTurn(
      this.createEvent({
        type: "assistant.turn",
        sessionId: command.sessionId,
        runId,
        messageId: assistantMessageId,
        blocks: [],
        text: "",
        ...assistantMetadata,
      }),
    ),
  );
  emit(this.createEvent({ type: "run.failed", sessionId: command.sessionId, runId, error: errorText }));
}
```

This body keeps the existing `agentLog.error(...)` behavior and additionally persists the failed final answer block before `run.failed`.

- [ ] **Step 7: Add tool result collection to accumulator**

In `apps/electron/src/main/services/agent/agent-run-accumulator.ts`, add:

```ts
  toolResults(): unknown[] {
    return this.blocks.flatMap((block) =>
      block.kind === "tool" && block.state === "completed" && block.output !== undefined
        ? [block.output]
        : block.kind === "approval" &&
            block.executionState === "completed" &&
            block.output !== undefined
          ? [block.output]
          : [],
    );
  }
```

- [ ] **Step 8: Remove optional final-answer tool from Pi session**

In `apps/electron/src/main/services/agent/pi-agent-host.ts`:

- Remove `REFLECTA_FINAL_ANSWER_TOOL_NAME`.
- Remove `isReflectaFinalAnswerTool`.
- Remove `agentTextPartFrom`.
- Remove `finalAnswerPartsFromInput`.
- Remove `createReflectaFinalAnswerTool`.
- Remove `pendingFinalAnswerInputs`.
- Remove final-answer tool handling inside `tool_execution_start` and `tool_execution_end`.
- Remove `createReflectaFinalAnswerTool()` from `customTools`.
- Remove `REFLECTA_FINAL_ANSWER_TOOL_NAME` from `tools`.

Replace the system prompt final-answer instruction in `apps/electron/src/main/services/agent/agent-system-prompt.md` with:

```md
最终回答由 Reflecta 系统整理。你在普通正文里不要手写 `<entity_ref>`、JSON、YAML、`[[ref:*]]`、`U1/D1/[1]` 等引用协议；如果需要表达依据，只用自然语言说明你参考了哪些结果。
```

- [ ] **Step 9: Run host tests and verify they pass**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-run-accumulator.test.ts src/main/services/agent/pi-agent-host.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
rtk git add apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/agent-run-accumulator.ts apps/electron/src/main/services/agent/agent-run-accumulator.test.ts apps/electron/src/main/services/agent/agent-system-prompt.md
rtk git commit -m "feat(agent): finalize responses through streaming finalizer"
```

## 10. Task 7: Add User-Facing E2E Coverage

**Files:**

- Modify: `apps/electron/e2e/agent/features/structured-results.feature`
- Modify: `apps/electron/e2e/agent/agent-fixture-store.ts`
- Modify: `apps/electron/e2e/agent/structured-results.spec.ts`

- [ ] **Step 1: Add feature scenarios**

Append to `apps/electron/e2e/agent/features/structured-results.feature`:

```gherkin
  @P1 @context @AG-RESULT-006
  场景: 用户查看 Agent 最终答案中的结构化知识库引用
    假如 seed 数据中存在 Domain「三观」
    而且对话中有一条 Agent 最终答案引用了 Domain「三观」
    当用户打开该对话
    那么 Agent 最终答案中应该显示 Domain「三观」引用
    而且页面不应该显示该 Domain 的裸 id

  @P1 @error @AG-RESULT-007
  场景: 用户查看最终答案生成失败原因
    假如对话中有一条 Agent 回复的最终答案生成失败
    当用户打开该对话
    那么该 Agent 回复应该显示最终答案失败状态
    而且该失败状态应该说明失败原因
```

- [ ] **Step 2: Extend fixture store text block metadata**

In `apps/electron/e2e/agent/agent-fixture-store.ts`, replace `appendTextBlock` with:

```ts
function appendTextBlock(
  blocks: Record<string, unknown>[],
  kind: string,
  text: string,
  createdAt: string,
  parts?: unknown[],
  state?: unknown,
  previewText?: unknown,
  error?: unknown,
) {
  const last = blocks.at(-1);
  if (
    !parts &&
    !state &&
    !previewText &&
    !error &&
    last?.kind === kind &&
    typeof last.text === "string" &&
    !Array.isArray(last.parts)
  ) {
    last.text += text;
    return;
  }
  blocks.push({
    kind,
    text,
    ...(parts ? { parts } : {}),
    ...(typeof state === "string" ? { state } : {}),
    ...(typeof previewText === "string" ? { previewText } : {}),
    ...(typeof error === "string" ? { error } : {}),
    createdAt,
  });
}
```

Update the text part call in `assistantTurnBlocks`:

```ts
appendTextBlock(
  blocks,
  "text",
  String(part.text ?? ""),
  createdAt,
  Array.isArray(part.parts) ? part.parts : undefined,
  part.state,
  part.previewText,
  part.error,
);
```

- [ ] **Step 3: Add Playwright tests**

Append to `apps/electron/e2e/agent/structured-results.spec.ts`:

```ts
test("@AG-RESULT-006 用户查看 Agent 最终答案中的结构化知识库引用", async () => {
  seedAgentThread({
    id: "result-finalizer-entity-ref",
    title: "Finalizer 引用",
    entityCatalog: [
      {
        key: "domain:domain_three_views",
        entity: { type: "domain", id: "domain_three_views", title: "三观" },
        origin: { kind: "tool_result", toolCallId: "tool_domain", toolName: "domain_inspect" },
      },
    ],
    messages: [
      userMessage("result-finalizer-entity-ref-user", "放在哪里"),
      assistantMessage("result-finalizer-entity-ref-assistant", [
        {
          type: "text",
          text: "可以放在三观下面。",
          parts: [
            { type: "text", text: "可以放在" },
            {
              type: "entity_ref",
              entityType: "domain",
              entityId: "domain_three_views",
              fallbackText: "三观",
            },
            { type: "text", text: "下面。" },
          ],
        },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "Finalizer 引用");
    const wikiLink = page.locator('[data-slot="wiki-link"]').filter({ hasText: "三观" });
    await expect(wikiLink).toBeVisible();
    await expect(page.getByText("domain_three_views")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("@AG-RESULT-007 用户查看最终答案生成失败原因", async () => {
  seedAgentThread({
    id: "result-finalizer-failed",
    title: "Finalizer 失败",
    messages: [
      userMessage("result-finalizer-failed-user", "根据知识库回答"),
      assistantMessage("result-finalizer-failed-assistant", [
        {
          type: "text",
          text: "",
          state: "failed",
          error: "引用实体不存在: domain/missing",
        },
      ]),
    ],
  });
  const { app, page } = await launchAgentPage();

  try {
    await openThread(page, "Finalizer 失败");
    await expect(page.getByTestId("agent-final-answer-error")).toContainText(
      "引用实体不存在: domain/missing",
    );
  } finally {
    await app.close();
  }
});
```

- [ ] **Step 4: Run targeted E2E and verify it passes**

Run:

```bash
rtk bun --cwd apps/electron test:e2e -- agent/structured-results.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add apps/electron/e2e/agent/features/structured-results.feature apps/electron/e2e/agent/agent-fixture-store.ts apps/electron/e2e/agent/structured-results.spec.ts
rtk git commit -m "test(agent): cover finalizer result rendering"
```

## 11. Task 8: Run Full Verification

**Files:**

- Verify only.

- [ ] **Step 1: Run main process tests**

Run:

```bash
rtk bun --cwd apps/electron test:main
```

Expected: PASS.

- [ ] **Step 2: Run renderer tests**

Run:

```bash
rtk bun --cwd apps/electron test:renderer
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
rtk bun --cwd apps/electron typecheck
```

Expected: PASS.

- [ ] **Step 4: Run E2E suite**

Run:

```bash
rtk bun --cwd apps/electron test:e2e
```

Expected: PASS.

- [ ] **Step 5: Commit verification-only doc note if needed**

If no files changed after verification, do not create an empty commit. If formatter or test snapshots changed files, commit them:

```bash
rtk git status --short
rtk git add apps/electron/src/main/services/agent apps/electron/src/renderer/src/modules/chat apps/electron/e2e/agent
rtk git commit -m "test(agent): verify streaming finalizer"
```

## 12. Self-review checklist for implementers

- The final answer is not produced by Pi `assistant.text.delta`.
- Raw structured JSON never reaches renderer state.
- `previewText` is never parsed into entity refs.
- Invalid `entity_ref` id fails, not fallback.
- Missing required entity refs fails, not fallback.
- `assistant.turn` snapshot contains only validated `parts`.
- Active run restore includes streaming finalizer partials.
- `reflecta_final_answer` optional tool is removed from the Pi tool list.
- E2E covers final structured entity refs and finalizer failure visibility.
