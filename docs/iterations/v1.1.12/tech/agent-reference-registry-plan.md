# Agent Entity Source Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace assistant-generated `[[context:标题#id]]` links with session-scoped `[[ref:S1]]` source markers that render to real Reflecta Understanding / Context / Domain entities without asking the model to copy database ids.

**Architecture:** `AgentHost` owns source identity: it assigns `S1`, `S2`, persists `entity.sources.updated` events, and exposes source markers in prompt/tool output where real objects already appear. `Renderer` owns text parsing and real-time rendering: it resolves `[[ref:S1]]` against the reduced session source map and renders the existing chips during streaming and final display. No global database table, no full registry block dumped into every prompt, and no AgentHost parsing of final assistant text.

**Tech Stack:** Electron main/renderer, TypeScript, Vitest, Streamdown, Pi agent runtime, existing Reflecta session JSONL log.

---

## Scope

This plan only implements entity links. It does not implement claim-level citations, content grounding validation, citation scores, or automatic proof that the assistant chose the semantically correct source. The system guarantees that a resolved marker opens the exact Reflecta entity stored in the session source map.

## Current Problem

Current prompt contract asks the model to write:

```md
[[understanding:标题#id]]
[[context:标题#id]]
[[domain:标题#id]]
```

That makes the model responsible for copying `type` and `id` into free text. The reported bug is exactly there: the object was known, but the model produced or the renderer interpreted the wrong `type:id`, so a Context id opened as an Understanding and showed a blank detail view.

The new contract is:

```md
[[ref:S1]]
```

`S1` is only meaningful inside one Agent session. The source map owns the real target:

```ts
S1 -> { type: "context", id: "ctx_456", title: "一次产品迭代复盘" }
```

## File Structure

- Modify: `apps/electron/src/preload/typings/agent.ts`
  - Adds `AgentEntitySource`, `entity.sources.updated`, and `AgentSessionState.entitySources`.
  - Reduces source events during session replay and live streaming.

- Create: `apps/electron/src/preload/typings/agent-entity-sources.ts`
  - Pure helper for source keys, source id allocation, source upsert, source marker formatting, and prompt lines.
  - Shared by main and renderer through existing `@shared/*` path alias.

- Modify: `apps/electron/src/preload/typings/agent-context.ts`
  - Adds a source-based prompt block so selected user `@` refs can be rendered as `[[ref:S1]]` instead of exposing real ids.

- Create: `apps/electron/src/main/services/agent/entity-source-extraction.ts`
  - Extracts Reflecta entities from supported read-only tool outputs.
  - Decorates matching entities in tool output with `ref: "[[ref:S1]]"` after registration.

- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
  - Accepts a lightweight output decorator option.
  - Returns decorated tool details to the model.

- Modify: `apps/electron/src/main/services/agent/pi-prompt.ts`
  - Builds prompt text from `AgentEntitySource[]` for selected context refs.

- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
  - Creates the per-run source registrar.
  - Emits `entity.sources.updated` events when user refs or tool outputs register sources.
  - Passes decorated read-only tools into the Pi session.

- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`
  - Changes assistant-visible link contract to `[[ref:S1]]`.

- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`
  - Fixes typed legacy link parsing.
  - Converts `[[ref:S1]]` to internal hrefs using the reduced source map.

- Modify: `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`
  - Renders source-resolved Understanding / Context chips and non-clickable Domain chips.

- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
  - Passes `entitySources` into markdown conversion for streaming and final blocks.

- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.tsx`
  - Threads `entitySources` into each assistant message row.

- Modify: `apps/electron/src/renderer/src/modules/chat/session/thread-view.ts`
  - Adds `entitySources` to `AgentThreadView`.

- Modify: `apps/electron/src/renderer/src/modules/chat/session/pi-thread-view.ts`
  - Exposes `state.entitySources` to the thread view.

- Modify: `apps/electron/src/renderer/src/modules/chat/agent-thread-panel.tsx`
  - Passes `threadView.entitySources` into `MessageList`.

## Task 1: Add Shared Entity Source Types And Reducer State

**Files:**

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Create: `apps/electron/src/preload/typings/agent-entity-sources.ts`
- Test: `apps/electron/src/preload/typings/agent-entity-sources.test.ts`
- Test: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`

- [ ] **Step 1: Write the source helper test**

Create `apps/electron/src/preload/typings/agent-entity-sources.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  entitySourceKey,
  sourceMarker,
  sourcePromptLine,
  upsertAgentEntitySources,
} from "./agent-entity-sources";
import type { AgentEntitySource } from "./agent";

describe("agent entity sources", () => {
  test("allocates stable source ids per entity and updates the title", () => {
    const origin = { kind: "user_context" as const, messageId: "user_1" };
    const first = upsertAgentEntitySources(
      [],
      [{ type: "context", id: "ctx_1", title: "旧标题" }],
      origin,
    );
    const second = upsertAgentEntitySources(
      first.sources,
      [{ type: "context", id: "ctx_1", title: "新标题" }],
      { kind: "tool_result" as const, toolCallId: "tool_1", toolName: "context_get" },
    );

    expect(first.changed).toBe(true);
    expect(first.sources).toEqual([
      {
        sourceId: "S1",
        entity: { type: "context", id: "ctx_1", title: "旧标题" },
        origin,
      },
    ]);
    expect(second.changed).toBe(true);
    expect(second.sources).toEqual([
      {
        sourceId: "S1",
        entity: { type: "context", id: "ctx_1", title: "新标题" },
        origin,
      },
    ]);
  });

  test("formats source markers and prompt lines", () => {
    const source: AgentEntitySource = {
      sourceId: "S2",
      entity: { type: "understanding", id: "u_1", title: "Feedback Loop" },
      origin: { kind: "user_context", messageId: "user_1" },
    };

    expect(entitySourceKey(source.entity)).toBe("understanding:u_1");
    expect(sourceMarker(source)).toBe("[[ref:S2]]");
    expect(sourcePromptLine(source)).toBe("- [[ref:S2]] Understanding: Feedback Loop");
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/preload/typings/agent-entity-sources.test.ts
```

Expected: FAIL because `agent-entity-sources.ts` does not exist.

- [ ] **Step 3: Add shared types to `agent.ts`**

In `apps/electron/src/preload/typings/agent.ts`, add these types after `AgentContextRef`:

```ts
export type AgentEntitySourceOrigin =
  | {
      kind: "user_context";
      messageId?: string;
    }
  | {
      kind: "page_context";
      messageId?: string;
    }
  | {
      kind: "tool_result";
      toolCallId?: string;
      toolName?: string;
    };

export type AgentEntitySource = {
  sourceId: string;
  entity: AgentContextRef;
  origin: AgentEntitySourceOrigin;
};
```

Add the session event after `AgentUserMessage`:

```ts
export type AgentEntitySourcesUpdated = AgentEventBase & {
  type: "entity.sources.updated";
  sources: AgentEntitySource[];
};
```

Add `AgentEntitySourcesUpdated` to `AgentSessionEvent`:

```ts
export type AgentSessionEvent =
  | AgentRunStarted
  | AgentRunCompleted
  | AgentRunFailed
  | AgentRunCancelled
  | AgentUserMessage
  | AgentEntitySourcesUpdated
  | AgentAssistantTurn
  | AgentApprovalRequested
  | AgentApprovalResolved;
```

Add `entitySources` to `AgentSessionState`:

```ts
export type AgentSessionState = {
  sessionId: string | null;
  messages: AgentReducedMessage[];
  entitySources: AgentEntitySource[];
  activeRunId: string | null;
  status: "idle" | "running" | "failed" | "cancelled";
  error: string | null;
};
```

Add `"entity.sources.updated"` to `isAgentSessionEvent()`:

```ts
[
  "run.started",
  "run.completed",
  "run.failed",
  "run.cancelled",
  "user.message",
  "entity.sources.updated",
  "assistant.turn",
  "approval.requested",
  "approval.resolved",
].includes(value.type);
```

Add this reducer helper before `initialAgentSessionState`:

```ts
function mergeEntitySources(
  current: AgentEntitySource[],
  incoming: AgentEntitySource[],
): AgentEntitySource[] {
  const bySourceId = new Map(current.map((source) => [source.sourceId, source]));
  for (const source of incoming) bySourceId.set(source.sourceId, source);
  return Array.from(bySourceId.values()).sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId, undefined, { numeric: true }),
  );
}
```

Set the initial state:

```ts
export const initialAgentSessionState: AgentSessionState = {
  sessionId: null,
  messages: [],
  entitySources: [],
  activeRunId: null,
  status: "idle",
  error: null,
};
```

Add this branch in `reduceAgentSessionEvent()` after `user.message`:

```ts
if (event.type === "entity.sources.updated") {
  return {
    ...state,
    sessionId: event.sessionId,
    entitySources: mergeEntitySources(state.entitySources, event.sources),
  };
}
```

- [ ] **Step 4: Create the shared source helper**

Create `apps/electron/src/preload/typings/agent-entity-sources.ts`:

```ts
import type { AgentContextRef, AgentEntitySource, AgentEntitySourceOrigin } from "./agent";

const SOURCE_ID_PATTERN = /^S(\d+)$/;

function titleFor(ref: AgentContextRef) {
  return ref.title?.trim() || `${ref.type}:${ref.id}`;
}

function typeLabel(type: AgentContextRef["type"]) {
  if (type === "understanding") return "Understanding";
  if (type === "context") return "Context";
  return "Domain";
}

function nextSourceId(sources: AgentEntitySource[]) {
  const max = sources.reduce((value, source) => {
    const match = SOURCE_ID_PATTERN.exec(source.sourceId);
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `S${max + 1}`;
}

export function entitySourceKey(ref: AgentContextRef) {
  return `${ref.type}:${ref.id}`;
}

export function sourceMarker(source: Pick<AgentEntitySource, "sourceId">) {
  return `[[ref:${source.sourceId}]]`;
}

export function sourcePromptLine(source: AgentEntitySource) {
  return `- ${sourceMarker(source)} ${typeLabel(source.entity.type)}: ${titleFor(source.entity)}`;
}

export function resolveAgentEntitySource(
  sources: AgentEntitySource[],
  sourceId: string,
): AgentEntitySource | null {
  return sources.find((source) => source.sourceId === sourceId) ?? null;
}

export function upsertAgentEntitySources(
  sources: AgentEntitySource[],
  refs: AgentContextRef[],
  origin: AgentEntitySourceOrigin,
): { sources: AgentEntitySource[]; changed: boolean; upserted: AgentEntitySource[] } {
  let changed = false;
  const upserted: AgentEntitySource[] = [];
  const byEntity = new Map(sources.map((source) => [entitySourceKey(source.entity), source]));
  const next = [...sources];

  for (const ref of refs) {
    const key = entitySourceKey(ref);
    const existing = byEntity.get(key);
    if (existing) {
      const nextTitle = ref.title?.trim();
      if (nextTitle && nextTitle !== existing.entity.title) {
        const updated = { ...existing, entity: { ...existing.entity, title: nextTitle } };
        const index = next.findIndex((source) => source.sourceId === existing.sourceId);
        next[index] = updated;
        byEntity.set(key, updated);
        upserted.push(updated);
        changed = true;
      } else {
        upserted.push(existing);
      }
      continue;
    }

    const created: AgentEntitySource = {
      sourceId: nextSourceId(next),
      entity: { ...ref, title: ref.title?.trim() || undefined },
      origin,
    };
    next.push(created);
    byEntity.set(key, created);
    upserted.push(created);
    changed = true;
  }

  return { sources: next, changed, upserted };
}
```

- [ ] **Step 5: Add reducer coverage for source replay**

Add this test to `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`:

```ts
test("restores entity sources from session events", () => {
  const state = reduceAgentSession([
    {
      ...base,
      id: "evt_source_1",
      type: "entity.sources.updated",
      sources: [
        {
          sourceId: "S1",
          entity: { type: "context", id: "ctx_1", title: "一次复盘" },
          origin: { kind: "user_context", messageId: "user_1" },
        },
      ],
    },
    {
      ...base,
      id: "evt_source_2",
      type: "entity.sources.updated",
      sources: [
        {
          sourceId: "S1",
          entity: { type: "context", id: "ctx_1", title: "一次产品复盘" },
          origin: { kind: "user_context", messageId: "user_1" },
        },
      ],
    },
  ]);

  expect(state.entitySources).toEqual([
    {
      sourceId: "S1",
      entity: { type: "context", id: "ctx_1", title: "一次产品复盘" },
      origin: { kind: "user_context", messageId: "user_1" },
    },
  ]);
});
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/preload/typings/agent-entity-sources.test.ts src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent.ts apps/electron/src/preload/typings/agent-entity-sources.ts apps/electron/src/preload/typings/agent-entity-sources.test.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts
rtk git commit -m "feat(agent): persist entity source map"
```

## Task 2: Render Selected User Context As Source Markers In Prompt

**Files:**

- Modify: `apps/electron/src/preload/typings/agent-context.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.ts`
- Modify: `apps/electron/src/main/services/agent/pi-prompt.test.ts`

- [ ] **Step 1: Write the failing prompt test**

Replace the first test in `apps/electron/src/main/services/agent/pi-prompt.test.ts` with:

```ts
test("injects selected entity sources without exposing database ids", () => {
  const prompt = buildPiPromptText({
    text: "请比较这些引用",
    contextSources: [
      {
        sourceId: "S1",
        entity: {
          type: "understanding",
          id: "understanding-1",
          title: "React Server Components",
        },
        origin: { kind: "user_context", messageId: "user_1" },
      },
      {
        sourceId: "S2",
        entity: { type: "domain", id: "domain-1", title: "React" },
        origin: { kind: "user_context", messageId: "user_1" },
      },
    ],
  });

  expect(prompt).toContain("请比较这些引用");
  expect(prompt).toContain("[[ref:S1]] Understanding: React Server Components");
  expect(prompt).toContain("[[ref:S2]] Domain: React");
  expect(prompt).toContain("轻量引用");
  expect(prompt).not.toContain("understanding-1");
  expect(prompt).not.toContain("domain-1");
});
```

- [ ] **Step 2: Run the prompt test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-prompt.test.ts
```

Expected: FAIL because `buildPiPromptText()` does not accept `contextSources`.

- [ ] **Step 3: Add the source prompt block helper**

In `apps/electron/src/preload/typings/agent-context.ts`, import `AgentEntitySource` and `sourcePromptLine`:

```ts
import type { AgentContextRef, AgentEntitySource } from "./agent";
import { sourcePromptLine } from "./agent-entity-sources";
```

Add this function after `selectedAgentContextBlockFromRefs()`:

```ts
export function selectedAgentContextBlockFromSources(sources: AgentEntitySource[]): string {
  if (sources.length === 0) return "";

  const lines = sources.slice(0, MAX_SELECTED_CONTEXT_REFS).map(sourcePromptLine).join("\n");
  return `\n\n用户显式 @ 了这些知识库对象。它们只是轻量引用，不包含完整内容；需要内容时调用对应只读工具读取。正文引用对象时只使用 [[ref:S1]] 这种 ref，不要输出真实数据库 id。\n${lines}`;
}
```

- [ ] **Step 4: Update prompt builder**

In `apps/electron/src/main/services/agent/pi-prompt.ts`, change the import:

```ts
import type { AgentEntitySource, AgentFileAttachment } from "@shared/agent";
import { selectedAgentContextBlockFromSources } from "@shared/agent-context";
```

Change `buildPiPromptText()` to:

```ts
export function buildPiPromptText({
  text,
  contextSources = [],
  files = [],
}: {
  text: string;
  contextSources?: AgentEntitySource[];
  files?: AgentFileAttachment[];
}): string {
  return `${text}${selectedAgentContextBlockFromSources(contextSources)}${attachmentBlockFromFiles(files)}`;
}
```

- [ ] **Step 5: Run the prompt test**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/electron/src/preload/typings/agent-context.ts apps/electron/src/main/services/agent/pi-prompt.ts apps/electron/src/main/services/agent/pi-prompt.test.ts
rtk git commit -m "feat(agent): prompt selected sources as refs"
```

## Task 3: Extract And Decorate Entity Sources From Read-Only Tool Output

**Files:**

- Create: `apps/electron/src/main/services/agent/entity-source-extraction.ts`
- Test: `apps/electron/src/main/services/agent/entity-source-extraction.test.ts`

- [ ] **Step 1: Write the extraction test**

Create `apps/electron/src/main/services/agent/entity-source-extraction.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  annotateToolOutputWithEntityRefs,
  extractEntityRefsFromToolOutput,
} from "./entity-source-extraction";
import type { AgentContextRef, AgentEntitySource, AgentEntitySourceOrigin } from "@shared/agent";

function register(ref: AgentContextRef, origin: AgentEntitySourceOrigin): AgentEntitySource {
  return {
    sourceId: ref.type === "understanding" ? "S1" : "S2",
    entity: ref,
    origin,
  };
}

describe("entity source extraction", () => {
  test("extracts understanding_get and context_get entities", () => {
    expect(
      extractEntityRefsFromToolOutput("understanding_get", {
        understanding: { id: "u_1", title: "Feedback Loop" },
      }),
    ).toEqual([{ type: "understanding", id: "u_1", title: "Feedback Loop" }]);

    expect(
      extractEntityRefsFromToolOutput("context_get", {
        context: { id: "ctx_1", title: "一次复盘" },
      }),
    ).toEqual([{ type: "context", id: "ctx_1", title: "一次复盘" }]);
  });

  test("extracts and decorates retrieve_knowledge nested entities", () => {
    const output = {
      candidates: [
        {
          understanding: { id: "u_1", title: "Feedback Loop" },
          matchedContexts: [{ id: "ctx_1", title: "一次复盘" }],
        },
      ],
    };

    expect(extractEntityRefsFromToolOutput("retrieve_knowledge", output)).toEqual([
      { type: "understanding", id: "u_1", title: "Feedback Loop" },
      { type: "context", id: "ctx_1", title: "一次复盘" },
    ]);

    expect(
      annotateToolOutputWithEntityRefs("retrieve_knowledge", "tool_1", output, register),
    ).toEqual({
      candidates: [
        {
          understanding: { id: "u_1", title: "Feedback Loop", ref: "[[ref:S1]]" },
          matchedContexts: [{ id: "ctx_1", title: "一次复盘", ref: "[[ref:S2]]" }],
        },
      ],
    });
  });
});
```

- [ ] **Step 2: Run the extraction test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/entity-source-extraction.test.ts
```

Expected: FAIL because `entity-source-extraction.ts` does not exist.

- [ ] **Step 3: Create the extractor**

Create `apps/electron/src/main/services/agent/entity-source-extraction.ts`:

```ts
import type { AgentContextRef, AgentEntitySource, AgentEntitySourceOrigin } from "@shared/agent";
import { entitySourceKey, sourceMarker } from "@shared/agent-entity-sources";

type RegisterEntitySource = (
  ref: AgentContextRef,
  origin: AgentEntitySourceOrigin,
) => AgentEntitySource;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function entityRef(type: AgentContextRef["type"], value: unknown): AgentContextRef | null {
  if (!isRecord(value)) return null;
  const id = stringField(value, "id");
  if (!id) return null;
  return { type, id, title: stringField(value, "title") };
}

function collectContextArray(value: unknown, refs: AgentContextRef[]): void {
  if (!Array.isArray(value)) {
    collectNestedEntities(value, refs);
    return;
  }
  for (const item of value) {
    const context = entityRef("context", item);
    if (context) refs.push(context);
    collectNestedEntities(item, refs);
  }
}

function collectNestedEntities(value: unknown, refs: AgentContextRef[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectNestedEntities(item, refs);
    return;
  }
  if (!isRecord(value)) return;

  const understanding = entityRef("understanding", value.understanding);
  if (understanding) refs.push(understanding);

  const context = entityRef("context", value.context);
  if (context) refs.push(context);

  if (typeof value.type === "string") {
    const typed = entityRef(value.type as AgentContextRef["type"], value);
    if (
      typed &&
      (typed.type === "understanding" || typed.type === "context" || typed.type === "domain")
    ) {
      refs.push(typed);
    }
  }

  if ("matchedContexts" in value) collectContextArray(value.matchedContexts, refs);
  if ("contexts" in value) collectContextArray(value.contexts, refs);
  if ("hits" in value) collectNestedEntities(value.hits, refs);
  if ("candidates" in value) collectNestedEntities(value.candidates, refs);
  if ("nodes" in value) collectNestedEntities(value.nodes, refs);
}

function dedupeRefs(refs: AgentContextRef[]): AgentContextRef[] {
  const byKey = new Map<string, AgentContextRef>();
  for (const ref of refs) byKey.set(entitySourceKey(ref), ref);
  return Array.from(byKey.values());
}

export function extractEntityRefsFromToolOutput(
  toolName: string,
  output: unknown,
): AgentContextRef[] {
  const refs: AgentContextRef[] = [];
  if (toolName === "understanding_get" && isRecord(output)) {
    const ref = entityRef("understanding", output.understanding);
    if (ref) refs.push(ref);
  }
  if (toolName === "context_get" && isRecord(output)) {
    const ref = entityRef("context", output.context);
    if (ref) refs.push(ref);
  }
  if (
    toolName === "search" ||
    toolName === "retrieve_knowledge" ||
    toolName === "understanding_list" ||
    toolName === "context_list" ||
    toolName === "domain_inspect" ||
    toolName === "graph"
  ) {
    collectNestedEntities(output, refs);
  }
  return dedupeRefs(refs);
}

function sourceForRecord(
  value: Record<string, unknown>,
  sourcesByEntityKey: Map<string, AgentEntitySource>,
): AgentEntitySource | undefined {
  const id = stringField(value, "id");
  if (!id) return undefined;
  if (typeof value.type === "string") {
    const typed = sourcesByEntityKey.get(`${value.type}:${id}`);
    if (typed) return typed;
  }
  return (
    sourcesByEntityKey.get(`understanding:${id}`) ??
    sourcesByEntityKey.get(`context:${id}`) ??
    sourcesByEntityKey.get(`domain:${id}`)
  );
}

function annotateValue(
  value: unknown,
  sourcesByEntityKey: Map<string, AgentEntitySource>,
): unknown {
  if (Array.isArray(value)) return value.map((item) => annotateValue(item, sourcesByEntityKey));
  if (!isRecord(value)) return value;

  const source = sourceForRecord(value, sourcesByEntityKey);
  const entries = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, annotateValue(item, sourcesByEntityKey)]),
  );
  return source ? { ...entries, ref: sourceMarker(source) } : entries;
}

export function annotateToolOutputWithEntityRefs(
  toolName: string,
  toolCallId: string,
  output: unknown,
  register: RegisterEntitySource,
): unknown {
  const sources = extractEntityRefsFromToolOutput(toolName, output).map((ref) =>
    register(ref, { kind: "tool_result", toolCallId, toolName }),
  );
  const sourcesByEntityKey = new Map(
    sources.map((source) => [entitySourceKey(source.entity), source]),
  );
  return annotateValue(output, sourcesByEntityKey);
}
```

- [ ] **Step 4: Run the extraction test**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/entity-source-extraction.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/entity-source-extraction.ts apps/electron/src/main/services/agent/entity-source-extraction.test.ts
rtk git commit -m "feat(agent): extract entity refs from tools"
```

## Task 4: Register Sources In AgentHost And Decorate Tool Results

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Test: `apps/electron/src/main/services/agent/pi-prompt.test.ts`

- [ ] **Step 1: Write the failing read-only tool decorator test**

Add this test to `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts` after `executes retrieve_knowledge through the retrieval seam`:

```ts
test("decorates retrieve_knowledge output before returning it to the model", async () => {
  const result = { candidates: [{ understanding: { id: "u_1", title: "Feedback Loop" } }] };
  services.retrieveKnowledge.mockResolvedValue(result);
  const tool = createPiReadOnlyTools([], {
    decorateToolOutput: (toolName, toolCallId, details) => ({
      toolName,
      toolCallId,
      details,
      decorated: true,
    }),
  }).find((item) => item.name === "retrieve_knowledge");
  expect(tool).toBeDefined();

  const execute = tool!.execute as unknown as (
    toolCallId: string,
    params: Record<string, unknown>,
  ) => Promise<{ details: unknown }>;
  const output = await execute("tool-call-1", { query: "agent 标准", limit: 3 });

  expect(output.details).toEqual({
    toolName: "retrieve_knowledge",
    toolCallId: "tool-call-1",
    details: result,
    decorated: true,
  });
});
```

- [ ] **Step 2: Run the decorator test and verify it fails**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-readonly-tools.test.ts -t "decorates retrieve_knowledge output"
```

Expected: FAIL because `createPiReadOnlyTools()` does not accept a second options argument.

- [ ] **Step 3: Update read-only tool factory to allow output decoration**

In `apps/electron/src/main/services/agent/pi-readonly-tools.ts`, add this type near the imports:

```ts
export type PiReadOnlyToolsOptions = {
  decorateToolOutput?: (toolName: string, toolCallId: string, details: unknown) => unknown;
};
```

Replace `toolResult()` with:

```ts
function toolResult(details: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
    details,
  };
}

function decoratedToolResult(
  options: PiReadOnlyToolsOptions,
  toolName: string,
  toolCallId: unknown,
  details: unknown,
) {
  const id = typeof toolCallId === "string" ? toolCallId : "";
  const decorated = options.decorateToolOutput?.(toolName, id, details) ?? details;
  return toolResult(decorated);
}
```

Change the factory signature:

```ts
export function createPiReadOnlyTools(
  files: AgentFileAttachment[] = [],
  options: PiReadOnlyToolsOptions = {},
): ToolDefinition[] {
```

For `understanding_get`, change execute to:

```ts
      execute: async (toolCallId, { understandingId, includeRelations, ...optionsInput }) =>
        decoratedToolResult(
          options,
          "understanding_get",
          toolCallId,
          await understandingCliService.getUnderstanding(understandingId, {
            ...optionsInput,
            includeRelations,
          }),
        ),
```

For `context_get`, change execute to:

```ts
      execute: async (toolCallId, { contextId }) =>
        decoratedToolResult(
          options,
          "context_get",
          toolCallId,
          await contextCliService.getContext(contextId),
        ),
```

For `retrieve_knowledge`, change execute to:

```ts
      execute: async (toolCallId, { query, limit }) =>
        decoratedToolResult(
          options,
          "retrieve_knowledge",
          toolCallId,
          await searchCliService.retrieveKnowledge({ query, limit }),
        ),
```

Keep `domain_list`, `domain_inspect`, `understanding_list`, `context_list`, `attachment_read`, `file_read`, `web_fetch`, and `graph` on their current `toolResult()` path in this version.

- [ ] **Step 4: Add source registrar plumbing to AgentHost**

In `apps/electron/src/main/services/agent/pi-agent-host.ts`, update imports:

```ts
import { upsertAgentEntitySources } from "@shared/agent-entity-sources";
import type { AgentContextRef, AgentEntitySource, AgentEntitySourceOrigin } from "@shared/agent";
import { annotateToolOutputWithEntityRefs } from "./entity-source-extraction";
```

Extend `ActivePiRun`:

```ts
type ActivePiRun = {
  runId: string;
  session: AgentSession;
  accumulator: AgentRunAccumulator;
  pendingApprovals: Map<string, PendingApproval>;
  entitySources: AgentEntitySource[];
};
```

Change `createSession()` signature:

```ts
  private async createSession(
    command: Extract<AgentCommand, { type: "message.send" }>,
    sessionManager: SessionManager,
    options: {
      decorateToolOutput?: (toolName: string, toolCallId: string, details: unknown) => unknown;
    } = {},
  ) {
```

Pass options to read-only tools:

```ts
        ...createPiReadOnlyTools(command.files, {
          decorateToolOutput: options.decorateToolOutput,
        }),
```

- [ ] **Step 5: Register user context refs before prompting**

Inside `sendMessage()`, after `const emit = (event: AgentSessionEvent) => this.appendAndEmit(manager, webContents, event);`, add:

```ts
let entitySources = reduceAgentSession(
  await this.sessionLog.readEvents(command.sessionId),
).entitySources;
const registerEntitySources = (
  refs: AgentContextRef[],
  origin: AgentEntitySourceOrigin,
): AgentEntitySource[] => {
  const result = upsertAgentEntitySources(entitySources, refs, origin);
  entitySources = result.sources;
  if (result.changed) {
    emit(
      this.createEvent({
        type: "entity.sources.updated",
        sessionId: command.sessionId,
        runId,
        sources: entitySources,
      }),
    );
  }
  return result.upserted;
};
const registerEntitySource = (
  ref: AgentContextRef,
  origin: AgentEntitySourceOrigin,
): AgentEntitySource => registerEntitySources([ref], origin)[0];
```

When setting `activeRuns`, include `entitySources`:

```ts
this.activeRuns.set(command.sessionId, {
  runId,
  session,
  accumulator,
  pendingApprovals: new Map(),
  entitySources,
});
```

Before `session.prompt(...)`, register command refs:

```ts
const selectedContextSources = registerEntitySources(command.contextRefs ?? [], {
  kind: "user_context",
  messageId: userMessageId,
});
```

Change prompt call to:

```ts
await session.prompt(
  buildPiPromptText({
    text: command.text,
    contextSources: selectedContextSources,
    files: command.files,
  }),
);
```

- [ ] **Step 6: Decorate tool output before it reaches the model**

Change the `createSession()` call in `sendMessage()`:

```ts
const created = await this.createSession(command, manager, {
  decorateToolOutput: (toolName, toolCallId, details) =>
    annotateToolOutputWithEntityRefs(toolName, toolCallId, details, registerEntitySource),
});
```

In the `tool_execution_end` branch, keep using `piToolOutput(event.result)` for UI events. The tool result already contains `ref` fields because decoration happened inside the tool execution.

- [ ] **Step 7: Run focused main tests**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-prompt.test.ts src/main/services/agent/entity-source-extraction.test.ts src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/pi-readonly-tools.ts apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-prompt.ts apps/electron/src/main/services/agent/pi-prompt.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
rtk git commit -m "feat(agent): register entity sources during runs"
```

## Task 5: Render `[[ref:S1]]` In Streaming And Final Markdown

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/message-list.tsx`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/thread-view.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/pi-thread-view.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/agent-thread-panel.tsx`

- [ ] **Step 1: Write parser tests for typed and source links**

Replace the last test in `apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts` with:

```ts
test("builds and parses typed assistant wiki links", () => {
  const href = wikiHref({ type: "context", id: "context-1", title: "一次复盘" });

  expect(parseWikiHref(href)).toEqual({
    type: "context",
    id: "context-1",
    title: "一次复盘",
  });
  expect(parseWikiHref("#elsewhere")).toBeNull();
  expect(wikiMarkdownToLinks("关联 [[context:一次复盘#context-1]]")).toBe(
    `关联 [一次复盘](${href})`,
  );
});

test("renders known source markers and leaves unknown source markers unchanged", () => {
  const sources = [
    {
      sourceId: "S1",
      entity: { type: "understanding" as const, id: "u_1", title: "Feedback Loop" },
      origin: { kind: "user_context" as const, messageId: "user_1" },
    },
  ];

  expect(wikiMarkdownToLinks("引用 [[ref:S1]]", sources)).toBe(
    `引用 [Feedback Loop](${wikiHref({ type: "understanding", id: "u_1", title: "Feedback Loop" })})`,
  );
  expect(wikiMarkdownToLinks("引用 [[ref:S999]]", sources)).toBe("引用 [[ref:S999]]");
});
```

- [ ] **Step 2: Run parser tests and verify they fail**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/context/context-reference.test.ts
```

Expected: FAIL because `wikiHref()` still takes `(title, id)` and source marker rendering does not exist.

- [ ] **Step 3: Update context reference parsing**

In `apps/electron/src/renderer/src/modules/chat/context/context-reference.ts`, replace the wiki constants and functions from `WIKI_LINK_PATTERN` through `parseWikiHref()` with:

```ts
const TYPED_WIKI_LINK_PATTERN = /\[\[(understanding|context|domain):([^#\]\n]+)#([^\]\n]+)\]\]/g;
const SOURCE_REF_PATTERN = /\[\[ref:(S\d+)\]\]/g;
export const WIKI_LINK_HREF_PREFIX = "#reflecta-wiki/";

function sourceTitle(ref: AgentContextRef) {
  return ref.title?.trim() || `${ref.type}:${ref.id}`;
}

export function wikiHref(ref: AgentContextRef) {
  return `${WIKI_LINK_HREF_PREFIX}${ref.type}/${encodeURIComponent(ref.id)}?title=${encodeURIComponent(sourceTitle(ref))}`;
}

export function wikiMarkdownToLinks(markdown: string, sources: AgentEntitySource[] = []) {
  const sourcesById = new Map(sources.map((source) => [source.sourceId, source]));
  return markdown
    .replace(
      TYPED_WIKI_LINK_PATTERN,
      (_match, type: AgentContextRef["type"], title: string, id: string) => {
        return `[${title}](${wikiHref({ type, id, title })})`;
      },
    )
    .replace(SOURCE_REF_PATTERN, (match, sourceId: string) => {
      const source = sourcesById.get(sourceId);
      if (!source) return match;
      return `[${sourceTitle(source.entity)}](${wikiHref(source.entity)})`;
    });
}

export function parseWikiHref(href: string | undefined): AgentContextRef | null {
  if (!href?.startsWith(WIKI_LINK_HREF_PREFIX)) return null;
  try {
    const paramsIndex = href.indexOf("?");
    const path = href.slice(
      WIKI_LINK_HREF_PREFIX.length,
      paramsIndex === -1 ? href.length : paramsIndex,
    );
    const slashIndex = path.indexOf("/");
    if (slashIndex < 1) return null;
    const type = path.slice(0, slashIndex);
    const encodedId = path.slice(slashIndex + 1);
    if (type !== "understanding" && type !== "context" && type !== "domain") return null;
    const params = new URLSearchParams(paramsIndex === -1 ? "" : href.slice(paramsIndex + 1));
    const id = decodeURIComponent(encodedId);
    const title = params.get("title") ?? undefined;
    if (!id) return null;
    return { type, id, title };
  } catch {
    return null;
  }
}
```

Add `AgentEntitySource` to the import:

```ts
import type { AgentContextRef, AgentEntitySource } from "@shared/agent";
```

- [ ] **Step 4: Allow non-clickable Domain chips**

In `apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx`, change `WikiLinkChip` props to accept `AgentContextRef`:

```ts
import type { AgentContextRef } from "@shared/agent";
```

Change the component signature:

```ts
export function WikiLinkChip({
  ref,
  onInspect,
}: {
  ref: AgentContextRef;
  onInspect?: (ref: InspectableContextRef) => void;
}) {
```

Inside `WikiLinkChip`, derive inspectability:

```ts
const inspectableRef = inspectableContextRef(ref);
```

Replace the clickable branch condition with:

```ts
  if (!onInspect || !inspectableRef) {
    return (
      <span data-slot="wiki-link" className={className}>
        {content}
      </span>
    );
  }
```

Change the button click:

```tsx
      onClick={() => onInspect(inspectableRef)}
```

Import `inspectableContextRef` from `context-reference.ts`.

- [ ] **Step 5: Thread entity sources through renderer props**

Add `entitySources: AgentEntitySource[]` to `AgentThreadView` in `apps/electron/src/renderer/src/modules/chat/session/thread-view.ts`.

In `apps/electron/src/renderer/src/modules/chat/session/pi-thread-view.ts`, import `AgentEntitySource` through the existing shared import and return:

```ts
    entitySources: state.entitySources,
```

In `apps/electron/src/renderer/src/modules/chat/agent-thread-panel.tsx`, pass:

```tsx
              entitySources={threadView.entitySources}
```

to `MessageList`.

In `apps/electron/src/renderer/src/modules/chat/messages/message-list.tsx`, import `AgentEntitySource` and add `entitySources` to `MessageList`, `MessageRowProps`, and `MessageRowComponent`. Pass it into `AgentMessageContent`:

```tsx
<AgentMessageContent
  message={message}
  turn={turn}
  entitySources={entitySources}
  isBusy={isBusy}
  isLastAssistant={isLastAssistant}
  stopped={stopped}
  onApproveTool={onApproveTool}
  onInspectContextRef={onInspectContextRef}
/>
```

In `apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx`, import `AgentEntitySource`, add `entitySources` to `MarkdownBody` props, and call:

```tsx
{
  wikiMarkdownToLinks(value, entitySources);
}
```

Pass `entitySources` into every `MarkdownBody` call inside `AgentMessageContent` for assistant text, reasoning details, tool details, and proposal bodies.

- [ ] **Step 6: Run focused renderer tests**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/renderer/src/modules/chat/context/context-reference.test.ts src/renderer/src/modules/chat/session/agent-reducer.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/electron/src/renderer/src/modules/chat/context/context-reference.ts apps/electron/src/renderer/src/modules/chat/context/context-reference.test.ts apps/electron/src/renderer/src/modules/chat/context/wiki-link.tsx apps/electron/src/renderer/src/modules/chat/messages/agent-message-content.tsx apps/electron/src/renderer/src/modules/chat/messages/message-list.tsx apps/electron/src/renderer/src/modules/chat/session/thread-view.ts apps/electron/src/renderer/src/modules/chat/session/pi-thread-view.ts apps/electron/src/renderer/src/modules/chat/agent-thread-panel.tsx
rtk git commit -m "feat(agent): render entity source markers"
```

## Task 6: Migrate The Agent Prompt Contract

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`

- [ ] **Step 1: Replace the chat reference section**

In `apps/electron/src/main/services/agent/agent-system-prompt.md`, replace `## 聊天正文引用格式` section with:

```md
## 聊天正文引用格式

面向用户的聊天正文引用 Reflecta 已有对象时，只能使用系统已经提供的 source ref：

- 正确：`[[ref:S1]]`
- 错误：`[[understanding:标题#id]]`
- 错误：`[[context:标题#id]]`
- 错误：直接输出真实数据库 id

source ref 会出现在用户 @ 的对象或工具结果里，例如 `[[ref:S1]] Understanding: Feedback Loop`。如果对象没有 source ref，先使用只读工具搜索或读取。source ref 只是轻量引用，不代表你已经读取了完整内容；需要真实内容时仍然先调用对应只读工具。

不要把聊天正文引用格式和持久化 Markdown 格式混用。
```

- [ ] **Step 2: Run prompt-related tests**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/pi-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add apps/electron/src/main/services/agent/agent-system-prompt.md
rtk git commit -m "docs(agent): require source refs in assistant text"
```

## Task 7: Full Verification

**Files:**

- No new files.

- [ ] **Step 1: Run formatting**

Run:

```bash
rtk bun run fmt:check
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
rtk bun run lint
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
rtk bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run Electron tests**

Run:

```bash
rtk bun --cwd apps/electron run test
```

Expected: PASS.

- [ ] **Step 5: Manual smoke test in dev GUI**

Run:

```bash
rtk bun run dev:gui
```

Manual check:

```txt
1. Open an Agent thread.
2. @ mention one Understanding.
3. Ask: “这个理解和相关 Context 有什么关系？”
4. During streaming, any known [[ref:S1]] marker renders as a chip once source state exists.
5. Final answer still renders the same chip.
6. Click Understanding chip and confirm Understanding detail opens.
7. Ask Agent to retrieve related knowledge.
8. Confirm tool-result entities can be referenced as [[ref:S2]] and Context chip opens Context detail.
9. Reload the app and reopen the same thread.
10. Confirm previous [[ref:S1]] chips still render and click correctly.
```

- [ ] **Step 6: Commit verification-only fixes**

If verification required code fixes, commit them:

```bash
rtk git status --short
rtk git add apps/electron/src
rtk git commit -m "fix(agent): stabilize entity source references"
```

If verification changed no files, do not create an empty commit.

## Acceptance Criteria

- Assistant text no longer needs `[[understanding:标题#id]]` or `[[context:标题#id]]` for new replies.
- User-selected refs are exposed to the model as `[[ref:S1]]` prompt lines.
- Supported read-only tool outputs that contain Reflecta entities include `ref` fields.
- `entity.sources.updated` events persist source maps in session JSONL.
- Renderer replay restores source maps after switching threads or restarting the app.
- Streaming text and final assistant text use the same `[[ref:S1]]` renderer path.
- Unknown source markers remain plain text and never open an inspector.
- Legacy typed links parse their real type; `[[context:标题#id]]` does not open as Understanding.

## Self-Review Notes

- Spec coverage: tasks cover source storage, source creation timing, prompt usage, tool result usage, streaming render, session replay, legacy typed link compatibility, and verification.
- Placeholder scan: no banned placeholder terms, no unowned option list, no final-text AgentHost annotation pass.
- Type consistency: the same names are used throughout: `AgentEntitySource`, `AgentEntitySourcesUpdated`, `entity.sources.updated`, `entitySources`, `[[ref:S1]]`.

## References

- [OpenAI File Search](https://developers.openai.com/api/docs/guides/tools-file-search)
- [OpenAI Citation Formatting](https://developers.openai.com/api/docs/guides/citation-formatting)
