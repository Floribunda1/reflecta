#!/usr/bin/env bun
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Type } from "@earendil-works/pi-ai";
import { getModel, type Api, type Model } from "@earendil-works/pi-ai/compat";
import {
  AuthStorage,
  createAgentSession,
  createExtensionRuntime,
  defineTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { getCodexCredentials } from "../src/main/services/agent/codex-auth";

type Protocol = "numbered" | "direct";
type Entity = { type: "understanding" | "context" | "domain"; id: string; title: string };
type ToolCall = { name: string; args: unknown };
type Scenario = {
  id: string;
  name: string;
  entities: Entity[];
  expected: Entity[];
  prompts: string[];
  requiredTool?: { name: string; idField: string; id: string };
};
type RunResult = {
  sequence: number;
  protocol: Protocol;
  repeat: number;
  scenarioId: string;
  scenarioName: string;
  providerId: string;
  modelId: string;
  reasoningLevel: string;
  prompts: string[];
  entities: Entity[];
  expectedTokens: string[];
  finalText: string;
  toolCalls: ToolCall[];
  firstTokenMs: number | null;
  completionMs: number;
  renderResolveMs: number;
  observedTokens: string[];
  malformedOrUnknownTokens: string[];
  coveragePass: boolean;
  bindingPass: boolean;
  toolPass: boolean;
  toolPollution: string[];
  uiRawLeak: boolean;
  error?: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const defaultConfigPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Reflecta",
  "reflecta-config.json",
);
const configPath = process.env.REFLECTA_CITATION_EVAL_CONFIG || defaultConfigPath;
const outputDir = path.join(repoRoot, "docs/iterations/v1.1.22/evals");
const rawPath = path.join(outputDir, "citation-reliability-raw.json");
const reportPath = path.join(outputDir, "citation-reliability-report.md");
const repeats = Number(process.env.REFLECTA_CITATION_EVAL_REPEATS || 5);
const concurrency = Number(process.env.REFLECTA_CITATION_EVAL_CONCURRENCY || 2);

const entities = {
  u1: { type: "understanding", id: "7N4kP2xQ9mL3cR8vT1aZb", title: "反馈循环" },
  u2: { type: "understanding", id: "8M5pQ3yR7nK2dL9vS4bXc", title: "边界意识" },
  c1: { type: "context", id: "6C2mR8pL4xT9vN5qH7kDz", title: "一次复盘" },
  d1: { type: "domain", id: "9D3kV7mQ2pR8xL4nT6cWy", title: "产品设计" },
} as const satisfies Record<string, Entity>;

const scenarios: Scenario[] = [
  {
    id: "explicit-one",
    name: "显式引用一个实体",
    entities: [entities.u1],
    expected: [entities.u1],
    prompts: ["请用一句中文回答，并引用「反馈循环」。"],
  },
  {
    id: "tool-return",
    name: "读取工具返回后引用",
    entities: [],
    expected: [entities.u1],
    prompts: [
      `先调用 understanding_get 读取 id=${entities.u1.id}，再用一句中文概括并引用工具返回的 Understanding。`,
    ],
    requiredTool: { name: "understanding_get", idField: "understandingId", id: entities.u1.id },
  },
  {
    id: "same-type-multiple",
    name: "同类型多个实体",
    entities: [entities.u1, entities.u2],
    expected: [entities.u1, entities.u2],
    prompts: ["用一句中文比较「反馈循环」与「边界意识」，两者各引用一次。"],
  },
  {
    id: "mixed-types",
    name: "三种实体混合",
    entities: [entities.u1, entities.c1, entities.d1],
    expected: [entities.u1, entities.c1, entities.d1],
    prompts: ["用一句中文说明这条理解、这次复盘和产品设计领域的关系，并分别引用三者。"],
  },
  {
    id: "next-turn",
    name: "下一轮继续引用",
    entities: [entities.u1],
    expected: [entities.u1],
    prompts: ["先用一句中文引用「反馈循环」。", "继续上一轮，再引用一次同一个实体。"],
  },
  {
    id: "cite-then-read",
    name: "引用并读取同一实体",
    entities: [entities.u1],
    expected: [entities.u1],
    prompts: ["先调用 understanding_get 读取「反馈循环」，再用一句中文回答并引用它。"],
    requiredTool: { name: "understanding_get", idField: "understandingId", id: entities.u1.id },
  },
  {
    id: "cite-one-update-other",
    name: "引用一个并修改另一个",
    entities: [entities.u1, entities.u2],
    expected: [entities.u1],
    prompts: [
      "调用 understanding_update 把「边界意识」标题改成「边界更清晰」，然后在最终正文只引用「反馈循环」。",
    ],
    requiredTool: { name: "understanding_update", idField: "understandingId", id: entities.u2.id },
  },
  {
    id: "markdown-mixed",
    name: "Markdown 混合",
    entities: [entities.u1],
    expected: [entities.u1],
    prompts: [
      "用 Markdown 回答：包含一个二级标题、一个列表、行内代码 `citation-demo`，并在普通正文中引用「反馈循环」。",
    ],
  },
];
const selectedScenarioIds = new Set(
  (process.env.REFLECTA_CITATION_EVAL_SCENARIOS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const selectedScenarios = selectedScenarioIds.size
  ? scenarios.filter((scenario) => selectedScenarioIds.has(scenario.id))
  : scenarios;

async function readModelConfig() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
    ai?: {
      activeAgentModel?: { providerId?: string; modelId?: string };
      activeAgentReasoningLevel?: string;
      providers?: Array<{ id?: string; apiKey?: string }>;
    };
  };
  const selection = config.ai?.activeAgentModel;
  const provider = config.ai?.providers?.find((item) => item.id === selection?.providerId);
  if (!selection?.providerId || !selection.modelId || !provider) {
    throw new Error("Project AI provider or active model is missing");
  }
  const apiKey =
    selection.providerId === "openai-codex"
      ? (await getCodexCredentials()).accessToken
      : provider.apiKey;
  if (!apiKey) throw new Error("Project AI API key is missing");
  return {
    providerId: selection.providerId,
    modelId: selection.modelId,
    apiKey,
    reasoningLevel: config.ai?.activeAgentReasoningLevel || "low",
  };
}

function prefix(type: Entity["type"]) {
  return type === "understanding" ? "u" : type === "context" ? "c" : "d";
}

function tokenFor(protocol: Protocol, entity: Entity, sourceEntities: Entity[]) {
  if (protocol === "direct") return `[[${prefix(entity.type)}:${entity.id}]]`;
  return `[${sourceEntities.findIndex((item) => item.type === entity.type && item.id === entity.id) + 1}]`;
}

function sourceBlock(protocol: Protocol, sourceEntities: Entity[]) {
  if (sourceEntities.length === 0) return "";
  if (protocol === "numbered") {
    return sourceEntities
      .map((entity, index) => `[${index + 1}] ${entity.type}: ${entity.title}; id=${entity.id}`)
      .join("\n");
  }
  return `<reflecta_entities>\n${sourceEntities
    .map((entity) =>
      JSON.stringify({
        type: entity.type,
        id: entity.id,
        citation: tokenFor("direct", entity, sourceEntities),
        title: entity.title,
      }),
    )
    .join("\n")}\n</reflecta_entities>`;
}

function systemPrompt(protocol: Protocol, sourceEntities: Entity[]) {
  const contract =
    protocol === "direct"
      ? "最终正文引用实体时，原样复制记录里的 citation。工具参数只传 id，绝不能传 citation。只能引用记录或工具结果明确提供的实体。"
      : "最终正文引用实体时使用对应的 [n]。工具参数只传真实 id，绝不能传 [n]。只能引用列表或工具结果明确提供的实体。";
  return [
    "你是 Reflecta 的测试 Agent。严格完成用户要求，回答尽量简短。",
    contract,
    "不要解释引用协议，不要把引用放进代码格式，不要自行构造或改写 ID。",
    sourceBlock(protocol, sourceEntities),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function createResourceLoader(prompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => prompt,
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

function resolveModel(providerId: string, modelId: string): Model<Api> {
  const model = (getModel as (provider: string, id: string) => Model<Api> | undefined)(
    providerId,
    modelId,
  );
  if (!model) throw new Error(`Pi model not found: ${providerId}/${modelId}`);
  return model;
}

function extractText(message: unknown) {
  if (
    !message ||
    typeof message !== "object" ||
    !("role" in message) ||
    message.role !== "assistant" ||
    !("content" in message)
  ) {
    return "";
  }
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
        ? String(part.text)
        : "",
    )
    .join("");
}

function extractError(message: unknown) {
  if (
    !message ||
    typeof message !== "object" ||
    !("role" in message) ||
    message.role !== "assistant" ||
    !("stopReason" in message) ||
    message.stopReason !== "error"
  ) {
    return "";
  }
  return "errorMessage" in message
    ? String(message.errorMessage || "Provider error")
    : "Provider error";
}

function toolResult(protocol: Protocol, entity: Entity) {
  const block = sourceBlock(protocol, [entity]);
  return {
    content: [{ type: "text" as const, text: `${JSON.stringify(entity)}\n\n${block}` }],
    details: entity,
  };
}

function createTools(protocol: Protocol, calls: ToolCall[]) {
  return [
    defineTool({
      name: "understanding_get",
      label: "读取 Understanding",
      description: "Read one Understanding by its stable bare id.",
      promptSnippet: "understanding_get: read one Understanding using understandingId.",
      parameters: Type.Object({ understandingId: Type.String({ minLength: 1 }) }),
      execute: async (_toolCallId, args) => {
        calls.push({ name: "understanding_get", args });
        return toolResult(protocol, entities.u1);
      },
    }),
    defineTool({
      name: "understanding_update",
      label: "修改 Understanding",
      description: "Update one Understanding using its stable bare id and a new title.",
      promptSnippet: "understanding_update: update one Understanding using understandingId.",
      parameters: Type.Object({
        understandingId: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1 }),
      }),
      execute: async (_toolCallId, args) => {
        calls.push({ name: "understanding_update", args });
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: true, ...args }) }],
          details: { ok: true, ...args },
        };
      },
    }),
  ];
}

function outsideCode(markdown: string) {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .filter((part) => !part.startsWith("`"))
    .join("");
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

function evaluate(
  protocol: Protocol,
  scenario: Scenario,
  sourceEntities: Entity[],
  finalText: string,
  toolCalls: ToolCall[],
) {
  const visibleText = outsideCode(finalText);
  const validPattern = protocol === "direct" ? /\[\[[ucd]:[A-Za-z0-9_-]+\]\]/g : /\[\d+\]/g;
  const observedTokens = visibleText.match(validPattern) ?? [];
  const citationLike =
    protocol === "direct"
      ? (visibleText.match(/\[\[[^\n]*?(?:\]\]|$)/g) ?? [])
      : (visibleText.match(/\[[^\]\n]+\]/g) ?? []).filter((token) => /^\[\d+\]$/.test(token));
  const expectedSourceEntities = [...sourceEntities];
  for (const entity of scenario.expected) {
    if (
      !expectedSourceEntities.some((item) => item.type === entity.type && item.id === entity.id)
    ) {
      expectedSourceEntities.push(entity);
    }
  }
  const expectedTokens = scenario.expected.map((entity) =>
    tokenFor(protocol, entity, expectedSourceEntities),
  );
  const allowedTokens = new Set(
    expectedSourceEntities.map((entity) => tokenFor(protocol, entity, expectedSourceEntities)),
  );
  const malformedOrUnknownTokens = citationLike.filter(
    (token) => !observedTokens.includes(token) || !allowedTokens.has(token),
  );
  const coveragePass = expectedTokens.every((token) => observedTokens.includes(token));
  const bindingPass = observedTokens.every((token) => allowedTokens.has(token));
  const toolPollution = toolCalls
    .flatMap((call) => stringsIn(call.args))
    .filter((value) => /\[\[|\[\d+\]|^ref:|^[UDCS]\d+$/i.test(value));
  const requiredCall = scenario.requiredTool;
  const toolPass =
    toolPollution.length === 0 &&
    (!requiredCall ||
      toolCalls.some((call) => {
        if (call.name !== requiredCall.name || !call.args || typeof call.args !== "object") {
          return false;
        }
        return (call.args as Record<string, unknown>)[requiredCall.idField] === requiredCall.id;
      }));
  const renderStarted = performance.now();
  let rendered = visibleText;
  for (const token of observedTokens) rendered = rendered.replaceAll(token, "ENTITY_TITLE");
  const renderResolveMs = performance.now() - renderStarted;
  const uiRawLeak =
    protocol === "direct" ? /\[\[[^\n]*?(?:\]\]|$)/.test(rendered) : /\[\d+\]/.test(rendered);
  return {
    expectedTokens,
    observedTokens,
    malformedOrUnknownTokens,
    coveragePass,
    bindingPass,
    toolPass,
    toolPollution,
    uiRawLeak,
    renderResolveMs,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runOne(
  sequence: number,
  protocol: Protocol,
  repeat: number,
  scenario: Scenario,
  config: Awaited<ReturnType<typeof readModelConfig>>,
): Promise<RunResult> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-citation-eval-"));
  const calls: ToolCall[] = [];
  const started = performance.now();
  let firstTokenMs: number | null = null;
  let finalText = "";
  let assistantError = "";
  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
  try {
    const agentDir = path.join(tempRoot, ".pi-agent");
    const sessionsRoot = path.join(tempRoot, "Sessions");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.mkdirSync(sessionsRoot, { recursive: true });
    const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
    authStorage.setRuntimeApiKey(config.providerId, config.apiKey);
    const created = await createAgentSession({
      agentDir,
      authStorage,
      customTools: createTools(protocol, calls),
      cwd: tempRoot,
      model: resolveModel(config.providerId, config.modelId),
      modelRegistry: ModelRegistry.inMemory(authStorage),
      resourceLoader: createResourceLoader(systemPrompt(protocol, scenario.entities)),
      sessionManager: SessionManager.create(tempRoot, sessionsRoot),
      settingsManager: SettingsManager.inMemory({
        compaction: { enabled: false },
        retry: { enabled: false },
      }),
      thinkingLevel: config.reasoningLevel as never,
      tools: ["understanding_get", "understanding_update"],
    });
    session = created.session;
    let turnStarted = performance.now();
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        firstTokenMs ??= performance.now() - turnStarted;
      }
      if (event.type === "message_end") {
        const text = extractText(event.message);
        if (text) finalText = text;
        assistantError = extractError(event.message) || assistantError;
      }
    });
    try {
      for (const prompt of scenario.prompts) {
        finalText = "";
        firstTokenMs = null;
        turnStarted = performance.now();
        await withTimeout(session.prompt(prompt), 120_000, () => void session?.abort());
        if (assistantError) throw new Error(assistantError);
      }
    } finally {
      unsubscribe();
    }
    const measured = evaluate(protocol, scenario, scenario.entities, finalText, calls);
    return {
      sequence,
      protocol,
      repeat,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      providerId: config.providerId,
      modelId: config.modelId,
      reasoningLevel: config.reasoningLevel,
      prompts: scenario.prompts,
      entities: scenario.entities,
      finalText,
      toolCalls: calls,
      firstTokenMs,
      completionMs: performance.now() - started,
      ...measured,
    };
  } catch (error) {
    const measured = evaluate(protocol, scenario, scenario.entities, finalText, calls);
    return {
      sequence,
      protocol,
      repeat,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      providerId: config.providerId,
      modelId: config.modelId,
      reasoningLevel: config.reasoningLevel,
      prompts: scenario.prompts,
      entities: scenario.entities,
      finalText,
      toolCalls: calls,
      firstTokenMs,
      completionMs: performance.now() - started,
      ...measured,
      coveragePass: false,
      bindingPass: false,
      toolPass: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    session?.dispose();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function summarize(results: RunResult[], protocol: Protocol) {
  const runs = results.filter((result) => result.protocol === protocol);
  const passRate = (key: "coveragePass" | "bindingPass" | "toolPass") =>
    runs.filter((run) => run[key]).length / runs.length;
  const renderTimes = runs.map((run) => run.renderResolveMs).sort((a, b) => a - b);
  return {
    runs: runs.length,
    coverage: passRate("coveragePass"),
    binding: passRate("bindingPass"),
    tools: passRate("toolPass"),
    malformedOrUnknown: runs.flatMap((run) => run.malformedOrUnknownTokens).length,
    toolPollution: runs.flatMap((run) => run.toolPollution).length,
    uiRawLeaks: runs.filter((run) => run.uiRawLeak).length,
    providerErrors: runs.filter((run) => run.error).length,
    renderP95Ms: renderTimes[Math.max(0, Math.ceil(renderTimes.length * 0.95) - 1)] ?? 0,
  };
}

function report(results: RunResult[], config: Awaited<ReturnType<typeof readModelConfig>>) {
  const numbered = summarize(results, "numbered");
  const direct = summarize(results, "direct");
  const modelGate =
    direct.binding === 1 &&
    direct.tools === 1 &&
    direct.malformedOrUnknown === 0 &&
    direct.toolPollution === 0 &&
    direct.coverage >= numbered.coverage - 0.05 &&
    direct.providerErrors === 0;
  const rows = selectedScenarios
    .map((scenario) => {
      const values = (["numbered", "direct"] as const).map((protocol) => {
        const runs = results.filter(
          (run) => run.protocol === protocol && run.scenarioId === scenario.id,
        );
        return `${runs.filter((run) => run.coveragePass).length}/${runs.length}`;
      });
      return `| ${scenario.name} | ${values[0]} | ${values[1]} |`;
    })
    .join("\n");
  return `# Citation 真实模型 A/B 报告

- 时间：${new Date().toISOString()}
- Provider / Model：${config.providerId} / ${config.modelId}
- Reasoning：${config.reasoningLevel}
- 样本：numbered ${numbered.runs}，direct ${direct.runs}
- 结论：**${modelGate ? "PASS" : "FAIL"}**

| 指标 | numbered | direct |
| --- | ---: | ---: |
| 引用 coverage | ${percentage(numbered.coverage)} | ${percentage(direct.coverage)} |
| type + ID 绑定正确 | ${percentage(numbered.binding)} | ${percentage(direct.binding)} |
| 工具参数正确 | ${percentage(numbered.tools)} | ${percentage(direct.tools)} |
| malformed / unknown | ${numbered.malformedOrUnknown} | ${direct.malformedOrUnknown} |
| 工具 display token 污染 | ${numbered.toolPollution} | ${direct.toolPollution} |
| UI raw protocol 泄漏 | ${numbered.uiRawLeaks} | ${direct.uiRawLeaks} |
| Provider error | ${numbered.providerErrors} | ${direct.providerErrors} |
| 本地 parse/render p95 | ${numbered.renderP95Ms.toFixed(3)} ms | ${direct.renderP95Ms.toFixed(3)} ms |

| 场景 | numbered coverage | direct coverage |
| --- | ---: | ---: |
${rows}

## 判定

真实模型 evaluator 只使用 exact token、ID/type 和工具参数检查。title 改名、删除、重启与真实 UI 路径由 AG-RESULT-004/008/009/010/011 E2E 单独验证。

原始结果见 [citation-reliability-raw.json](./citation-reliability-raw.json)。
`;
}

const config = await readModelConfig();
const jobs = Array.from({ length: repeats }, (_, repeat) =>
  selectedScenarios.flatMap((scenario, scenarioIndex) => {
    const protocols: Protocol[] =
      (repeat + scenarioIndex) % 2 === 0 ? ["numbered", "direct"] : ["direct", "numbered"];
    return protocols.map((protocol) => ({ protocol, repeat: repeat + 1, scenario }));
  }),
).flat();
const results: RunResult[] = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (cursor < jobs.length) {
      const sequence = cursor++;
      const job = jobs[sequence]!;
      const result = await runOne(sequence, job.protocol, job.repeat, job.scenario, config);
      results.push(result);
      process.stdout.write(
        `[${results.length}/${jobs.length}] ${job.protocol} ${job.scenario.id} ` +
          `${result.coveragePass && result.bindingPass && result.toolPass ? "PASS" : "FAIL"}\n`,
      );
    }
  }),
);
results.sort((left, right) => left.sequence - right.sequence);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  rawPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      providerId: config.providerId,
      modelId: config.modelId,
      reasoningLevel: config.reasoningLevel,
      results,
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(reportPath, report(results, config));
process.stdout.write(`Report: ${reportPath}\n`);
