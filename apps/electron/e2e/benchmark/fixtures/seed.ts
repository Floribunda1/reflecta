/**
 * Benchmark 专用 seed 组合：把确定性的「大量数据」灌进 e2e 测试库，
 * 让卡顿场景可复现、可对比（复用 acceptance 的 fixture 写入层）。
 *
 * 约定：所有 seed 必须在 launch 之前调用（fixture 直接写库，应用启动后读取）。
 */
import { resetAgentFixtures, seedAgentThread } from "../../acceptance/spec/agent/agent-fixtures";
import { seedDomain, seedUnderstanding } from "../../acceptance/spec/agent/agent-fixtures";
import { assistantMessage, userMessage } from "../../acceptance/spec/agent/agent-fixtures";

export { resetAgentFixtures };

/** 造一个含大量 Understanding 的领域树，用于 domain 切换时的重渲染/refetch 压力。 */
export function seedPortfolio(domainCount: number, understandingsPerDomain: number): void {
  for (let d = 0; d < domainCount; d++) {
    const domainId = `bench-domain-${d}`;
    seedDomain({ id: domainId, name: `Bench Domain ${d}` });
    for (let u = 0; u < understandingsPerDomain; u++) {
      seedUnderstanding({
        id: `bench-u-${d}-${u}`,
        title: `Bench Understanding ${d}-${u}`,
        body: `domain#${d} item#${u} 的正文`.repeat(20),
        createdAt: new Date(Date.UTC(2026, 0, 1 + u)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 0, 1 + d + u)).toISOString(),
      });
    }
  }
}

/**
 * 造一个「长对话」线程。
 * @param turnCount 往返轮数（1 轮 = 1 条用户 + 1 条 assistant，assistant 带较大文本）
 * @param linePerReply 每条 assistant 回复重复行数，放大单条消息体量
 */
export function seedLongThread(threadId: string, turnCount: number, linePerReply = 40): void {
  const messages = Array.from({ length: turnCount }, (_, i) => [
    userMessage(`${threadId}:u${i}`, `第 ${i} 轮问题：Reflecta 长对话压测 ${i}`),
    assistantMessage(`${threadId}:a${i}`, [
      { type: "text", text: `回答 ${i}\n`.repeat(linePerReply) },
    ]),
  ]).flat();
  seedAgentThread({
    id: threadId,
    title: `BENCH_LONG_${turnCount}`,
    messages,
  });
}

/** 造一个「可展开/收起」长消息（单条超大 assistant 消息）。 */
export function seedExpandableThread(threadId: string, title: string, lines = 2000): void {
  seedAgentThread({
    id: threadId,
    title,
    messages: [
      userMessage(`${threadId}:u0`, "展开/收起压测"),
      assistantMessage(`${threadId}:a0`, [
        { type: "text", text: `${"L".repeat(40)}\n`.repeat(lines) },
      ]),
    ],
  });
}
