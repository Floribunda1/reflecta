# Final Answer Object Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Reflecta finalizer 从“prompt-only JSON”改成按 provider 能力生成、校验、失败可解释的 Final Answer Object Generator。

**Architecture:** 不再改正文引用格式，也不再增加正文 parser。`PiAgentHost` 继续收集 Pi Agent 草稿、工具结果和 entity catalog；`agent-finalizer.ts` 作为唯一 final-answer object generation module，根据 provider payload 选择 `json_schema` 或 `json_object`，再用 AJV 与 catalog 做本地校验，最终只把 validated `AgentTextPart[]` 交给 renderer。

**Tech Stack:** Electron main process、Pi AI `stream(..., { onPayload })`、OpenAI Responses JSON schema、OpenAI-compatible Chat Completions JSON mode、DeepSeek JSON Output、AJV、Vitest、Playwright E2E。

---

## 0. 这版结论

这次不再换引用格式。`FinalAnswer.parts` 仍然是唯一产品协议：

```ts
type FinalAnswer = {
  parts: Array<
    | { type: "text"; text: string }
    | {
        type: "entity_ref";
        entityType: "understanding" | "context" | "domain";
        entityId: string;
        fallbackText?: string;
      }
  >;
};
```

真正要改的是 finalizer 的 provider object generation 层：

```text
Pi Agent draft
  -> Final Answer Object Generator
     -> OpenAI Responses / Azure Responses: json_schema
     -> OpenAI-compatible Chat Completions: json_object + AJV validate
     -> unsupported API: explicit finalizer failure
  -> validate entity_ref.entityId against entityCatalog
  -> renderer renders validated AgentTextPart[]
```

当前 bug 的直接原因是 `opencode-go/deepseek-v4-flash` 这类 `openai-completions` provider 被 `withFinalAnswerStructuredOutput()` 放行成 prompt-only JSON。模型返回了自然语言正文，`finalAnswerFromRawJson()` 仍然 `JSON.parse`，于是用户看到 `Unexpected token '好'`。

## 1. 社区依据

- Vercel AI SDK 的 `Output.object({ schema })` 是一个对象生成抽象：schema 用于生成结果校验，失败时抛 `NoObjectGeneratedError`，并保留 raw text、response、usage、cause。来源：[AI SDK Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)。
- Vercel AI SDK 的 OpenAI-compatible provider 也显式区分能力：`supportsStructuredOutputs` 打开时才是 strict structured outputs；否则仍要依赖 provider 支持的 JSON / tool 能力并做本地校验。来源：[AI SDK OpenAI Compatible Providers](https://ai-sdk.dev/providers/openai-compatible-providers)。
- DeepSeek 官方支持 JSON Output：`response_format: { "type": "json_object" }`，同时要求 prompt 包含 `json` 指令和示例，并设置合理 `max_tokens`。它保证有效 JSON，不保证严格 schema，所以 Reflecta 必须继续 AJV 校验。来源：[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode)。

## 2. 文件结构

### 只改 main-process finalizer

- Modify: `apps/electron/src/main/services/agent/agent-finalizer.ts`
- Modify: `apps/electron/src/main/services/agent/agent-finalizer.test.ts`

### 验证，不改协议

- Read-only check: `apps/electron/src/main/services/agent/pi-agent-host.ts`
- Read-only check: `apps/electron/e2e/agent/features/structured-results.feature`
- Read-only check: `apps/electron/e2e/agent/structured-results.spec.ts`

不新增依赖，不新增正文 parser，不改 renderer。

## 3. Task 1: Lock the Current Failure With Tests

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-finalizer.test.ts`

- [ ] **Step 1: Make provider fixtures explicit**

After `opencodeGoModel`, add:

```ts
const openAiResponsesModel = {
  api: "openai-responses",
  provider: "openai",
} as Model<Api>;
```

Then update the existing OpenAI Responses test to pass the model explicitly:

```ts
test("patches OpenAI Responses payload with structured text format", () => {
  expect(
    withFinalAnswerStructuredOutput(
      {
        model: "gpt-4o",
        input: [],
        stream: true,
        store: false,
      },
      openAiResponsesModel,
    ),
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
```

Production `onPayload` always receives `model`; the tests should not rely on an undefined model to guess a provider mode.

- [ ] **Step 2: Replace the wrong Chat Completions expectation**

Find this test:

```ts
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

Replace it with:

```ts
test("patches OpenAI-compatible chat payload with JSON object mode", () => {
  expect(
    withFinalAnswerStructuredOutput(
      {
        model: "deepseek-v4-flash",
        messages: [],
        stream: true,
      },
      opencodeGoModel,
    ),
  ).toEqual({
    model: "deepseek-v4-flash",
    messages: [],
    stream: true,
    response_format: {
      type: "json_object",
    },
  });
});
```

- [ ] **Step 3: Delete the wrong OpenCode unchanged expectation**

Find this test:

```ts
test("keeps non-native structured output providers unchanged when model is known", () => {
  expect(
    withFinalAnswerStructuredOutput(
      {
        model: "deepseek-v4-flash",
        messages: [],
        stream: true,
      },
      opencodeGoModel,
    ),
  ).toEqual({
    model: "deepseek-v4-flash",
    messages: [],
    stream: true,
  });
});
```

Delete it. The replacement test in Step 2 covers the intended behavior.

- [ ] **Step 4: Add a regression for prose returned as finalizer output**

Append inside `describe("runAgentFinalizer", () => { ... })`:

```ts
test("reports prose finalizer output as object generation failure instead of raw JSON parse error", async () => {
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
        streamJson: () => chunks(["好的，我已经通读了你的资料。"]),
      },
    ),
  ).rejects.toThrow("最终答案对象生成失败");
});
```

- [ ] **Step 5: Add a prompt contract test for DeepSeek JSON mode**

Update the import:

```ts
import {
  buildFinalizerContext,
  runAgentFinalizer,
  withFinalAnswerStructuredOutput,
} from "./agent-finalizer";
```

Append:

```ts
test("builds a JSON-mode friendly finalizer prompt", () => {
  const context = buildFinalizerContext({
    userQuestion: "根据知识库回答",
    piDraftText: "三观相关。",
    toolResults: [],
    entityCatalog: catalog,
    requiresEntityRefs: true,
    onPartial: vi.fn(),
  });

  expect(context.systemPrompt).toContain("json");
  expect(context.systemPrompt).toContain('"parts"');
  expect(context.systemPrompt).toContain('"entity_ref"');
});
```

- [ ] **Step 6: Run the focused test and verify failure**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: FAIL because OpenCode payload is still unchanged, prose parse error still leaks the raw JSON parse error, or the prompt does not contain the JSON-mode example.

## 4. Task 2: Add Provider Object Generation Adapter

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-finalizer.ts`

- [ ] **Step 1: Replace the binary provider check**

Remove:

```ts
function supportsProviderStructuredOutput(model: Model<Api> | undefined): boolean {
  if (!model) return true;
  return model.api === "openai-responses" || model.api === "azure-openai-responses";
}
```

Add:

```ts
type FinalAnswerObjectMode = "responses_json_schema" | "chat_json_object" | "unsupported";

function finalAnswerObjectMode(payload: unknown, model?: Model<Api>): FinalAnswerObjectMode {
  if (!isRecord(payload)) return "unsupported";
  if (
    "input" in payload &&
    (model?.api === "openai-responses" || model?.api === "azure-openai-responses")
  ) {
    return "responses_json_schema";
  }
  if ("messages" in payload && model?.api === "openai-completions") {
    return "chat_json_object";
  }
  return "unsupported";
}

function assertFinalAnswerObjectGenerationSupported(model: Model<Api>): void {
  if (
    model.api === "openai-responses" ||
    model.api === "azure-openai-responses" ||
    model.api === "openai-completions"
  ) {
    return;
  }
  throw new Error(`当前模型不支持最终答案对象生成: ${model.provider}/${model.id} (${model.api})`);
}
```

- [ ] **Step 2: Patch `withFinalAnswerStructuredOutput()` by mode**

Replace the current function body with:

```ts
export function withFinalAnswerStructuredOutput(payload: unknown, model?: Model<Api>): unknown {
  if (!isRecord(payload)) return payload;

  const mode = finalAnswerObjectMode(payload, model);
  if (mode === "responses_json_schema") {
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

  if (mode === "chat_json_object") {
    return {
      ...payload,
      response_format: {
        type: "json_object",
      },
    };
  }

  return payload;
}
```

This intentionally uses `json_object` for `openai-completions`. DeepSeek rejects OpenAI's newer `json_schema` response format but supports JSON Output. Schema enforcement remains Reflecta's AJV job.

- [ ] **Step 3: Fail before streaming when no object mode exists**

In `createPiAiFinalizerStream()`, after `const model = resolveFinalizerModel(...)`, add:

```ts
assertFinalAnswerObjectGenerationSupported(model);
```

The finalizer should never knowingly enter prompt-only JSON mode.

- [ ] **Step 4: Give JSON mode enough output budget**

In the `stream(...)` options inside `createPiAiFinalizerStream()`, add:

```ts
      maxTokens: Math.min(model.maxTokens, 4096),
```

The existing `pi-ai` `StreamOptions` supports `maxTokens`; this follows DeepSeek's requirement to avoid truncating the JSON object.

- [ ] **Step 5: Run the focused test**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: the OpenCode JSON mode test passes; the prose parse-error test may still fail until Task 4.

## 5. Task 3: Make the Finalizer Prompt JSON-Mode Friendly

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-finalizer.ts`

- [ ] **Step 1: Replace `buildFinalizerContext()` system prompt**

Replace the current `systemPrompt` string with:

```ts
[
  "你是 Reflecta 的最终答案对象生成器。",
  "你必须只输出一个有效 json object，不输出 markdown，不输出解释，不输出普通正文。",
  "json object 必须匹配这个形状：",
  '{"parts":[{"type":"text","text":"文字"},{"type":"entity_ref","entityType":"domain","entityId":"domain_id","fallbackText":"标题"}]}',
  "parts 中可以交替使用 text 和 entity_ref。",
  "entity_ref.entityId 必须来自给定 entityCatalog，不允许编造。",
  "如果 requiresEntityRefs 为 true，parts 至少包含一个 entity_ref。",
].join("\\n");
```

Keep the user message payload as JSON.stringify input. The prompt includes lowercase `json` and an example object because DeepSeek JSON Output requires both.

- [ ] **Step 2: Run the focused test**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: the prompt contract test passes.

## 6. Task 4: Stop Leaking Raw `Unexpected token` Errors

**Files:**

- Modify: `apps/electron/src/main/services/agent/agent-finalizer.ts`
- Test: `apps/electron/src/main/services/agent/agent-finalizer.test.ts`

- [ ] **Step 1: Wrap JSON parse failures**

Replace `finalAnswerFromRawJson()` with:

```ts
function finalAnswerFromRawJson(rawJson: string): FinalAnswer {
  let parsed: unknown;
  try {
    parsed = parseJsonWithRepair<unknown>(rawJson);
  } catch {
    throw new Error("最终答案对象生成失败: provider 返回了普通文本而不是有效 JSON object");
  }

  if (!validateFinalAnswerJson(parsed)) {
    const message = ajv.errorsText(validateFinalAnswerJson.errors, { separator: "; " });
    throw new Error(`最终答案结构化失败: ${message}`);
  }
  return parsed;
}
```

The UI should show a product-level finalizer failure reason, not a low-level `Unexpected token '好'`.

- [ ] **Step 2: Run the focused test**

Run:

```bash
rtk bun --cwd apps/electron vitest run src/main/services/agent/agent-finalizer.test.ts
```

Expected: PASS.

## 7. Task 5: Verify User-Visible Failure State Is Already Covered

**Files:**

- Read-only check: `apps/electron/e2e/agent/features/structured-results.feature`
- Read-only check: `apps/electron/e2e/agent/structured-results.spec.ts`

- [ ] **Step 1: Confirm existing scenario coverage**

Confirm `@AG-RESULT-007` still says:

```gherkin
场景: 用户查看最终答案生成失败原因
  假如对话中有一条 Agent 回复的最终答案生成失败
  当用户打开该对话
  那么该 Agent 回复应该显示最终答案失败状态
  而且该失败状态应该说明失败原因
```

No feature file change is needed for this patch. The user-facing rule is already stable: finalizer failure must be visible and explanatory. The new bug-specific assertion belongs in `agent-finalizer.test.ts`, not in Gherkin.

- [ ] **Step 2: Run the existing targeted E2E**

Run:

```bash
rtk bun --cwd apps/electron test:e2e -- --grep @AG-RESULT-007
```

Expected: PASS.

## 8. Task 6: Full Verification

**Files:**

- No code changes.

- [ ] **Step 1: Run main-process tests**

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

- [ ] **Step 3: Run full E2E**

Run:

```bash
rtk bun --cwd apps/electron test:e2e
```

Expected: PASS.

- [ ] **Step 4: Commit**

Stage only files changed by this implementation:

```bash
git add apps/electron/src/main/services/agent/agent-finalizer.ts apps/electron/src/main/services/agent/agent-finalizer.test.ts
git commit -m "fix(agent): use json mode for final answer objects"
```

Do not stage unrelated local changes, especially `apps/electron/src/main/services/agent/agent-system-prompt.md` if it remains a pre-existing worktree change.

## 9. Self-Review

- Spec coverage: this plan keeps v1.1.17's hard requirement that final visible answers come from validated `AgentTextPart[]`, and fixes the missing provider adapter that made DeepSeek/OpenCode fall back to prompt-only JSON.
- Placeholder scan: no task relies on unspecified parser work, title matching, XML/YAML handling, or future tool forcing.
- Type consistency: the only product output type is still `FinalAnswer.parts`; provider-specific behavior is contained inside `agent-finalizer.ts`.
- Scope: this patch supports the current production path (`opencode-go/deepseek-v4-flash`) through OpenAI-compatible JSON mode. It does not implement Anthropic/Mistral forced tool-call finalization because the current Pi finalizer seam does not expose a forced final tool call path.
