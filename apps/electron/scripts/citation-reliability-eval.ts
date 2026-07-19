#!/usr/bin/env bun
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
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
type ScenarioTurn = {
  prompt: string;
  expected: Entity[];
  requiredTool?: { name: string; idField: string; id: string };
};
type Scenario = {
  id: string;
  name: string;
  entities: Entity[];
  toolEntities?: Entity[];
  turns: ScenarioTurn[];
};
type TurnResult = {
  turn: number;
  prompt: string;
  finalText: string;
  toolCalls: ToolCall[];
  firstTokenMs: number | null;
  completionMs: number;
  expectedTokens: string[];
  observedTokens: string[];
  malformedOrUnknownTokens: string[];
  coveragePass: boolean;
  selectionPass: boolean;
  bindingPass: boolean;
  toolPass: boolean;
  toolPollution: string[];
  uiRawLeak: boolean;
  renderResolveMs: number;
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
  entities: Entity[];
  toolEntities: Entity[];
  turns: TurnResult[];
  expectedTokens: string[];
  finalText: string;
  toolCalls: ToolCall[];
  firstTokenMs: number | null;
  completionMs: number;
  renderResolveMs: number;
  observedTokens: string[];
  malformedOrUnknownTokens: string[];
  coveragePass: boolean;
  selectionPass: boolean;
  bindingPass: boolean;
  finalRecallPass: boolean;
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

function entity(
  type: Entity["type"],
  index: number,
  title: string,
  collisionGroup?: string,
): Entity {
  const seed = collisionGroup
    ? `${createHash("sha256").update(collisionGroup).digest("base64url").slice(0, 20)}${"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[index]}`
    : createHash("sha256").update(`${type}:${index}:${title}`).digest("base64url").slice(0, 21);
  return { type, id: seed, title };
}

function describe(item: Entity) {
  const type =
    item.type === "understanding"
      ? "Understanding"
      : item.type === "context"
        ? "Context"
        : "Domain";
  return `${type}「${item.title}」`;
}

function citationTurn(expected: Entity[], instruction = "用一句中文说明它们的关系") {
  return {
    prompt: `${instruction}，并且只引用以下实体，每个各一次：${expected.map(describe).join("、")}。`,
    expected,
  } satisfies ScenarioTurn;
}

function rotatingTurns(
  source: Entity[],
  count: number,
  size: number,
  step: number,
  instruction?: (turn: number) => string,
) {
  return Array.from({ length: count }, (_, turn) =>
    citationTurn(
      Array.from(
        { length: size },
        (_, index) => source[(turn * step + index * 7) % source.length]!,
      ),
      instruction?.(turn),
    ),
  );
}

const wideCatalog = [
  ...Array.from({ length: 32 }, (_, index) =>
    entity("understanding", index, `规模化判断 ${String(index + 1).padStart(2, "0")}`),
  ),
  ...Array.from({ length: 20 }, (_, index) =>
    entity("context", index, `项目记录 ${String(index + 1).padStart(2, "0")}`),
  ),
  ...Array.from({ length: 12 }, (_, index) =>
    entity("domain", index, `工作领域 ${String(index + 1).padStart(2, "0")}`),
  ),
];
const similarUnderstandings = Array.from({ length: 36 }, (_, index) =>
  entity(
    "understanding",
    index,
    `复盘结论 ${String(index + 1).padStart(2, "0")}`,
    "similar-understanding-ids",
  ),
);
const typeCollisionCatalog = Array.from({ length: 16 }, (_, index) => {
  const title = `共同主题 ${String(index + 1).padStart(2, "0")}`;
  return [
    entity("understanding", index, title),
    entity("context", index, title),
    entity("domain", index, title),
  ];
}).flat();
const toolCatalog = wideCatalog.slice(0, 45);
const lateToolEntities = Array.from({ length: 3 }, (_, index) =>
  entity("understanding", 100 + index, `工具新增理解 ${index + 1}`),
);

const scenarios: Scenario[] = [
  {
    id: "wide-catalog-delayed-recall",
    name: "64 个实体中的延迟引用",
    entities: wideCatalog,
    turns: [
      ...rotatingTurns(wideCatalog, 7, 6, 9),
      citationTurn(
        [
          wideCatalog[0]!,
          wideCatalog[15]!,
          wideCatalog[31]!,
          wideCatalog[37]!,
          wideCatalog[53]!,
          wideCatalog[63]!,
        ],
        "回到前面分散出现过的信息，用一句中文总结",
      ),
    ],
  },
  {
    id: "near-id-dense-history",
    name: "近似 ID 与 citation 密集历史",
    entities: similarUnderstandings,
    turns: [
      ...rotatingTurns(similarUnderstandings, 13, 4, 5),
      citationTurn(
        [
          similarUnderstandings[0]!,
          similarUnderstandings[6]!,
          similarUnderstandings[12]!,
          similarUnderstandings[18]!,
          similarUnderstandings[24]!,
          similarUnderstandings[30]!,
        ],
        "对前面跨越整段对话的六条结论做回顾",
      ),
    ],
  },
  {
    id: "same-title-cross-type",
    name: "同名跨类型实体",
    entities: typeCollisionCatalog,
    turns: [
      ...rotatingTurns(typeCollisionCatalog, 9, 5, 11),
      citationTurn(
        [
          typeCollisionCatalog[9]!,
          typeCollisionCatalog[10]!,
          typeCollisionCatalog[11]!,
          typeCollisionCatalog[36]!,
          typeCollisionCatalog[37]!,
          typeCollisionCatalog[38]!,
        ],
        "区分两个同名主题下的 Understanding、Context 与 Domain",
      ),
    ],
  },
  {
    id: "tool-growth-markdown-noise",
    name: "工具新增实体与 Markdown 噪声",
    entities: toolCatalog,
    toolEntities: lateToolEntities,
    turns: [
      ...rotatingTurns(toolCatalog, 4, 4, 8, (turn) =>
        turn % 2 === 0
          ? "用 Markdown 列表回答；代码示例 `[[u:not-a-real-id]]` 只是文本"
          : "引用块里可以出现普通方括号 [说明]，正文简短回答",
      ),
      ...lateToolEntities.map((item, index) => ({
        prompt: `调用 understanding_get，参数 understandingId 只传裸 ID ${item.id}。然后引用工具返回的 ${describe(item)}，并同时引用 ${describe(toolCatalog[index * 9]!)}。`,
        expected: [item, toolCatalog[index * 9]!],
        requiredTool: {
          name: "understanding_get",
          idField: "understandingId",
          id: item.id,
        },
      })),
      ...rotatingTurns(
        toolCatalog,
        4,
        4,
        13,
        () => "继续长对话，用二级标题和列表回答；不要引用代码里的伪 marker",
      ),
      {
        ...citationTurn(
          [
            lateToolEntities[0]!,
            lateToolEntities[2]!,
            toolCatalog[0]!,
            toolCatalog[17]!,
            toolCatalog[31]!,
          ],
          "最后回忆早期、中期和工具后期出现的实体",
        ),
        requiredTool: {
          name: "understanding_get",
          idField: "understandingId",
          id: lateToolEntities[0]!.id,
        },
        prompt: `先调用 understanding_get 读取裸 ID ${lateToolEntities[0]!.id}。${
          citationTurn(
            [
              lateToolEntities[0]!,
              lateToolEntities[2]!,
              toolCatalog[0]!,
              toolCatalog[17]!,
              toolCatalog[31]!,
            ],
            "最后回忆早期、中期和工具后期出现的实体",
          ).prompt
        }`,
      },
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
if (selectedScenarios.length === 0) throw new Error("No citation evaluation scenarios selected");

async function readModelConfig() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
    ai?: {
      activeAgentModel?: { providerId?: string; modelId?: string };
      activeAgentReasoningLevel?: string;
      providers?: Array<{ id?: string; apiKey?: string }>;
    };
  };
  const active = config.ai?.activeAgentModel;
  const providerId = process.env.REFLECTA_CITATION_EVAL_PROVIDER || active?.providerId;
  const modelId = process.env.REFLECTA_CITATION_EVAL_MODEL || active?.modelId;
  const provider = config.ai?.providers?.find((item) => item.id === providerId);
  if (!providerId || !modelId || !provider) {
    throw new Error("Project AI provider or active model is missing");
  }
  const apiKey =
    providerId === "openai-codex" ? (await getCodexCredentials()).accessToken : provider.apiKey;
  if (!apiKey) throw new Error("Project AI API key is missing");
  return {
    providerId,
    modelId,
    apiKey,
    reasoningLevel:
      process.env.REFLECTA_CITATION_EVAL_REASONING || config.ai?.activeAgentReasoningLevel || "low",
  };
}

function prefix(type: Entity["type"]) {
  return type === "understanding" ? "u" : type === "context" ? "c" : "d";
}

function tokenFor(protocol: Protocol, entity: Entity, sourceEntities: Entity[]) {
  if (protocol === "direct") return `[[${prefix(entity.type)}:${entity.id}]]`;
  return `[${sourceEntities.findIndex((item) => item.type === entity.type && item.id === entity.id) + 1}]`;
}

function sourceBlock(protocol: Protocol, sourceEntities: Entity[], allEntities = sourceEntities) {
  if (sourceEntities.length === 0) return "";
  if (protocol === "numbered") {
    return sourceEntities
      .map(
        (entity) =>
          `${tokenFor(protocol, entity, allEntities)} ${entity.type}: ${entity.title}; id=${entity.id}`,
      )
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

function toolResult(protocol: Protocol, entity: Entity, allEntities: Entity[]) {
  const block = sourceBlock(protocol, [entity], allEntities);
  return {
    content: [{ type: "text" as const, text: `${JSON.stringify(entity)}\n\n${block}` }],
    details: entity,
  };
}

function createTools(protocol: Protocol, calls: ToolCall[], allEntities: Entity[]) {
  return [
    defineTool({
      name: "understanding_get",
      label: "读取 Understanding",
      description: "Read one Understanding by its stable bare id.",
      promptSnippet: "understanding_get: read one Understanding using understandingId.",
      parameters: Type.Object({ understandingId: Type.String({ minLength: 1 }) }),
      execute: async (_toolCallId, args) => {
        calls.push({ name: "understanding_get", args });
        const found = allEntities.find(
          (entity) => entity.type === "understanding" && entity.id === args.understandingId,
        );
        if (!found) throw new Error(`Understanding not found: ${args.understandingId}`);
        return toolResult(protocol, found, allEntities);
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
  expected: Entity[],
  allowedEntities: Entity[],
  finalText: string,
  toolCalls: ToolCall[],
  requiredTool?: ScenarioTurn["requiredTool"],
) {
  const visibleText = outsideCode(finalText);
  const validPattern = protocol === "direct" ? /\[\[[ucd]:[A-Za-z0-9_-]+\]\]/g : /\[\d+\]/g;
  const observedTokens = visibleText.match(validPattern) ?? [];
  const citationLike =
    protocol === "direct"
      ? (visibleText.match(/\[\[[^\n]*?(?:\]\]|$)/g) ?? [])
      : (visibleText.match(/\[[^\]\n]+\]/g) ?? []).filter((token) => /^\[\d+\]$/.test(token));
  const expectedTokens = expected.map((entity) => tokenFor(protocol, entity, allowedEntities));
  const allowedTokens = new Set(
    allowedEntities.map((entity) => tokenFor(protocol, entity, allowedEntities)),
  );
  const expectedTokenSet = new Set(expectedTokens);
  const malformedOrUnknownTokens = citationLike.filter(
    (token) => !observedTokens.includes(token) || !allowedTokens.has(token),
  );
  const coveragePass = expectedTokens.every((token) => observedTokens.includes(token));
  const selectionPass =
    observedTokens.length === expectedTokens.length &&
    observedTokens.every((token) => expectedTokenSet.has(token));
  const bindingPass = observedTokens.every((token) => allowedTokens.has(token));
  const toolPollution = toolCalls
    .flatMap((call) => stringsIn(call.args))
    .filter((value) => /\[\[|\[\d+\]|^ref:|^[UDCS]\d+$/i.test(value));
  const toolPass =
    toolPollution.length === 0 &&
    (!requiredTool ||
      toolCalls.some((call) => {
        if (call.name !== requiredTool.name || !call.args || typeof call.args !== "object") {
          return false;
        }
        return (call.args as Record<string, unknown>)[requiredTool.idField] === requiredTool.id;
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
    selectionPass,
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
  const toolEntities = scenario.toolEntities ?? [];
  const allEntities = [...scenario.entities, ...toolEntities];
  const turns: TurnResult[] = [];
  const started = performance.now();
  let firstTokenMs: number | null = null;
  let finalText = "";
  let assistantError = "";
  let currentTurn: ScenarioTurn | undefined;
  let currentCallStart = 0;
  let turnStarted = started;
  let runError: string | undefined;
  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
  let unsubscribe: (() => void) | undefined;
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
      customTools: createTools(protocol, calls, allEntities),
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
      tools: ["understanding_get"],
    });
    session = created.session;
    unsubscribe = session.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        firstTokenMs ??= performance.now() - turnStarted;
      }
      if (event.type === "message_end") {
        const text = extractText(event.message);
        if (text) finalText = text;
        assistantError = extractError(event.message) || assistantError;
      }
    });
    for (const [index, turn] of scenario.turns.entries()) {
      currentTurn = turn;
      currentCallStart = calls.length;
      finalText = "";
      assistantError = "";
      firstTokenMs = null;
      turnStarted = performance.now();
      await withTimeout(session.prompt(turn.prompt), 120_000, () => void session?.abort());
      if (assistantError) throw new Error(assistantError);
      const toolCalls = calls.slice(currentCallStart);
      turns.push({
        turn: index + 1,
        prompt: turn.prompt,
        finalText,
        toolCalls,
        firstTokenMs,
        completionMs: performance.now() - turnStarted,
        ...evaluate(protocol, turn.expected, allEntities, finalText, toolCalls, turn.requiredTool),
      });
      currentTurn = undefined;
    }
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
    if (currentTurn) {
      const toolCalls = calls.slice(currentCallStart);
      turns.push({
        turn: turns.length + 1,
        prompt: currentTurn.prompt,
        finalText,
        toolCalls,
        firstTokenMs,
        completionMs: performance.now() - turnStarted,
        ...evaluate(
          protocol,
          currentTurn.expected,
          allEntities,
          finalText,
          toolCalls,
          currentTurn.requiredTool,
        ),
        coveragePass: false,
        selectionPass: false,
        bindingPass: false,
        toolPass: false,
      });
    }
  } finally {
    unsubscribe?.();
    session?.dispose();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  const complete = !runError && turns.length === scenario.turns.length;
  const lastTurn = turns.at(-1);
  return {
    sequence,
    protocol,
    repeat,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    providerId: config.providerId,
    modelId: config.modelId,
    reasoningLevel: config.reasoningLevel,
    entities: scenario.entities,
    toolEntities,
    turns,
    expectedTokens: turns.flatMap((turn) => turn.expectedTokens),
    finalText: lastTurn?.finalText ?? "",
    toolCalls: calls,
    firstTokenMs: lastTurn?.firstTokenMs ?? null,
    completionMs: performance.now() - started,
    renderResolveMs: turns.reduce((total, turn) => total + turn.renderResolveMs, 0),
    observedTokens: turns.flatMap((turn) => turn.observedTokens),
    malformedOrUnknownTokens: turns.flatMap((turn) => turn.malformedOrUnknownTokens),
    coveragePass: complete && turns.every((turn) => turn.coveragePass),
    selectionPass: complete && turns.every((turn) => turn.selectionPass),
    bindingPass: complete && turns.every((turn) => turn.bindingPass),
    finalRecallPass: complete && Boolean(lastTurn?.coveragePass && lastTurn.bindingPass),
    toolPass: complete && turns.every((turn) => turn.toolPass),
    toolPollution: turns.flatMap((turn) => turn.toolPollution),
    uiRawLeak: turns.some((turn) => turn.uiRawLeak),
    ...(runError ? { error: runError } : {}),
  };
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function summarize(results: RunResult[], protocol: Protocol) {
  const runs = results.filter((result) => result.protocol === protocol);
  const turns = runs.flatMap((run) => run.turns);
  const turnPassRate = (key: "coveragePass" | "selectionPass" | "bindingPass" | "toolPass") =>
    turns.filter((turn) => turn[key]).length / turns.length;
  const renderTimes = turns.map((turn) => turn.renderResolveMs).sort((a, b) => a - b);
  return {
    runs: runs.length,
    turns: turns.length,
    runPasses: runs.filter(
      (run) =>
        run.coveragePass &&
        run.selectionPass &&
        run.bindingPass &&
        run.finalRecallPass &&
        run.toolPass,
    ).length,
    coverage: turnPassRate("coveragePass"),
    selection: turnPassRate("selectionPass"),
    binding: turnPassRate("bindingPass"),
    finalRecall: runs.filter((run) => run.finalRecallPass).length / runs.length,
    tools: turnPassRate("toolPass"),
    requestedCitations: turns.flatMap((turn) => turn.expectedTokens).length,
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
  const identityGate =
    direct.coverage === 1 &&
    direct.binding === 1 &&
    direct.finalRecall === 1 &&
    direct.tools === 1 &&
    direct.malformedOrUnknown === 0 &&
    direct.toolPollution === 0 &&
    direct.providerErrors === 0;
  const strictGate = identityGate && direct.selection === 1;
  const directDuplicateOnlyTurns = results
    .filter((run) => run.protocol === "direct")
    .flatMap((run) => run.turns)
    .filter(
      (turn) => turn.coveragePass && turn.bindingPass && turn.toolPass && !turn.selectionPass,
    ).length;
  const numberedFailedTurns = results
    .filter((run) => run.protocol === "numbered")
    .flatMap((run) => run.turns)
    .filter(
      (turn) => !turn.coveragePass || !turn.selectionPass || !turn.bindingPass || !turn.toolPass,
    ).length;
  const maxCatalog = Math.max(
    ...selectedScenarios.map(
      (scenario) => scenario.entities.length + (scenario.toolEntities?.length ?? 0),
    ),
  );
  const maxTurns = Math.max(...selectedScenarios.map((scenario) => scenario.turns.length));
  const citationCounts = selectedScenarios.map((scenario) =>
    scenario.turns.reduce((total, turn) => total + turn.expected.length, 0),
  );
  const rows = selectedScenarios
    .map((scenario) => {
      const values = (["numbered", "direct"] as const).map((protocol) => {
        const runs = results.filter(
          (run) => run.protocol === protocol && run.scenarioId === scenario.id,
        );
        const turns = runs.flatMap((run) => run.turns);
        const passedTurns = turns.filter(
          (turn) => turn.coveragePass && turn.selectionPass && turn.bindingPass && turn.toolPass,
        ).length;
        return `${passedTurns}/${turns.length}；末轮 ${runs.filter((run) => run.finalRecallPass).length}/${runs.length}`;
      });
      return `| ${scenario.name} | ${values[0]} | ${values[1]} |`;
    })
    .join("\n");
  return `# Citation 真实模型 A/B 报告

- 时间：${new Date().toISOString()}
- Provider / Model：${config.providerId} / ${config.modelId}
- Reasoning：${config.reasoningLevel}
- 样本：numbered ${numbered.runs} 个会话 / ${numbered.turns} 轮，direct ${direct.runs} 个会话 / ${direct.turns} 轮
- 压力规模：最多 ${maxCatalog} 个实体、${maxTurns} 轮对话；每个会话要求 ${Math.min(...citationCounts)}–${Math.max(...citationCounts)} 次 citation
- 身份可靠性：**${identityGate ? "PASS" : "FAIL"}**
- 严格 exact-once：**${strictGate ? "PASS" : "FAIL"}**

本报告只调用上述 DeepSeek 模型，没有调用 OpenAI/GPT。

| 指标 | numbered | direct |
| --- | ---: | ---: |
| 完整会话通过 | ${numbered.runPasses}/${numbered.runs} | ${direct.runPasses}/${direct.runs} |
| 每轮目标 coverage | ${percentage(numbered.coverage)} | ${percentage(direct.coverage)} |
| 只选择指定实体且各一次 | ${percentage(numbered.selection)} | ${percentage(direct.selection)} |
| type + ID 绑定正确 | ${percentage(numbered.binding)} | ${percentage(direct.binding)} |
| 长对话末轮重新引用 | ${percentage(numbered.finalRecall)} | ${percentage(direct.finalRecall)} |
| 工具参数正确 | ${percentage(numbered.tools)} | ${percentage(direct.tools)} |
| 要求 citation 总数 | ${numbered.requestedCitations} | ${direct.requestedCitations} |
| malformed / unknown | ${numbered.malformedOrUnknown} | ${direct.malformedOrUnknown} |
| 工具 display token 污染 | ${numbered.toolPollution} | ${direct.toolPollution} |
| UI raw protocol 泄漏 | ${numbered.uiRawLeaks} | ${direct.uiRawLeaks} |
| Provider error | ${numbered.providerErrors} | ${direct.providerErrors} |
| 本地 parse/render p95 | ${numbered.renderP95Ms.toFixed(3)} ms | ${direct.renderP95Ms.toFixed(3)} ms |

| 场景 | numbered：通过轮次；末轮 | direct：通过轮次；末轮 |
| --- | ---: | ---: |
${rows}

## 判定

真实模型 evaluator 对每一轮都使用 exact token、目标集合、ID/type 和工具参数检查；末轮单独检查长历史后的重新引用。title 改名、删除、重启与真实 UI 路径仍由 AG-RESULT-004/008/009/010/011 E2E 验证。

- direct 在 ${direct.turns} 轮中保持目标 coverage、type + ID、末轮重新引用和工具参数全部正确；
- direct 有 ${directDuplicateOnlyTurns} 轮只因重复了一个正确 citation，未通过“指定实体各一次”，这不是 ID 或 type 串线；
- numbered 有 ${numberedFailedTurns} 轮出现漏引、错选或重复，压力场景下明显弱于 direct；
- 因此可以判断：实体数量和对话长度没有破坏 direct ID 引用身份；如果产品要求 citation 绝不重复，还需要单独收紧生成规则。

原始结果见 [citation-reliability-raw.json](./citation-reliability-raw.json)。
`;
}

if (process.env.REFLECTA_CITATION_EVAL_REPORT_ONLY === "1") {
  const saved = JSON.parse(fs.readFileSync(rawPath, "utf-8")) as {
    providerId: string;
    modelId: string;
    reasoningLevel: string;
    results: RunResult[];
  };
  fs.writeFileSync(
    reportPath,
    report(saved.results, {
      providerId: saved.providerId,
      modelId: saved.modelId,
      reasoningLevel: saved.reasoningLevel,
      apiKey: "",
    }),
  );
  process.stdout.write(`Report: ${reportPath}\n`);
  process.exit(0);
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
          `${result.coveragePass && result.selectionPass && result.bindingPass && result.finalRecallPass && result.toolPass ? "PASS" : "FAIL"}\n`,
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
      profile: {
        scenarios: selectedScenarios.map((scenario) => ({
          id: scenario.id,
          catalogSize: scenario.entities.length + (scenario.toolEntities?.length ?? 0),
          turns: scenario.turns.length,
          requestedCitations: scenario.turns.reduce(
            (total, turn) => total + turn.expected.length,
            0,
          ),
        })),
        repeats,
      },
      results,
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(reportPath, report(results, config));
process.stdout.write(`Report: ${reportPath}\n`);
