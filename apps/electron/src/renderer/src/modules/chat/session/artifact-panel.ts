import type { AgentReducedAssistantBlock, AgentReducedMessage } from "@shared/agent";

/**
 * 对话 artifact panel（C14 / M8-7 / U2）的派生逻辑。
 *
 * 只聚合本对话**已落地**的产出：completed tool / approval 块的输出携带
 * `resultRefType / resultRefId / resultRefTitle`（PiMutationOutput 契约），
 * 纯客户端派生、零后端。pending 提案留在消息流，不进入本视图。
 */
export type ArtifactType = "understanding" | "context" | "domain" | "canvas";

export type LandedArtifact = {
  type: ArtifactType;
  id: string;
  title: string;
  /** 落地（completed 块）的 ISO 时间戳，用于排序与最新态判定。 */
  landingAt: string;
  /** 承载落地的消息 id（保留用于跳回产出语境）。 */
  messageId: string;
};

export type ArtifactGroup = {
  type: ArtifactType;
  label: string;
  items: LandedArtifact[];
};

export type ArtifactPanelView = {
  total: number;
  groups: ArtifactGroup[];
};

export const ARTIFACT_TYPES: readonly ArtifactType[] = [
  "understanding",
  "context",
  "domain",
  "canvas",
] as const;

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  understanding: "理解",
  context: "上下文",
  domain: "领域",
  canvas: "画布",
};

type ArtifactOutput = {
  resultRefType: ArtifactType;
  resultRefId: string;
  resultRefTitle?: string;
};

/** 可承载落地产出的块：tool（直接完成）与 approval（审批后执行完成）。 */
type LandedBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" | "approval" }>;

function artifactOutput(block: LandedBlock): ArtifactOutput | null {
  const output = block.output;
  if (typeof output !== "object" || !output) return null;
  const record = output as Record<string, unknown>;
  if (
    typeof record.resultRefType !== "string" ||
    !(ARTIFACT_TYPES as readonly string[]).includes(record.resultRefType) ||
    typeof record.resultRefId !== "string"
  ) {
    return null;
  }
  return {
    resultRefType: record.resultRefType as ArtifactType,
    resultRefId: record.resultRefId,
    resultRefTitle: typeof record.resultRefTitle === "string" ? record.resultRefTitle : undefined,
  };
}

function blockPayload(block: LandedBlock): unknown {
  return "payload" in block ? block.payload : undefined;
}

/** 标题兜底：输出未带 resultRefTitle 时（domain_create/update 等）从 approval payload 取 title/name。 */
function payloadTitle(payload: unknown): string | undefined {
  if (typeof payload !== "object" || !payload) return undefined;
  const record = payload as Record<string, unknown>;
  const candidate = record.title ?? record.name;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function landedArtifact(block: LandedBlock, messageId: string): LandedArtifact | null {
  const output = artifactOutput(block);
  if (!output) return null;
  const title = (output.resultRefTitle?.trim() || payloadTitle(blockPayload(block)) || "").trim();
  return {
    type: output.resultRefType,
    id: output.resultRefId,
    title: title || "未命名",
    landingAt: block.createdAt,
    messageId,
  };
}

/** 按消息/块顺序扫描全部已落地产出（不去重）。 */
export function scanLandedArtifacts(messages: readonly AgentReducedMessage[]): LandedArtifact[] {
  const artifacts: LandedArtifact[] = [];
  for (const message of messages) {
    for (const block of message.blocks ?? []) {
      if (block.kind === "tool" && block.state === "completed") {
        if (block.toolName.endsWith("_delete")) continue;
        const artifact = landedArtifact(block, message.id);
        if (artifact) artifacts.push(artifact);
      } else if (block.kind === "approval" && block.executionState === "completed") {
        if (block.toolName.endsWith("_delete")) continue;
        const artifact = landedArtifact(block, message.id);
        if (artifact) artifacts.push(artifact);
      }
    }
  }
  return artifacts;
}

/**
 * 构建 panel 视图：按 (type, id) 去重（更新类变更取最新落地与标题），
 * 按落地时间倒序，按类型分区（ARTIFACT_TYPES 顺序，空区省略）。
 */
export function buildArtifactPanelView(
  messages: readonly AgentReducedMessage[],
): ArtifactPanelView {
  const byKey = new Map<string, LandedArtifact>();
  for (const artifact of scanLandedArtifacts(messages)) {
    const key = `${artifact.type}:${artifact.id}`;
    const existing = byKey.get(key);
    if (!existing || artifact.landingAt >= existing.landingAt) byKey.set(key, artifact);
  }
  const deduped = [...byKey.values()].sort((left, right) =>
    right.landingAt.localeCompare(left.landingAt),
  );
  const groups: ArtifactGroup[] = [];
  for (const type of ARTIFACT_TYPES) {
    const items = deduped.filter((artifact) => artifact.type === type);
    if (items.length === 0) continue;
    groups.push({ type, label: ARTIFACT_TYPE_LABELS[type], items });
  }
  return { total: deduped.length, groups };
}
