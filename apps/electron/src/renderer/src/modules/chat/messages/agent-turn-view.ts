import type { AgentContextCompacted, AgentReducedAssistantBlock } from "@shared/agent";

export type ProposalType =
  | "understanding_create"
  | "understanding_update"
  | "understanding_delete"
  | "domain_create"
  | "domain_update"
  | "domain_delete"
  | "context_create"
  | "context_update"
  | "context_delete"
  | "bash";
export type ToolApprovalStatus = "pending" | "approved" | "rejected";
export type ToolGroupType = "lookup" | "other";
export type ProposalState =
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error"
  | "input-streaming";

type AgentToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type AgentApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

export type ToolActivityView = {
  groupType: ToolGroupType;
  title: string;
  status: "running" | "done" | "failed";
  statusLabel: string;
  summary: string;
  items: ToolActivityItemView[];
};

export type ToolActivityDetailMeta = {
  label: string;
  value: string;
};

export type ToolActivityDetailRow = {
  label: string;
  title: string;
  description?: string;
  fullDescription?: string;
  format?: "text" | "pre" | "markdown";
  meta: string[];
};

export type ToolActivityDetailsView = {
  meta: ToolActivityDetailMeta[];
  rows: ToolActivityDetailRow[];
  emptyText?: string;
};

export type ToolActivityItemView = {
  toolCallId: string;
  toolName: string;
  label: string;
  status: ToolActivityView["status"];
  statusLabel: string;
  details: ToolActivityDetailsView;
  errorText?: string;
};

type ProposalBase<TType extends ProposalType, TData extends { kind: string }> = {
  toolCallId: string;
  type: TType;
  title: string;
  status?: ToolApprovalStatus;
  state: ProposalState;
  errorText?: string;
  resultRefType?: string;
  resultRefId?: string;
  approvalId?: string;
  preview?: boolean;
  result?: ToolActivityDetailsView;
  data: TData;
};

export type UnderstandingProposalView = ProposalBase<
  "understanding_create",
  {
    kind: "understanding";
    title?: string | null;
    body: string;
    domainIds: string[];
  }
>;

export type UnderstandingUpdateProposalView = ProposalBase<
  "understanding_update",
  {
    kind: "understanding-update";
    understandingId: string;
    beforeBody: string;
    afterBody: string;
    domainIds?: string[];
    reason: string;
  }
>;

export type ContextProposalView = ProposalBase<
  "context_create",
  {
    kind: "context";
    understandingId: string;
    contextLabel: string;
    content: string;
  }
>;

export type BashProposalView = ProposalBase<
  "bash",
  {
    kind: "bash";
    command: string;
    cwd?: string;
    timeoutMs?: number;
  }
>;

export type GenericProposalView = ProposalBase<
  Exclude<
    ProposalType,
    "understanding_create" | "understanding_update" | "context_create" | "bash"
  >,
  {
    kind: "generic";
    entries: Array<{ key: string; value: string; format?: "markdown" }>;
  }
>;

export type ProposalRenderData = ProposalView["data"];
export type ProposalView =
  | UnderstandingProposalView
  | UnderstandingUpdateProposalView
  | ContextProposalView
  | BashProposalView
  | GenericProposalView;

export type AgentTurnBlock =
  | {
      kind: "text";
      text: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
    }
  | { kind: "reasoning"; reasoning: AgentReasoningView }
  | { kind: "context-compaction"; compaction: AgentContextCompacted }
  | { kind: "tool-activity"; activity: ToolActivityView }
  | { kind: "proposal"; proposal: ProposalView };

export type AgentReasoningView = {
  text: string;
  status: "streaming" | "done";
};

export type AgentTurnView = {
  blocks: AgentTurnBlock[];
};

type InternalTurnBlock =
  | {
      kind: "text";
      text: string;
      state?: "streaming" | "done" | "failed";
      error?: string;
    }
  | { kind: "reasoning"; text: string; status: AgentReasoningView["status"] }
  | { kind: "context-compaction"; compaction: AgentContextCompacted }
  | { kind: "tool-group"; groupType: ToolGroupType; blocks: AgentToolBlock[] }
  | { kind: "proposal"; proposal: ProposalView };

export function buildAgentTurnView(
  blocks: AgentReducedAssistantBlock[],
  assistantRunning = false,
): AgentTurnView {
  const internalBlocks: InternalTurnBlock[] = [];
  const streamingReasoningIndex =
    assistantRunning && blocks.at(-1)?.kind === "reasoning" ? blocks.length - 1 : -1;

  for (const [index, block] of blocks.entries()) {
    if (block.kind === "text") {
      appendText(internalBlocks, block.text, block.state, block.error);
      continue;
    }
    if (block.kind === "reasoning") {
      appendReasoning(
        internalBlocks,
        block.text,
        index === streamingReasoningIndex ? "streaming" : "done",
      );
      continue;
    }
    if (block.kind === "context-compaction") {
      internalBlocks.push(block);
      continue;
    }
    if (block.kind === "approval") {
      internalBlocks.push({ kind: "proposal", proposal: proposalViewFor(block) });
      continue;
    }
    appendTool(internalBlocks, block);
  }

  return {
    blocks: internalBlocks.map(toPublicBlock),
  };
}

function toPublicBlock(block: InternalTurnBlock): AgentTurnBlock {
  if (block.kind === "tool-group") {
    return { kind: "tool-activity", activity: summarizeToolGroup(block.groupType, block.blocks) };
  }
  if (block.kind === "reasoning") {
    return {
      kind: "reasoning",
      reasoning: {
        text: block.text.trim(),
        status: block.status,
      },
    };
  }
  return block;
}

function appendText(
  blocks: InternalTurnBlock[],
  text: string,
  state?: "streaming" | "done" | "failed",
  error?: string,
) {
  if (!text && !error) return;
  const last = blocks.at(-1);
  if (!state && !error && last?.kind === "text") {
    last.text += text;
    return;
  }
  blocks.push({
    kind: "text",
    text,
    ...(state ? { state } : {}),
    ...(error ? { error } : {}),
  });
}

function appendTool(blocks: InternalTurnBlock[], block: AgentToolBlock) {
  blocks.push({ kind: "tool-group", groupType: toolGroupType(block.toolName), blocks: [block] });
}

function appendReasoning(
  blocks: InternalTurnBlock[],
  text: string,
  status: AgentReasoningView["status"],
) {
  if (!text) return;
  const last = blocks.at(-1);
  if (last?.kind === "reasoning") {
    last.text += `\n${text}`;
    last.status = last.status === "streaming" || status === "streaming" ? "streaming" : "done";
    return;
  }
  blocks.push({ kind: "reasoning", text, status });
}

function proposalViewFor(block: AgentApprovalBlock): ProposalView {
  const input = isRecord(block.payload) ? block.payload : {};
  const output = isRecord(block.output) ? block.output : {};
  const type = proposalTypeFor(block.toolName);
  const result = proposalResultDetails(type, output, block.displayState);
  const base = {
    toolCallId: block.toolCallId,
    title: block.title || proposalTitle(type),
    status: approvalStatus(block),
    state: proposalState(block),
    errorText: block.error,
    resultRefType: stringValue(output.resultRefType),
    resultRefId: stringValue(output.resultRefId),
    approvalId: block.approvalId,
    preview: block.preview,
    ...(result ? { result } : {}),
  };

  if (type === "understanding_create") {
    return { ...base, type, data: understandingProposalData(input) };
  }
  if (type === "understanding_update") {
    return { ...base, type, data: understandingUpdateProposalData(input) };
  }
  if (type === "context_create") {
    return { ...base, type, data: contextProposalData(input) };
  }
  if (type === "bash") {
    return { ...base, type, data: bashProposalData(input) };
  }
  return { ...base, type, data: genericProposalData(input) };
}

function proposalTypeFor(toolName: string): ProposalType {
  if (toolName === "understanding_create") return "understanding_create";
  if (toolName === "understanding_update") return "understanding_update";
  if (toolName === "understanding_delete") return "understanding_delete";
  if (toolName === "domain_create") return "domain_create";
  if (toolName === "domain_update") return "domain_update";
  if (toolName === "domain_delete") return "domain_delete";
  if (toolName === "context_create") return "context_create";
  if (toolName === "context_update") return "context_update";
  if (toolName === "context_delete") return "context_delete";
  if (toolName === "bash") return "bash";
  return "understanding_create";
}

function approvalStatus(block: AgentApprovalBlock): ToolApprovalStatus | undefined {
  if (block.approvalState === "pending") return "pending";
  if (block.approvalState === "rejected") return "rejected";
  return block.approved ? "approved" : undefined;
}

function proposalState(block: AgentApprovalBlock): ProposalState {
  if (block.preview) return "input-streaming";
  if (block.displayState === "pending_approval") return "approval-requested";
  if (block.displayState === "running") return "approval-responded";
  if (block.displayState === "rejected") return "output-denied";
  if (block.displayState === "completed") return "output-available";
  if (block.displayState === "failed") return "output-error";
  return "input-streaming";
}

function proposalTitle(type: ProposalType) {
  if (type === "understanding_create") return "候选 Understanding";
  if (type === "understanding_update") return "候选修改";
  if (type === "context_create") return "候选 Context";
  if (type === "understanding_delete") return "候选删除 Understanding";
  if (type === "domain_create") return "候选 Domain";
  if (type === "domain_update") return "候选修改 Domain";
  if (type === "domain_delete") return "候选删除 Domain";
  if (type === "context_update") return "候选修改 Context";
  if (type === "context_delete") return "候选删除 Context";
  if (type === "bash") return "执行 Bash";
  return "候选操作";
}

function understandingProposalData(
  output: Record<string, unknown>,
): UnderstandingProposalView["data"] {
  return {
    kind: "understanding",
    title: nullableStringValue(output.title),
    body: stringValue(output.body),
    domainIds: stringArray(output.domainIds),
  };
}

function understandingUpdateProposalData(
  output: Record<string, unknown>,
): UnderstandingUpdateProposalView["data"] {
  const before = isRecord(output.before) ? output.before : {};
  const after = isRecord(output.after) ? output.after : output;
  const domainIds = optionalStringArray(after.domainIds) ?? optionalStringArray(output.domainIds);
  return {
    kind: "understanding-update",
    understandingId: stringValue(output.understandingId),
    beforeBody: stringValue(before.body),
    afterBody: stringValue(after.body),
    ...(domainIds !== undefined ? { domainIds } : {}),
    reason: stringValue(output.reason),
  };
}

function contextProposalData(output: Record<string, unknown>): ContextProposalView["data"] {
  return {
    kind: "context",
    understandingId: stringValue(output.understandingId),
    contextLabel: stringValue(output.title) || stringValue(output.medium),
    content: stringValue(output.content),
  };
}

function proposalResultDetails(
  type: ProposalType,
  output: Record<string, unknown>,
  displayState: AgentApprovalBlock["displayState"],
) {
  if (displayState !== "completed") return undefined;
  if (type === "bash") return bashDetails(output);

  const resultRefId = stringValue(output.resultRefId);
  if (!resultRefId) return undefined;
  return detailView({
    rows: [
      detailRow(
        "执行结果",
        `${proposalResultTypeLabel(stringValue(output.resultRefType))} 已完成`,
        resultRefId,
        [],
        "text",
      ),
    ],
  });
}

function proposalResultTypeLabel(type: string) {
  if (type === "understanding") return "Understanding";
  if (type === "domain") return "Domain";
  if (type === "context") return "Context";
  return "操作";
}

function bashProposalData(output: Record<string, unknown>): BashProposalView["data"] {
  const cwd = stringValue(output.cwd).trim();
  const timeoutMs = typeof output.timeoutMs === "number" ? output.timeoutMs : undefined;
  return {
    kind: "bash",
    command: stringValue(output.command),
    ...(cwd ? { cwd } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

function genericProposalData(output: Record<string, unknown>): GenericProposalView["data"] {
  return {
    kind: "generic",
    entries: Object.entries(output)
      .filter(([key, value]) => key !== "proposalType" && value !== undefined)
      .map(([key, value]) => {
        const format = genericProposalEntryFormat(key);
        return { key, value: proposalValue(value), ...(format ? { format } : {}) };
      }),
  };
}

function genericProposalEntryFormat(
  key: string,
): GenericProposalView["data"]["entries"][number]["format"] {
  if (key === "body" || key === "content") return "markdown";
  return undefined;
}

function proposalValue(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.join(", ");
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}

function summarizeToolGroup(groupType: ToolGroupType, blocks: AgentToolBlock[]): ToolActivityView {
  const status = blocks.some((block) => block.state === "failed")
    ? "failed"
    : blocks.every((block) => block.state === "completed")
      ? "done"
      : "running";
  const title = toolActivityTitle(groupType, blocks);
  const summary =
    status === "running"
      ? blocks.length === 1 && blocks[0]
        ? toolItemView(blocks[0]).label
        : runningSummary(groupType)
      : status === "failed"
        ? failedSummary(title, blocks)
        : doneSummary(groupType, blocks);

  return {
    groupType,
    title,
    status,
    statusLabel: status === "failed" ? "出错" : status === "running" ? "运行中" : "完成",
    summary,
    items: blocks.map(toolItemView),
  };
}

function toolGroupType(name: string): ToolGroupType {
  if (
    name === "search" ||
    name === "graph" ||
    name === "web_search" ||
    name === "fetch_content" ||
    name === "get_search_content" ||
    name.startsWith("understanding_") ||
    name.startsWith("context_") ||
    name.startsWith("domain_") ||
    name === "read" ||
    name === "attachment_read"
  ) {
    return "lookup";
  }
  return "other";
}

function toolOutput(block: AgentToolBlock): unknown {
  return block.state === "completed" ? block.output : undefined;
}

function toolInput(block: AgentToolBlock): Record<string, unknown> {
  return isRecord(block.input) ? block.input : {};
}

function toolItemView(block: AgentToolBlock): ToolActivityItemView {
  const toolName = block.toolName;
  if (block.state === "failed") {
    return {
      toolCallId: block.toolCallId,
      toolName,
      label: `${toolDoneVerb(toolName)}失败`,
      status: "failed",
      statusLabel: "出错",
      details: toolDetails(block),
      errorText: block.error,
    };
  }
  if (block.state !== "completed") {
    return {
      toolCallId: block.toolCallId,
      toolName,
      label: toolRunningSummary(toolName, toolInput(block)),
      status: "running",
      statusLabel: "运行中",
      details: toolDetails(block),
    };
  }
  return {
    toolCallId: block.toolCallId,
    toolName,
    label: toolDoneSummary(toolName, toolInput(block), toolOutput(block)),
    status: "done",
    statusLabel: "完成",
    details: toolDetails(block),
  };
}

function runningSummary(groupType: ToolGroupType) {
  if (groupType === "lookup") return "正在查找相关内容";
  return "正在使用工具";
}

function doneSummary(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolItemView(blocks[0]).label;
  if (groupType === "lookup") {
    return joinedToolLabels(blocks);
  }
  return joinedToolLabels(blocks);
}

function failedSummary(title: string, blocks: AgentToolBlock[]) {
  const failedItems = blocks.filter((block) => block.state === "failed").map(toolItemView);
  if (failedItems.length === 1) return failedItems[0]?.label ?? `${title}时遇到问题`;
  return `${title}时遇到 ${failedItems.length} 个问题`;
}

function joinedToolLabels(blocks: AgentToolBlock[]) {
  const labels = blocks.map((block) => toolItemView(block).label);
  const visible = labels.slice(0, 2).join("；");
  return labels.length > 2 ? `${visible} 等 ${labels.length} 步` : visible || "使用了工具";
}

function toolActivityTitle(groupType: ToolGroupType, blocks: AgentToolBlock[]) {
  if (blocks.length === 1 && blocks[0]) return toolTitle(blocks[0].toolName);
  if (groupType === "lookup") return "查找相关内容";
  return "使用工具";
}

function toolTitle(name: string) {
  if (name === "domain_list") return "列出 Domain";
  if (name === "domain_inspect") return "查看 Domain";
  if (name === "understanding_list") return "列出 Understanding";
  if (name === "understanding_get") return "读取 Understanding";
  if (name === "context_list") return "列出 Context";
  if (name === "context_get") return "读取 Context";
  if (name === "web_search") return "搜索网页";
  if (name === "fetch_content") return "读取来源";
  if (name === "get_search_content") return "读取搜索内容";
  if (name === "retrieve_knowledge") return "检索知识";
  if (name === "search") return "搜索相关内容";
  if (name === "graph") return "查看关联图";
  if (name === "attachment_read") return "读取附件";
  if (name === "read") return "读取本地文件";
  if (name === "edit") return "编辑本地文件";
  if (name === "write") return "写入本地文件";
  if (name === "bash") return "执行 Bash";
  return "使用工具";
}

function toolRunningVerb(name: string) {
  if (name === "attachment_read") return "正在读取附件";
  if (name === "read") return "正在读取本地文件";
  if (name === "edit") return "正在编辑本地文件";
  if (name === "write") return "正在写入本地文件";
  if (name === "bash") return "正在执行 Bash";
  if (name === "web_search") return "正在搜索网页";
  if (name === "fetch_content") return "正在读取来源";
  if (name === "get_search_content") return "正在读取搜索内容";
  if (name === "retrieve_knowledge") return "正在检索知识";
  if (name.includes("search")) return "正在搜索相关内容";
  if (name === "graph") return "正在查看关联图";
  if (name.includes("get")) return "正在读取内容";
  if (name.startsWith("domain_")) return "正在查看领域目录";
  return "正在使用工具";
}

function queryLabel(input: Record<string, unknown>) {
  const query = stringValue(input.query).trim();
  if (query) return `「${query}」`;
  const queries = arrayValue(input.queries)
    .map(stringValue)
    .map((item) => item.trim())
    .filter(Boolean);
  if (queries.length === 1) return `「${queries[0]}」`;
  return queries.length > 1 ? `「${queries[0]}」等 ${queries.length} 个查询` : "";
}

function readRangeLabel(input: Record<string, unknown>) {
  if (input.offset === undefined && input.limit === undefined) return "";
  const offset =
    typeof input.offset === "number" && input.offset > 0 ? Math.floor(input.offset) : 1;
  const limit =
    typeof input.limit === "number" && input.limit > 0 ? Math.floor(input.limit) : undefined;
  return limit === undefined ? `从第 ${offset} 行开始` : `第 ${offset} 行起，最多 ${limit} 行`;
}

function toolDetails(block: AgentToolBlock): ToolActivityDetailsView {
  const input = toolInput(block);
  const output = toolOutput(block);
  const meta = inputMeta(block.toolName, input);
  if (block.state !== "completed") return detailView({ meta });

  const resultDetails = toolResultDetails(block.toolName, output, input);
  return detailView({
    meta: [...meta, ...resultDetails.meta],
    rows: resultDetails.rows,
    emptyText: resultDetails.emptyText,
  });
}

function inputMeta(name: string, input: Record<string, unknown>): ToolActivityDetailMeta[] {
  const meta: ToolActivityDetailMeta[] = [];
  const query = stringValue(input.query).trim();
  if (query) meta.push({ label: "查询", value: query });
  const queries = arrayValue(input.queries)
    .map(stringValue)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!query && queries.length > 0) meta.push({ label: "查询", value: queries.join("；") });
  if (name === "fetch_content" || name === "get_search_content") {
    const url = stringValue(input.url).trim();
    if (url) meta.push({ label: "来源", value: url });
  }
  if (name === "fetch_content") {
    const urls = arrayValue(input.urls).map(stringValue).filter(Boolean);
    if (!stringValue(input.url).trim() && urls.length > 0) {
      meta.push({ label: "来源", value: urls.join("；") });
    }
  }
  if (name === "read" || name === "edit" || name === "write") {
    const path = stringValue(input.path).trim();
    if (path) meta.push({ label: "文件", value: filenameFromPath(path) });
  }
  if (name === "read") {
    const range = readRangeLabel(input);
    if (range) meta.push({ label: "范围", value: range });
  }
  if (name === "bash") {
    const command = stringValue(input.command).trim();
    const cwd = stringValue(input.cwd).trim();
    if (command) meta.push({ label: "命令", value: truncateText(command, 120) });
    if (cwd) meta.push({ label: "目录", value: cwd });
  }
  return meta;
}

function toolResultDetails(
  name: string,
  output: unknown,
  input: Record<string, unknown>,
): ToolActivityDetailsView {
  if (name === "search") return searchHitDetails(output);
  if (name === "retrieve_knowledge") return retrievalCandidateDetails(output);
  if (name === "attachment_read") return attachmentReadDetails(output);
  if (name === "read") return readFileDetails(output, input);
  if (name === "edit") return editFileDetails(output);
  if (name === "bash") return bashDetails(output);
  if (name === "domain_list") return recordListDetails(output, "Domain", "domains");
  if (name === "understanding_list")
    return recordListDetails(output, "Understanding", "understandings");
  if (name === "context_list") return recordListDetails(output, "Context", "contexts");
  if (name === "domain_inspect") return inspectDomainDetails(output);
  if (name === "understanding_get")
    return recordDetailView(entityRecord(output, "understanding"), "Understanding");
  if (name === "context_get") return recordDetailView(entityRecord(output, "context"), "Context");
  if (name === "graph") return graphDetails(output);
  return detailView({});
}

function attachmentReadDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const filename = stringValue(output.filename);
  const content = stringValue(output.content);
  const error = stringValue(output.error);
  const meta = [
    output.kind ? `${String(output.kind).toUpperCase()} 附件` : "",
    typeof output.totalPages === "number" ? `${output.totalPages} 页` : "",
    output.truncated ? "内容已截断" : "",
  ].filter(Boolean);
  return detailView({
    rows: content ? [detailRow("附件内容", filename || "附件", content, meta)] : [],
    emptyText: error ? `附件暂时无法读取：${truncateText(error)}` : undefined,
  });
}

function readFileDetails(output: unknown, input: Record<string, unknown>) {
  if (!isRecord(output)) return detailView({});
  const content = stringValue(output.content);
  const meta = [output.truncated ? "内容已截断" : ""].filter(Boolean);
  return detailView({
    rows: content
      ? [
          detailRow(
            "文件内容",
            filenameFromPath(stringValue(input.path)) || "本地文件",
            content,
            meta,
          ),
        ]
      : [],
  });
}

function editFileDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const patch = stringValue(output.patch) || stringValue(output.diff);
  return detailView({
    rows: patch ? [detailRow("文件修改", "Diff", patch, [], "pre")] : [],
  });
}

function bashDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const meta: ToolActivityDetailMeta[] = [];
  if (typeof output.exitCode === "number" || output.exitCode === null)
    meta.push({ label: "退出码", value: String(output.exitCode) });
  const stdout = stringValue(output.stdout);
  const stderr = stringValue(output.stderr);
  const rowMeta = [output.timedOut ? "命令超时" : "", output.truncated ? "输出已截断" : ""].filter(
    Boolean,
  );
  return detailView({
    meta,
    rows: [
      stdout ? detailRow("stdout", "标准输出", stdout, rowMeta, "pre") : undefined,
      stderr ? detailRow("stderr", "错误输出", stderr, rowMeta, "pre") : undefined,
    ].filter((row): row is ToolActivityDetailRow => Boolean(row)),
    emptyText: stdout || stderr ? undefined : "命令没有输出。",
  });
}

function searchHitDetails(output: unknown) {
  const hits = isRecord(output) ? arrayValue(output.hits) : [];
  return detailView({
    rows: limitedRows(
      hits.map((hit) => {
        if (!isRecord(hit)) return undefined;
        if (hit.type === "understanding") {
          const understanding = isRecord(hit.understanding) ? hit.understanding : {};
          return detailRow(
            "Understanding",
            entityTitle(understanding),
            stringValue(hit.matchedText) || stringValue(understanding.body),
            domainMeta(understanding),
            "markdown",
          );
        }
        if (hit.type === "context") {
          const context = isRecord(hit.context) ? hit.context : {};
          return detailRow(
            "Context",
            contextTitle(context),
            stringValue(hit.matchedText),
            contextMeta(context),
            "markdown",
          );
        }
        return undefined;
      }),
    ),
    emptyText: hits.length === 0 ? "没有搜索到相关内容。" : undefined,
  });
}

function retrievalCandidateDetails(output: unknown) {
  const candidates = isRecord(output) ? arrayValue(output.candidates) : [];
  const rows = candidates.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const contexts = arrayValue(candidate.matchedContexts).length;
    return [
      detailRow(
        "Understanding",
        entityTitle(candidate),
        stringValue(candidate.snippet),
        contexts > 0 ? [`${contexts} 条 Context 证据`] : [],
        "markdown",
      ),
      ...arrayValue(candidate.matchedContexts)
        .slice(0, 2)
        .map((context) =>
          isRecord(context)
            ? detailRow(
                "Context 证据",
                contextTitle(context),
                stringValue(context.snippet),
                contextMeta(context),
                "markdown",
              )
            : undefined,
        ),
    ];
  });
  return detailView({
    rows: limitedRows(rows),
    emptyText: candidates.length === 0 ? "没有找到直接相关的理解。" : undefined,
  });
}

function recordListDetails(output: unknown, label: string, emptyLabel: string) {
  const records = Array.isArray(output)
    ? output
    : isRecord(output)
      ? arrayValue(output[emptyLabel])
      : [];
  return detailView({
    rows: limitedRows(
      records.map((record) =>
        isRecord(record)
          ? detailRow(
              label,
              label === "Context" ? contextTitle(record) : entityTitle(record),
              recordText(record),
              [...domainMeta(record), ...contextMeta(record)],
              "markdown",
            )
          : undefined,
      ),
    ),
    emptyText: records.length === 0 ? "没有找到相关内容。" : undefined,
  });
}

function inspectDomainDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const domain = entityRecord(output, "domain");
  const understandings = arrayValue(output.understandings);
  const contexts = arrayValue(output.contexts);
  const domains = arrayValue(output.domains);
  return detailView({
    rows: limitedRows([
      detailRow(
        "Domain",
        entityTitle(domain),
        undefined,
        [
          `${understandings.length} 条 Understanding`,
          `${contexts.length} 条 Context`,
          domains.length > 0 ? `${domains.length} 个子 Domain` : "",
        ].filter(Boolean),
      ),
      ...domains.map((record) =>
        isRecord(record) ? detailRow("子 Domain", entityTitle(record)) : undefined,
      ),
      ...understandings.map((record) =>
        isRecord(record)
          ? detailRow(
              "Understanding",
              entityTitle(record),
              recordText(record),
              domainMeta(record),
              "markdown",
            )
          : undefined,
      ),
      ...contexts.map((record) =>
        isRecord(record)
          ? detailRow(
              "Context",
              contextTitle(record),
              recordText(record),
              contextMeta(record),
              "markdown",
            )
          : undefined,
      ),
    ]),
  });
}

function recordDetailView(record: Record<string, unknown>, label: string) {
  return detailView({
    rows: [
      detailRow(
        label,
        label === "Context" ? contextTitle(record) : entityTitle(record),
        recordText(record),
        [...domainMeta(record), ...contextMeta(record), ...recordCountMeta(record)],
        "markdown",
      ),
      ...arrayValue(record.contexts)
        .slice(0, 3)
        .map((context) =>
          isRecord(context)
            ? detailRow(
                "Context",
                contextTitle(context),
                recordText(context),
                contextMeta(context),
                "markdown",
              )
            : undefined,
        ),
      ...arrayValue(record.relations)
        .slice(0, 3)
        .map((relation) =>
          isRecord(relation)
            ? detailRow(
                "关联",
                relationTitle(relation),
                stringValue(relation.rawText),
                [relation.direction === "incoming" ? "被引用" : "引用"].filter(Boolean),
              )
            : undefined,
        ),
    ].filter((row): row is ToolActivityDetailRow => Boolean(row)),
  });
}

function graphDetails(output: unknown) {
  if (!isRecord(output)) return detailView({});
  const nodes = arrayValue(output.nodes);
  const edges = arrayValue(output.edges);
  return detailView({
    meta: [{ label: "关联", value: `${edges.length} 条` }],
    rows: limitedRows(
      nodes.map((node) =>
        isRecord(node)
          ? detailRow(
              "Understanding",
              entityTitle(node),
              recordText(node),
              domainMeta(node),
              "markdown",
            )
          : undefined,
      ),
    ),
    emptyText: nodes.length === 0 ? "这条 Understanding 暂时没有显式关联。" : undefined,
  });
}

function entityRecord(output: unknown, key: string) {
  if (!isRecord(output)) return {};
  const nested = output[key];
  return isRecord(nested) ? nested : output;
}

function detailView({
  meta = [],
  rows = [],
  emptyText,
}: {
  meta?: ToolActivityDetailMeta[];
  rows?: Array<ToolActivityDetailRow | undefined>;
  emptyText?: string;
}): ToolActivityDetailsView {
  const seenMeta = new Set<string>();
  const view = {
    meta: meta.filter((item) => {
      const key = `${item.label}:${item.value}`;
      if (!item.value.trim() || seenMeta.has(key)) return false;
      seenMeta.add(key);
      return true;
    }),
    rows: rows.filter((row): row is ToolActivityDetailRow => Boolean(row)),
  };
  return emptyText ? { ...view, emptyText } : view;
}

function detailRow(
  label: string,
  title?: string,
  description?: string,
  meta: string[] = [],
  format: ToolActivityDetailRow["format"] = "text",
): ToolActivityDetailRow {
  const keepsLineBreaks = format === "pre" || format === "markdown";
  const compactDescription = description
    ? keepsLineBreaks
      ? truncateOutputPreview(description)
      : truncateText(description, 140)
    : undefined;
  const shouldKeepFullDescription =
    keepsLineBreaks &&
    description &&
    compactDescription &&
    description.trim() !== compactDescription.trim();
  return {
    label,
    title: title || "未命名",
    meta: meta.filter(Boolean),
    ...(format !== "text" ? { format } : {}),
    ...(compactDescription ? { description: compactDescription } : {}),
    ...(shouldKeepFullDescription ? { fullDescription: description } : {}),
  };
}

function limitedRows(rows: Array<ToolActivityDetailRow | undefined>) {
  const filtered = rows.filter((row): row is ToolActivityDetailRow => Boolean(row));
  const visible = filtered.slice(0, 8);
  return filtered.length > visible.length
    ? [...visible, detailRow("更多", `还有 ${filtered.length - visible.length} 条结果`)]
    : visible;
}

function truncateText(text: string, maxLength = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function truncateOutputPreview(text: string, maxLength = 1200, maxLines = 16) {
  const normalized = text.trim();
  if (!normalized) return "";
  const lines = normalized.split(/\r?\n/);
  const lineLimited =
    lines.length > maxLines ? `${lines.slice(0, maxLines).join("\n")}\n...` : normalized;
  return lineLimited.length > maxLength ? `${lineLimited.slice(0, maxLength)}\n...` : lineLimited;
}

function toolRunningSummary(name: string, input: Record<string, unknown>) {
  if (name === "web_search") return `正在搜索网页${queryLabel(input)}`;
  if (name === "search") return `正在搜索${queryLabel(input) || "相关内容"}`;
  if (name === "retrieve_knowledge") return `正在检索${queryLabel(input) || "知识"}`;
  if (name === "read") {
    const range = readRangeLabel(input);
    return `正在读取「${filenameFromPath(stringValue(input.path)) || "本地文件"}」${range ? ` · ${range}` : ""}`;
  }
  return toolRunningVerb(name);
}

function toolDoneVerb(name: string) {
  if (name === "attachment_read") return "读取附件";
  if (name === "read") return "读取本地文件";
  if (name === "edit") return "编辑本地文件";
  if (name === "write") return "写入本地文件";
  if (name === "bash") return "执行 Bash";
  if (name === "web_search") return "搜索网页";
  if (name === "fetch_content") return "读取来源";
  if (name === "get_search_content") return "读取搜索内容";
  if (name === "retrieve_knowledge") return "检索";
  if (name.includes("search")) return "搜索";
  if (name === "graph") return "查看关联图";
  if (name.includes("get")) return "读取";
  if (name.startsWith("domain_")) return "查看领域目录";
  return "使用工具";
}

function toolDoneSummary(name: string, input: Record<string, unknown>, output: unknown) {
  const outputRecord = isRecord(output) ? output : {};
  if (name === "read") {
    const path = stringValue(input.path);
    const range = readRangeLabel(input);
    return `读取了「${filenameFromPath(path) || "本地文件"}」${range ? ` · ${range}` : ""}`;
  }
  if (name === "edit") {
    return `编辑了「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`;
  }
  if (name === "write") {
    return `写入了「${filenameFromPath(stringValue(input.path)) || "本地文件"}」`;
  }
  if (name === "attachment_read") {
    return `读取了「${stringValue(outputRecord.filename) || stringValue(input.attachmentId) || "附件"}」`;
  }
  if (name === "web_search") return `已搜索网页${queryLabel(input)}`;
  if (name === "fetch_content") return "已读取来源";
  if (name === "get_search_content") return "已读取搜索内容";
  if (name === "bash") {
    const command = stringValue(input.command).trim();
    return `执行了 Bash${command ? ` · ${command}` : ""}`;
  }
  if (name === "domain_list") return `列出 ${outputCount(output, "domains")} 个 Domain`;
  if (name === "domain_inspect") {
    return `查看了「${entityTitle(outputRecord.domain) || entityTitle(outputRecord) || stringValue(input.domainId) || "领域"}」下的内容`;
  }
  if (name === "understanding_list") {
    return `列出 ${outputCount(output, "understandings")} 条 Understanding`;
  }
  if (name === "search") {
    const counts = searchHitCounts(output);
    const query = queryLabel(input);
    return query
      ? `搜索${query} · ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context`
      : `搜索了 ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context`;
  }
  if (name === "retrieve_knowledge") {
    const counts = retrievalCandidateCounts(output);
    const query = queryLabel(input);
    return query
      ? `检索${query} · ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context 证据`
      : `检索到 ${counts.understandings} 条 Understanding / ${counts.contexts} 条 Context 证据`;
  }
  if (name === "graph") {
    return `查看了 ${outputCount(output, "nodes")} 条 Understanding 的关联图`;
  }
  if (name === "understanding_get")
    return `读取了「${entityTitle(outputRecord.understanding) || entityTitle(outputRecord) || stringValue(input.understandingId) || "Understanding"}」`;
  if (name === "context_list") return `列出 ${outputCount(output, "contexts")} 条 Context`;
  if (name === "context_get")
    return `读取了「${entityTitle(outputRecord.context) || entityTitle(outputRecord) || stringValue(input.contextId) || "Context"}」`;
  return `使用了 ${name}`;
}

function entityTitle(value: unknown) {
  if (!isRecord(value)) return undefined;
  return stringValue(value.title) || stringValue(value.name);
}

function contextTitle(value: Record<string, unknown>) {
  return entityTitle(value) || mediumLabel(stringValue(value.medium)) || "Context";
}

function recordText(value: Record<string, unknown>) {
  return stringValue(value.body) || stringValue(value.content) || stringValue(value.snippet);
}

function domainMeta(value: Record<string, unknown>) {
  const domains = arrayValue(value.domains)
    .map(entityTitle)
    .filter((name): name is string => Boolean(name));
  return domains.length > 0 ? [`Domain：${domains.join("、")}`] : [];
}

function contextMeta(value: Record<string, unknown>) {
  const medium = mediumLabel(stringValue(value.medium));
  return medium ? [`类型：${medium}`] : [];
}

function recordCountMeta(value: Record<string, unknown>) {
  return [
    numberMeta(value.contextCount, "Context"),
    numberMeta(value.referenceCount, "引用"),
    numberMeta(value.referencedByCount, "被引用"),
    numberMeta(value.connectionCount, "关联"),
  ].filter((item): item is string => Boolean(item));
}

function numberMeta(value: unknown, label: string) {
  return typeof value === "number" ? `${value} 条${label}` : undefined;
}

function relationTitle(value: Record<string, unknown>) {
  const direction = stringValue(value.direction);
  if (direction === "incoming") return stringValue(value.sourceTitle) || "被引用的 Understanding";
  return stringValue(value.targetTitle) || "引用的 Understanding";
}

function mediumLabel(value: string) {
  if (value === "experience") return "实践";
  if (value === "video") return "视频";
  if (value === "book") return "书籍";
  if (value === "article") return "文章";
  if (value === "opinion") return "观点";
  if (value === "ai") return "AI 对话";
  if (value === "other") return "其他";
  return "";
}

function filenameFromPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.split(/[\\/]/).filter(Boolean).at(-1) ?? trimmed;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function outputCount(output: unknown, key: string) {
  if (Array.isArray(output)) return output.length;
  return isRecord(output) ? arrayValue(output[key]).length : 0;
}

function searchHitCounts(output: unknown) {
  const hits = isRecord(output) ? arrayValue(output.hits) : [];
  let understandings = 0;
  let contexts = 0;
  for (const hit of hits) {
    if (!isRecord(hit)) continue;
    if (hit.type === "understanding") understandings += 1;
    if (hit.type === "context") contexts += 1;
  }
  return { understandings, contexts };
}

function retrievalCandidateCounts(output: unknown) {
  const candidates = isRecord(output) ? arrayValue(output.candidates) : [];
  let contexts = 0;
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    contexts += arrayValue(candidate.matchedContexts).length;
  }
  return { understandings: candidates.length, contexts };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function optionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" || value === null ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
