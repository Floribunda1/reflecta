import type { AgentReducedAssistantBlock } from "@shared/agent";

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

export type ToolActivityItemView = {
  toolCallId: string;
  toolName: string;
  label: string;
  status: ToolActivityView["status"];
  statusLabel: string;
  details: string[];
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

export type GenericProposalView = ProposalBase<
  Exclude<ProposalType, "understanding_create" | "understanding_update" | "context_create">,
  {
    kind: "generic";
    entries: Array<{ key: string; value: string }>;
  }
>;

export type ProposalRenderData = ProposalView["data"];
export type ProposalView =
  | UnderstandingProposalView
  | UnderstandingUpdateProposalView
  | ContextProposalView
  | GenericProposalView;

export type AgentTurnBlock =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; reasoning: AgentReasoningView }
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
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string; status: AgentReasoningView["status"] }
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
      appendText(internalBlocks, block.text);
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
    if (block.kind === "approval") {
      internalBlocks.push({ kind: "proposal", proposal: proposalViewFor(block) });
      continue;
    }
    appendTool(internalBlocks, toolGroupType(block.toolName), block);
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

function appendText(blocks: InternalTurnBlock[], text: string) {
  if (!text) return;
  const last = blocks.at(-1);
  if (last?.kind === "text") {
    last.text += text;
    return;
  }
  blocks.push({ kind: "text", text });
}

function appendTool(blocks: InternalTurnBlock[], groupType: ToolGroupType, block: AgentToolBlock) {
  blocks.push({ kind: "tool-group", groupType, blocks: [block] });
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
  const base = {
    toolCallId: block.toolCallId,
    title: block.title || proposalTitle(type),
    status: approvalStatus(block),
    state: proposalState(block),
    errorText: block.error,
    resultRefType: stringValue(output.resultRefType),
    resultRefId: stringValue(output.resultRefId),
    approvalId: block.approvalId,
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
  if (block.state === "pending") return "pending";
  if (block.state === "rejected") return "rejected";
  if (block.state === "approved") return "approved";
  if (block.state === "completed") return block.approved ? "approved" : undefined;
  return block.approved ? "approved" : undefined;
}

function proposalState(block: AgentApprovalBlock): ProposalState {
  if (block.state === "pending") return "approval-requested";
  if (block.state === "approved") return "approval-responded";
  if (block.state === "rejected") return "output-denied";
  if (block.state === "completed") return "output-available";
  if (block.state === "failed") return "output-error";
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
  return {
    kind: "understanding-update",
    understandingId: stringValue(output.understandingId),
    beforeBody: stringValue(before.body),
    afterBody: stringValue(after.body),
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

function genericProposalData(output: Record<string, unknown>): GenericProposalView["data"] {
  return {
    kind: "generic",
    entries: Object.entries(output)
      .filter(([key, value]) => key !== "proposalType" && value !== undefined)
      .map(([key, value]) => ({ key, value: proposalValue(value) })),
  };
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
    name === "web_fetch" ||
    name.startsWith("understanding_") ||
    name.startsWith("context_") ||
    name.startsWith("domain_") ||
    name === "file_read" ||
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
    const counts = aggregateLookupCounts(blocks);
    if (counts.understandings || counts.contexts) {
      return `搜索 ${counts.understandings} 条 Understanding，读取 ${counts.contexts} 条 Context`;
    }
    return "查找了相关内容";
  }
  return "使用了工具";
}

function failedSummary(title: string, blocks: AgentToolBlock[]) {
  const failedItems = blocks.filter((block) => block.state === "failed").map(toolItemView);
  if (failedItems.length === 1) return failedItems[0]?.label ?? `${title}时遇到问题`;
  return `${title}时遇到 ${failedItems.length} 个问题`;
}

function aggregateLookupCounts(blocks: AgentToolBlock[]) {
  let understandings = 0;
  let contexts = 0;
  for (const block of blocks) {
    if (block.state !== "completed") continue;
    const name = block.toolName;
    const output = toolOutput(block);
    if (name === "understanding_list") {
      understandings += outputCount(output, "understandings");
    }
    if (name === "context_list") {
      contexts += outputCount(output, "contexts");
    }
    if (name === "search") {
      const counts = searchHitCounts(output);
      understandings += counts.understandings;
      contexts += counts.contexts;
    }
    if (name === "retrieve_knowledge") {
      const counts = retrievalCandidateCounts(output);
      understandings += counts.understandings;
      contexts += counts.contexts;
    }
    if (name === "graph") {
      understandings += outputCount(output, "nodes");
      contexts += outputCount(output, "contexts");
    }
  }
  return { understandings, contexts };
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
  if (name === "web_fetch") return "读取网页";
  if (name === "retrieve_knowledge") return "检索知识";
  if (name === "search") return "搜索相关内容";
  if (name === "graph") return "查看关联图";
  if (name === "attachment_read") return "读取附件";
  if (name === "file_read") return "读取本地文件";
  if (name === "bash") return "执行 Bash";
  return "使用工具";
}

function toolRunningVerb(name: string) {
  if (name === "attachment_read") return "正在读取附件";
  if (name === "file_read") return "正在读取本地文件";
  if (name === "bash") return "正在执行 Bash";
  if (name === "web_fetch") return "正在读取网页";
  if (name === "retrieve_knowledge") return "正在检索知识";
  if (name.includes("search")) return "正在搜索相关内容";
  if (name === "graph") return "正在查看关联图";
  if (name.includes("get")) return "正在读取内容";
  if (name.startsWith("domain_")) return "正在查看领域目录";
  return "正在使用工具";
}

function queryLabel(input: Record<string, unknown>) {
  const query = stringValue(input.query).trim();
  return query ? `「${query}」` : "";
}

function toolDetails(block: AgentToolBlock): string[] {
  const input = toolInput(block);
  const output = toolOutput(block);
  const details = inputDetails(input);
  if (block.state !== "completed") return details;

  const resultDetails = toolResultDetails(block.toolName, output);
  return resultDetails.length > 0 ? [...details, ...resultDetails] : details;
}

function inputDetails(input: Record<string, unknown>) {
  const details: string[] = [];
  const query = stringValue(input.query).trim();
  if (query) details.push(`查询：${query}`);
  for (const key of [
    "url",
    "attachmentId",
    "path",
    "command",
    "cwd",
    "limit",
    "offset",
    "maxBytes",
    "maxChars",
    "timeoutMs",
    "domainId",
    "understandingId",
    "contextId",
  ]) {
    const value = input[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      details.push(`${key}：${value}`);
    }
  }
  return details;
}

function toolResultDetails(name: string, output: unknown): string[] {
  if (name === "search") return searchHitDetails(output);
  if (name === "retrieve_knowledge") return retrievalCandidateDetails(output);
  if (name === "attachment_read") return attachmentReadDetails(output);
  if (name === "file_read") return fileReadDetails(output);
  if (name === "bash") return bashDetails(output);
  if (name === "web_fetch") return webFetchDetails(output);
  if (name === "domain_list") return recordListDetails(output, "Domain", "domains");
  if (name === "understanding_list")
    return recordListDetails(output, "Understanding", "understandings");
  if (name === "context_list") return recordListDetails(output, "Context", "contexts");
  if (name === "domain_inspect") return inspectDomainDetails(output);
  if (name === "understanding_get")
    return recordDetails(entityRecord(output, "understanding"), "Understanding");
  if (name === "context_get") return recordDetails(entityRecord(output, "context"), "Context");
  if (name === "graph")
    return recordListDetails(isRecord(output) ? output.nodes : [], "Understanding", "nodes");
  return [];
}

function attachmentReadDetails(output: unknown) {
  if (!isRecord(output)) return [];
  const details: string[] = [];
  const filename = stringValue(output.filename);
  const content = stringValue(output.content);
  const error = stringValue(output.error);
  if (filename) details.push(`附件：${truncateText(filename)}`);
  if (output.kind) details.push(`类型：${String(output.kind)}`);
  if (typeof output.totalPages === "number") details.push(`页数：${output.totalPages}`);
  if (content) details.push(`内容：${content.length} 字`);
  if (typeof output.truncated === "boolean" && output.truncated) details.push("内容已截断");
  if (error) details.push(`错误：${truncateText(error)}`);
  return details;
}

function fileReadDetails(output: unknown) {
  if (!isRecord(output)) return [];
  const details: string[] = [];
  const content = stringValue(output.content);
  const error = stringValue(output.error);
  if (typeof output.bytes === "number") details.push(`大小：${output.bytes} bytes`);
  if (output.encoding) details.push(`编码：${String(output.encoding)}`);
  if (content) details.push(`内容：${content.length} 字`);
  if (typeof output.truncated === "boolean" && output.truncated) details.push("内容已截断");
  if (error) details.push(`错误：${truncateText(error)}`);
  return details;
}

function bashDetails(output: unknown) {
  if (!isRecord(output)) return [];
  const details: string[] = [];
  if (typeof output.exitCode === "number" || output.exitCode === null)
    details.push(`exit：${String(output.exitCode)}`);
  const stdout = stringValue(output.stdout);
  const stderr = stringValue(output.stderr);
  if (stdout) details.push(`stdout：${truncateText(stdout)}`);
  if (stderr) details.push(`stderr：${truncateText(stderr)}`);
  if (output.timedOut) details.push("命令超时");
  if (typeof output.truncated === "boolean" && output.truncated) details.push("输出已截断");
  return details;
}

function webFetchDetails(output: unknown) {
  if (!isRecord(output)) return [];
  const details: string[] = [];
  const title = stringValue(output.title);
  const markdown = stringValue(output.markdown);
  const error = stringValue(output.error);
  if (title) details.push(`标题：${truncateText(title)}`);
  if (typeof output.blocked === "boolean" && output.blocked) details.push("状态：无法读取");
  if (markdown) details.push(`内容：${markdown.length} 字`);
  if (typeof output.truncated === "boolean" && output.truncated) details.push("内容已截断");
  if (error) details.push(`错误：${truncateText(error)}`);
  return details;
}

function searchHitDetails(output: unknown) {
  const hits = isRecord(output) ? arrayValue(output.hits) : [];
  return limitedLines(
    hits.map((hit) => {
      if (!isRecord(hit)) return "";
      if (hit.type === "understanding") {
        const understanding = isRecord(hit.understanding) ? hit.understanding : {};
        return resultLine(
          "Understanding",
          entityTitle(understanding),
          stringValue(hit.matchedText),
        );
      }
      if (hit.type === "context") {
        const context = isRecord(hit.context) ? hit.context : {};
        return resultLine("Context", entityTitle(context), stringValue(hit.matchedText));
      }
      return "";
    }),
  );
}

function retrievalCandidateDetails(output: unknown) {
  const candidates = isRecord(output) ? arrayValue(output.candidates) : [];
  return limitedLines(
    candidates.map((candidate) => {
      if (!isRecord(candidate)) return "";
      const contexts = arrayValue(candidate.matchedContexts).length;
      const suffix = contexts > 0 ? `${contexts} 条 Context 证据` : "";
      return resultLine("Understanding", entityTitle(candidate), suffix);
    }),
  );
}

function recordListDetails(output: unknown, label: string, emptyLabel: string) {
  const records = Array.isArray(output)
    ? output
    : isRecord(output)
      ? arrayValue(output[emptyLabel])
      : [];
  return limitedLines(
    records.map((record) => (isRecord(record) ? resultLine(label, entityTitle(record)) : "")),
  );
}

function inspectDomainDetails(output: unknown) {
  if (!isRecord(output)) return [];
  const domain = entityRecord(output, "domain");
  const details = recordDetails(domain, "Domain");
  details.push(`Understanding：${arrayValue(output.understandings).length} 条`);
  details.push(`Context：${arrayValue(output.contexts).length} 条`);
  return details;
}

function recordDetails(record: Record<string, unknown>, label: string) {
  const title = entityTitle(record);
  const body = stringValue(record.body) || stringValue(record.content);
  return [resultLine(label, title, body)];
}

function entityRecord(output: unknown, key: string) {
  if (!isRecord(output)) return {};
  const nested = output[key];
  return isRecord(nested) ? nested : output;
}

function limitedLines(lines: string[]) {
  const filtered = lines.filter(Boolean);
  if (filtered.length === 0) return ["结果：空"];
  const visible = filtered.slice(0, 5);
  return filtered.length > visible.length
    ? [...visible, `还有 ${filtered.length - visible.length} 条结果`]
    : visible;
}

function resultLine(kind: string, title?: string, detail?: string) {
  const safeTitle = title || "未命名";
  const safeDetail = detail ? ` · ${truncateText(detail)}` : "";
  return `${kind}：${safeTitle}${safeDetail}`;
}

function truncateText(text: string, maxLength = 80) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function toolRunningSummary(name: string, input: Record<string, unknown>) {
  if (name === "search") return `正在搜索${queryLabel(input) || "相关内容"}`;
  if (name === "retrieve_knowledge") return `正在检索${queryLabel(input) || "知识"}`;
  return toolRunningVerb(name);
}

function toolDoneVerb(name: string) {
  if (name === "attachment_read") return "读取附件";
  if (name === "file_read") return "读取本地文件";
  if (name === "bash") return "执行 Bash";
  if (name === "web_fetch") return "读取网页";
  if (name === "retrieve_knowledge") return "检索";
  if (name.includes("search")) return "搜索";
  if (name === "graph") return "查看关联图";
  if (name.includes("get")) return "读取";
  if (name.startsWith("domain_")) return "查看领域目录";
  return "使用工具";
}

function toolDoneSummary(name: string, input: Record<string, unknown>, output: unknown) {
  const outputRecord = isRecord(output) ? output : {};
  if (name === "file_read") {
    return `读取了「${stringValue(outputRecord.path) || stringValue(input.path) || "本地文件"}」`;
  }
  if (name === "attachment_read") {
    return `读取了「${stringValue(outputRecord.filename) || stringValue(input.attachmentId) || "附件"}」`;
  }
  if (name === "web_fetch") {
    const label =
      stringValue(outputRecord.title) ||
      stringValue(outputRecord.finalUrl) ||
      stringValue(input.url) ||
      "网页";
    return outputRecord.blocked ? `网页无法读取「${label}」` : `读取了网页「${label}」`;
  }
  if (name === "bash") {
    const exitCode = outputRecord.exitCode;
    return `执行了 Bash${typeof exitCode === "number" ? ` · exit ${exitCode}` : ""}`;
  }
  if (name === "domain_list") return `列出 ${outputCount(output, "domains")} 个 Domain`;
  if (name === "domain_inspect") {
    return `查看了「${stringValue(outputRecord.name) || stringValue(input.domainId) || "领域"}」下的内容`;
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
  return stringValue(value.title) || stringValue(value.name) || stringValue(value.title);
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

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" || value === null ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
