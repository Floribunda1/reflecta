# Agent Tool Identity and Failure State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent tool calls use stable Reflecta entity ids directly, and make approved tool execution failures first-class session/UI/diagnostic events.

**Architecture:** Tool-facing identity becomes the same stable entity id used by Reflecta services today. Chat refs remain a rendering/navigation convenience, not a hidden alias table that tools must pass around. Tool approval and tool execution become separate states so `approval.resolved` never implies success.

**Tech Stack:** Electron main process, Pi coding agent tools, TypeScript shared Agent session events, SQLite-backed Reflecta domain services, Vitest, Electron E2E fixtures.

---

## 1. Problem

The production session `019f1431-3228-70cf-8527-89242fc94156` exposed two coupled defects.

First, Agent-visible entity identity is inconsistent. Read-only tools and prompts expose session-scoped markers such as `[[ref:rf_fjxcezk5az]]`, while write tools expect true domain ids such as `s11qsWP-wgjU2Jn-0lX3b`. The model tried `rf_fjxcezk5az`, `[[ref:rf_fjxcezk5az]]`, and `fjxcezk5az`; all failed with `Domain not found`.

Second, approved write failures are not legible enough. `approval.resolved approved=true` is logged, but the actual write failure mainly appears as a Pi `toolResult` message. The session has enough data to debug manually, but the product event model does not make the failed tool execution obvious.

## 2. Architecture Decision

Use stable Reflecta entity ids as the Agent tool protocol.

```json
{
  "id": "s11qsWP-wgjU2Jn-0lX3b",
  "type": "domain",
  "ref": "[[domain:s11qsWP-wgjU2Jn-0lX3b]]",
  "name": "三观"
}
```

Tool calls use `id` fields:

```json
{
  "title": "面对负面情绪：先减法，后加法",
  "body": "...",
  "domainIds": ["s11qsWP-wgjU2Jn-0lX3b"]
}
```

Refs are only for chat text and renderer navigation:

```md
这个理解适合放在 [[domain:s11qsWP-wgjU2Jn-0lX3b]]。
```

The Agent runtime can still keep lightweight session metadata for rendering titles and resolving clicked refs, but the metadata no longer owns identity translation. There should be no model-visible `rf_*` source id that pretends to be an entity id.

## 3. Non-Goals

- Do not introduce `domainRefs`, `understandingRef`, or `contextRef` as write-tool parameters.
- Do not make server domain services understand chat ref syntax.
- Do not keep `rf_*` source ids as model-facing entity identity.
- Do not build claim-level citations or evidence verification.
- Do not change Reflecta's database id generation unless a later import/export requirement proves current ids are insufficient.

## 4. Target Model

### 4.1 Entity Output Shape

Every Agent-facing tool output that returns an entity should expose:

```ts
type AgentFacingEntity = {
  id: string;
  type: "understanding" | "context" | "domain";
  ref: string;
  title?: string;
  name?: string;
};
```

Rules:

- `id` is the stable Reflecta entity id accepted by write tools and service calls.
- `ref` is renderer syntax derived from `type` and `id`.
- `title` / `name` is display only.
- Existing tool-specific fields stay, but raw `id` must no longer be stripped from model-facing output.

### 4.2 Chat Ref Syntax

Use typed refs with real ids:

```txt
[[understanding:w6mEdXcCtuVAWdLlgvBXs]]
[[context:ctx_id_here]]
[[domain:s11qsWP-wgjU2Jn-0lX3b]]
```

Renderer behavior:

- Resolve by `type + id`.
- If the entity exists, render the existing clickable entity chip.
- If the entity no longer exists, render disabled/plain text.
- Do not guess by title.

### 4.3 Prompt Contract

Replace the current `[[ref:...]]` contract with:

```txt
Reflecta tools return stable entity ids. Use those ids exactly in tool calls.

When writing chat text, use the entity's `ref` field exactly as returned by tools or selected context.
Do not invent ids. Do not use ids that have not appeared in the current conversation, selected context, or tool results.
```

This keeps the model's interface simple: tools use `id`, prose uses `ref`.

## 5. Tool Failure State Model

Approval and execution are separate facts.

```txt
approval.requested
approval.resolved approved=true
tool.execution.started
tool.execution.completed | tool.execution.failed
```

`approval.resolved approved=true` means only:

```txt
The user allowed the tool to run.
```

It does not mean:

```txt
The write succeeded.
```

### 5.1 Session Events

Add durable semantic events for approved tool execution:

```ts
type AgentToolExecutionStarted = AgentEventBase & {
  type: "tool.execution.started";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  input?: unknown;
};

type AgentToolExecutionCompleted = AgentEventBase & {
  type: "tool.execution.completed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  output?: unknown;
};

type AgentToolExecutionFailed = AgentEventBase & {
  type: "tool.execution.failed";
  runId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  error: string;
};
```

These events are durable because approved write execution can happen after a user command and must be recoverable independently of a currently streaming model response.

### 5.2 Assistant Turn Blocks

The rendered assistant turn should still show one coherent tool/proposal block. Reducers derive the block state from approval and execution events:

```ts
type AgentToolBlockState = "pending_approval" | "rejected" | "running" | "completed" | "failed";
```

Mapping:

- `approval.requested` -> `pending_approval`
- `approval.resolved approved=false` -> `rejected`
- `tool.execution.started` -> `running`
- `tool.execution.completed` -> `completed`
- `tool.execution.failed` -> `failed`

### 5.3 Diagnostic Logging

Every `tool.execution.failed` event must write a diagnostic event with:

```json
{
  "event": "agent.tool.execution.failed",
  "scope": "agent",
  "context": {
    "sessionId": "...",
    "runId": "...",
    "messageId": "...",
    "toolCallId": "..."
  },
  "attrs": {
    "toolName": "understanding_update",
    "error": "Domain not found: s11qs..."
  }
}
```

The debugging path should be:

```txt
diagnostic log -> session event -> assistant turn block
```

not:

```txt
raw Pi message -> toolResult text grep
```

## 6. File Structure

Modify these files:

- `apps/electron/src/main/services/agent/agent-entity-sources.ts`
  - Stop replacing entity `id` with session-scoped `ref`.
  - Produce typed chat refs derived from real ids.
  - Keep only display metadata helpers that are still needed by renderer/session replay.
- `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
  - Return entity outputs with `id` and typed `ref`.
  - Keep resolving legacy `ref` input temporarily where tools already support it.
- `apps/electron/src/main/services/agent/pi-write-tools.ts`
  - Keep `understandingId`, `domainIds`, `contextId`, and `domainId` as real id fields.
  - Improve parameter descriptions to say these are stable ids returned by tools.
  - Do not accept `[[ref:...]]` as write input.
- `apps/electron/src/main/services/agent/pi-agent-host.ts`
  - Emit durable `tool.execution.*` events around approved tool execution.
  - Feed execution result back to Pi as before.
  - Write diagnostic logs for execution failures.
- `apps/electron/src/preload/typings/agent.ts`
  - Add `tool.execution.started/completed/failed` event types.
  - Add explicit block state union if not already central.
- `apps/electron/src/preload/typings/agent-context.ts`
  - Render selected context lines with real ids and typed refs.
- `apps/electron/src/main/services/agent/agent-system-prompt.md`
  - Replace the `[[ref:...]]` contract with stable id + typed chat ref contract.
- `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
  - Update expected output to retain `id`.
- `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`
  - Cover read tool outputs exposing ids and refs.
- `apps/electron/src/main/services/agent/pi-write-tools.test.ts`
  - Cover tool descriptions and real id pass-through.
- `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
  - Cover approved tool success and failure event sequences.
- `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
  - Cover restoring failed approved tool execution.
- `apps/electron/e2e/agent/pi-session.spec.ts`
  - Cover a production-like failed write showing failed state instead of only approval resolved.

## 7. Implementation Tasks

### Task 1: Document and Type the New Tool Identity Contract

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-system-prompt.md`
- Modify: `apps/electron/src/preload/typings/agent.ts`
- Test: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`

- [ ] **Step 1: Update the system prompt contract**

Replace the chat ref section with wording equivalent to:

```md
## Reflecta Entity Identity

Reflecta tools return stable entity ids. Use those ids exactly in tool calls.

When writing chat text, use the entity's `ref` field exactly as returned by tools or selected context.
Do not invent ids. Do not use ids that have not appeared in the current conversation, selected context, or tool results.

Correct tool input:
`domainIds: ["s11qsWP-wgjU2Jn-0lX3b"]`

Correct chat text:
`[[domain:s11qsWP-wgjU2Jn-0lX3b]]`

Incorrect:
`[[ref:rf_fjxcezk5az]]`, `rf_fjxcezk5az`, title-only references, or guessed ids.
```

- [ ] **Step 2: Add shared event types**

Add `AgentToolExecutionStarted`, `AgentToolExecutionCompleted`, and `AgentToolExecutionFailed` to `apps/electron/src/preload/typings/agent.ts`, then include them in the session event union.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @reflecta/electron typecheck
```

Expected: existing type errors only if the repo already has them; otherwise PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/electron/src/main/services/agent/agent-system-prompt.md apps/electron/src/preload/typings/agent.ts
git commit -m "docs: define agent entity identity contract"
```

### Task 2: Keep Real Entity IDs in Model-Facing Tool Output

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-entity-sources.ts`
- Modify: `apps/electron/src/main/services/agent/pi-readonly-tools.ts`
- Test: `apps/electron/src/main/services/agent/agent-entity-sources.test.ts`
- Test: `apps/electron/src/main/services/agent/pi-readonly-tools.test.ts`

- [ ] **Step 1: Write failing tests for decorated outputs**

Update tests so a decorated `domain_list` item keeps `id` and gets a typed `ref`:

```ts
expect(decorated).toEqual({
  domains: [
    {
      id: "domain_1",
      ref: "[[domain:domain_1]]",
      name: "三观",
      parentId: null,
    },
  ],
});
```

For `understanding_get`, expected output should keep:

```ts
{
  id: "u_1",
  ref: "[[understanding:u_1]]",
  title: "Feedback Loop",
  body: "body",
  domainIds: ["domain_1"],
  domainRefs: ["[[domain:domain_1]]"]
}
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: FAIL because current code strips `id` and emits `[[ref:...]]`.

- [ ] **Step 3: Change decoration behavior**

In `AgentEntitySourceRegistry.decorateEntityObject`, stop removing `id`. Emit:

```ts
return {
  id: String(value.id),
  ref: this.entityRef(type, String(value.id)),
  ...(isRecord(decoratedRest) ? decoratedRest : rest),
};
```

Add:

```ts
private entityRef(type: AgentEntityType, id: string): string {
  return `[[${type}:${id}]]`;
}
```

For relationship ids, keep original id fields and add parallel ref fields where useful:

```ts
domainIds: ["domain_1"],
domainRefs: ["[[domain:domain_1]]"]
```

- [ ] **Step 4: Keep registry only where still needed**

If the registry no longer needs session-scoped source ids for identity, reduce it to title/display metadata and backwards compatibility helpers. Do not expose generated `rf_*` values to model-facing tool output.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/electron/src/main/services/agent/agent-entity-sources.ts apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts
git commit -m "fix: expose stable entity ids to agent tools"
```

### Task 3: Keep Write Tool Inputs as Real IDs

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-write-tools.ts`
- Test: `apps/electron/src/main/services/agent/pi-write-tools.test.ts`

- [ ] **Step 1: Add tests for tool descriptions**

Assert write tool parameter descriptions mention stable ids returned by Reflecta tools:

```ts
expect(understandingCreate.parameters).toMatchObject({
  properties: {
    domainIds: expect.objectContaining({
      description: expect.stringContaining("stable Domain ids"),
    }),
  },
});
```

- [ ] **Step 2: Add pass-through tests**

Keep the existing behavior that calls services with real ids:

```ts
await execute("tool-call-1", {
  title: "A",
  body: "B",
  domainIds: ["domain_1"],
});

expect(services.createUnderstanding).toHaveBeenCalledWith({
  title: "A",
  body: "B",
  domainIds: ["domain_1"],
});
```

- [ ] **Step 3: Run focused test and confirm failures where descriptions are missing**

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-write-tools.test.ts
```

Expected: FAIL only on missing descriptions if pass-through already works.

- [ ] **Step 4: Update parameter descriptions**

Change `domainIdsParameter` to include a description:

```ts
const domainIdsParameter = Type.Optional(
  Type.Array(Type.String(), {
    description: "Stable Domain ids returned by Reflecta tools. Do not pass chat refs.",
  }),
);
```

Add similar descriptions for `understandingId`, `domainId`, `parentId`, and `contextId`.

- [ ] **Step 5: Run focused test**

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-write-tools.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/electron/src/main/services/agent/pi-write-tools.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts
git commit -m "fix: clarify write tool id contract"
```

### Task 4: Add Durable Approved Tool Execution Events

**Files:**

- Modify: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Modify: `apps/electron/src/main/services/agent/pi-session-log.ts`
- Test: `apps/electron/src/main/services/agent/pi-agent-host.test.ts`
- Test: `apps/electron/src/main/services/agent/pi-session-log.test.ts`

- [ ] **Step 1: Write success sequence test**

In `pi-agent-host.test.ts`, approve a pending write tool and assert the session events include:

```ts
expect(eventTypes).toEqual(
  expect.arrayContaining([
    "approval.resolved",
    "tool.execution.started",
    "tool.execution.completed",
  ]),
);
```

Assert `tool.execution.completed.output` contains the decorated result.

- [ ] **Step 2: Write failure sequence test**

Mock `executePiApprovedTool` to reject with:

```ts
new Error("Domain not found: domain_1");
```

Assert events include:

```ts
expect(eventTypes).toEqual(
  expect.arrayContaining(["approval.resolved", "tool.execution.started", "tool.execution.failed"]),
);
```

Assert:

```ts
expect(failedEvent.error).toBe("Domain not found: domain_1");
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-agent-host.test.ts
```

Expected: FAIL because `tool.execution.*` events do not exist yet.

- [ ] **Step 4: Emit execution events around approved tool execution**

In `resolveToolApproval`, after `approval.resolved approved=true`, append `tool.execution.started` before calling `executeApprovedTool`.

On success, append `tool.execution.completed`.

On failure, append `tool.execution.failed` and still reject/resolve the Pi pending approval in the way Pi expects so the model receives the tool error.

- [ ] **Step 5: Mirror execution failures to diagnostic logs**

Update `pi-session-log.ts` mirroring so `tool.execution.failed` writes an error-level diagnostic event with `toolName`, `toolCallId`, and `error`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/electron/src/main/services/agent/pi-agent-host.ts apps/electron/src/main/services/agent/pi-session-log.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts
git commit -m "fix: persist approved tool execution failures"
```

### Task 5: Render Failed Approved Tools Correctly

**Files:**

- Modify: `apps/electron/src/preload/typings/agent.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts`
- Modify: `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts`
- Test: `apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts`

- [ ] **Step 1: Write reducer test for failed execution**

Given:

```ts
[
  { type: "approval.requested", toolName: "understanding_update", toolCallId: "tool_1" },
  { type: "approval.resolved", approved: true, toolCallId: "tool_1" },
  { type: "tool.execution.started", toolName: "understanding_update", toolCallId: "tool_1" },
  {
    type: "tool.execution.failed",
    toolName: "understanding_update",
    toolCallId: "tool_1",
    error: "Domain not found: domain_1",
  },
];
```

Assert the reduced assistant block has:

```ts
{
  kind: "approval",
  toolName: "understanding_update",
  state: "failed",
  error: "Domain not found: domain_1"
}
```

- [ ] **Step 2: Write view test for failed state**

Assert the tool/proposal card displays a failed label and the error text, not a pending approval state.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
pnpm vitest run apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

Expected: FAIL because execution events are not reduced/rendered yet.

- [ ] **Step 4: Update reducer**

Handle `tool.execution.started/completed/failed` by matching `toolCallId` and updating the existing approval/tool block state.

- [ ] **Step 5: Update view labels**

For failed approved tools, show the same failed visual treatment used by normal failed tool blocks. Keep the error expandable/copyable if that pattern already exists.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/electron/src/preload/typings/agent.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
git commit -m "fix: show failed approved tools in agent chat"
```

### Task 6: Update E2E Fixtures and Production Regression Path

**Files:**

- Modify: `apps/electron/e2e/agent/agent-fixture-store.ts`
- Modify: `apps/electron/e2e/agent/pi-session.spec.ts`
- Optional Modify: `apps/cli/scripts/seed-test-data.ts`

- [ ] **Step 1: Add failed approved write fixture**

Create a fixture run with:

```txt
approval.requested -> approval.resolved approved=true -> tool.execution.started -> tool.execution.failed
```

Use error:

```txt
Domain not found: rf_fjxcezk5az
```

This preserves the exact production symptom while testing the new state model.

- [ ] **Step 2: Add E2E assertion**

Assert the restored chat shows a failed tool state for the approved proposal and includes the error text.

- [ ] **Step 3: Run E2E target**

Run:

```bash
pnpm --filter @reflecta/electron e2e -- apps/electron/e2e/agent/pi-session.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/electron/e2e/agent/agent-fixture-store.ts apps/electron/e2e/agent/pi-session.spec.ts apps/cli/scripts/seed-test-data.ts
git commit -m "test: cover approved tool execution failure recovery"
```

### Task 7: Clean Up Legacy `rf_*` Identity Assumptions

**Files:**

- Modify: `docs/iterations/v1.1.12/tech/agent-entity-link-architecture.md`
- Modify: `docs/iterations/v1.1.12/tech/agent-entity-reference-research.md`
- Modify: `docs/iterations/v1.1.15/README.md`
- Search: all `apps/electron/src/**` references to `[[ref:` and `sourceId`

- [ ] **Step 1: Search for generated source id assumptions**

Run:

```bash
rg -n "\\[\\[ref:|sourceId|rf_" apps/electron/src docs/iterations/v1.1.12 docs/iterations/v1.1.15
```

Expected: only backwards compatibility code/tests and historical docs retain old wording.

- [ ] **Step 2: Mark v1.1.12 docs as superseded**

Add a short note at the top of v1.1.12 entity-link docs:

```md
> Superseded by v1.1.15 for Agent tool identity. v1.1.12's session-scoped `[[ref:Sx]]` source map remains useful historical context, but v1.1.15 uses stable entity ids for model-facing tool protocols.
```

- [ ] **Step 3: Keep backwards compatibility parser only where needed**

If old session logs contain `[[ref:rf_*]]`, keep a renderer fallback that displays them as plain unresolved text unless a persisted source map can resolve them. Do not let that fallback affect new tool outputs.

- [ ] **Step 4: Commit**

```bash
git add docs/iterations/v1.1.12/tech/agent-entity-link-architecture.md docs/iterations/v1.1.12/tech/agent-entity-reference-research.md docs/iterations/v1.1.15/README.md
git commit -m "docs: supersede session scoped agent refs"
```

## 8. Verification

Run:

```bash
pnpm vitest run apps/electron/src/main/services/agent/agent-entity-sources.test.ts apps/electron/src/main/services/agent/pi-readonly-tools.test.ts apps/electron/src/main/services/agent/pi-write-tools.test.ts apps/electron/src/main/services/agent/pi-agent-host.test.ts apps/electron/src/main/services/agent/pi-session-log.test.ts apps/electron/src/renderer/src/modules/chat/session/agent-reducer.test.ts apps/electron/src/renderer/src/modules/chat/messages/agent-turn-view.test.ts
```

Expected: PASS.

Run:

```bash
pnpm --filter @reflecta/electron typecheck
```

Expected: PASS.

Run:

```bash
pnpm --filter @reflecta/electron e2e -- apps/electron/e2e/agent/pi-session.spec.ts
```

Expected: PASS.

## 9. Acceptance Criteria

- `domain_list`, `domain_inspect`, `understanding_get`, `understanding_list`, `context_get`, and `context_list` expose stable real ids to the model.
- Write tools continue to accept `understandingId`, `contextId`, `domainId`, and `domainIds` as real ids.
- New model-facing outputs do not contain generated `rf_*` source ids.
- Chat text refs are typed and real-id based: `[[domain:<id>]]`, `[[understanding:<id>]]`, `[[context:<id>]]`.
- Approving a write tool emits `approval.resolved` and then explicit execution state.
- Approved write failures produce `tool.execution.failed`, diagnostic log entries, and failed UI state.
- Production-style `Domain not found` failures are visible from session reducer output without grepping raw Pi messages.
- Legacy sessions still render without crashing; unresolved old refs are non-clickable.

## 10. Self-Review

Spec coverage:

- Stable real ids replace `rf_*` as tool identity: covered by Tasks 1, 2, 3, and 7.
- `ref` remains display/navigation only: covered by Tasks 1 and 2.
- Tool failed state included: covered by Tasks 4, 5, and 6.
- Documentation saved under `docs/iterations/v1.1.15`: this document and README.

Placeholder scan:

- Task text has no unresolved marker words.
- Each task names exact files, commands, and expected outcomes.

Type consistency:

- Entity id fields remain `understandingId`, `contextId`, `domainId`, and `domainIds`.
- New execution event names consistently use `tool.execution.started/completed/failed`.
