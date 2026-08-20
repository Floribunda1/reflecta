/**
 * Benchmark 专用 seed：把确定性的「大量 + 高复杂度」数据灌进 e2e 测试库，
 * 让卡顿场景可复现、可对比（复用 acceptance 的 fixture 写入层，批量写避免逐条起进程）。
 *
 * 约定：所有 seed 必须在 launch 之前调用（fixture 直接写库，应用启动后读取）。
 *
 * 内容复杂度刻意拉高，并尊重渲染器的成本边界：
 * - Understanding 卡片：`SimpleMarkdownPreview` 只解析前 5 行（PREVIEW_LINES），
 *   所以高成本 block（代码块/表格）和 [[u:..]]/[[d:..]] citation 必须放在正文前部，
 *   截断后才仍被解析；详情面板渲染全文（不截断），成本更高。
 * - Agent 消息：每条 assistant 带长 thinking(reasoning，展开渲染全文) + 多个同组
 *   tool 调用（聚合成 activity group，展开渲染条目）+ 复杂 markdown 正文。
 */
import {
  resetAgentFixtures,
  seedAgentThread,
  seedPortfolio,
} from "../../acceptance/spec/agent/agent-fixtures";
import {
  assistantMessage,
  reasoningPart,
  toolPart,
  userMessage,
} from "../../acceptance/spec/agent/agent-fixtures";

/**
 * 造一个「交互友好」的线程：收起态消息矮（reasoning 收起只占 trigger 一行、text 只 1 段），
 * 保证 activity group / 消息整体在视口内可真实点击；但 thinking 保持长，展开全文渲染成本真实。
 * @param threadId 线程 id
 * @param turnCount 往返轮数
 */
export function seedInteractiveThread(threadId: string, turnCount = 20): void {
  const messages = Array.from({ length: turnCount }, (_, i) => [
    userMessage(`${threadId}:u${i}`, `第 ${i} 轮问题：Reflecta 交互压测 ${i}。`),
    assistantMessage(`${threadId}:a${i}`, [
      reasoningPart(longThinking(i)),
      toolPart("search", `${threadId}:tc${i}-1`, {
        results: [
          { id: `r${i}-1`, title: `结果 ${i}-1`, snippet: `关于 ${i} 的背景……` },
          { id: `r${i}-2`, title: `结果 ${i}-2`, snippet: `关于 ${i} 的案例……` },
        ],
      }),
      toolPart("search", `${threadId}:tc${i}-2`, {
        results: [{ id: `r${i}-3`, title: `结果 ${i}-3`, snippet: `关于 ${i} 的实践……` }],
      }),
      { type: "text", text: complexMarkdown(`answer-${i}`, { repeats: 1 }), state: "done" },
    ]),
  ]).flat();
  seedAgentThread({
    id: threadId,
    title: `BENCH_INTERACT_${turnCount}`,
    messages,
  });
}

export { resetAgentFixtures };

/**
 * 复杂 markdown 模板。高成本 block（代码块/表格）与 citation 放在最前，
 * 保证卡片截断（前 5 行）后仍被解析；详情/正文渲染全文时成本更高。
 * @param citations `[[u:id]]` / `[[d:id]]` 等实体引用（触发 entity 解析查询）
 */
export function complexMarkdown(
  seed: string,
  opts: { repeats?: number; citations?: string[] } = {},
): string {
  const repeats = opts.repeats ?? 1;
  const citationLine = (opts.citations ?? []).join(" ");
  const section = [
    `# ${seed} 标题`,
    citationLine,
    "```typescript",
    `export async function handle${seed.replace(/\W/g, "")}(ctx: Context) {`,
    "```",
    `## ${seed} 细节`,
    `这一段是**正文**说明，包含行内代码 \`useVirtualizer\` 与[链接](https://example.com/${seed})，
     描述 ${seed} 场景的完整背景、方案取舍与实施细节，让 markdown 解析承担真实成本。`,
    "",
    "- 列表项：初始化数据",
    "- 列表项：执行查询",
    "- 列表项：渲染结果",
    "",
    `1. 第一步：解析输入`,
    `2. 第二步：组织输出`,
    "",
    `> 引用段落：${seed} 的关键经验总结。`,
    "",
    "| 字段 | 类型 | 说明 |",
    "| --- | --- | --- |",
    "| id | string | 唯一标识 |",
    "| title | string | 标题 |",
    "| body | string | markdown 正文 |",
    "| updatedAt | ISO | 更新时间 |",
    "",
    "```sql",
    "SELECT id, title, body FROM understandings WHERE domain_id = ? ORDER BY updated_at DESC",
    "```",
    "",
    `总结：${seed} 段落到此为止。`,
    "",
  ].join("\n");
  return section.repeat(repeats);
}

/**
 * 灌一批「大数量 + 复杂 markdown + citation」的 Understanding 卡片，关联自建 domain，
 * 让 capture 网格的过滤视图有确定性规模，且卡片渲染（前 5 行含 citation + 代码块）成本高。
 * @param domainCount 自建 domain 数
 * @param perDomain 每个 domain 下的 understanding 数
 */
export function seedPortfolioBench(domainCount: number, perDomain: number): void {
  const domains = Array.from({ length: domainCount }, (_, d) => ({
    id: `bench-domain-${d}`,
    name: `Bench Domain ${d}`,
  }));
  const understandings = Array.from({ length: domainCount * perDomain }, (_, i) => {
    const d = Math.floor(i / perDomain);
    const u = i % perDomain;
    // citation 指向真实存在的实体（同域相邻卡 + 跨域卡 + 本域），触发 entity 引用查询
    const citations = [
      `[[u:bench-u-${d}-${(u + 1) % perDomain}]]`,
      `[[u:bench-u-${(d + 1) % domainCount}-0]]`,
      `[[d:bench-domain-${d}]]`,
    ];
    return {
      id: `bench-u-${d}-${u}`,
      title: `Bench Understanding ${d}-${u}`,
      body: complexMarkdown(`u${d}-${u}`, { repeats: 2, citations }),
      createdAt: new Date(Date.UTC(2026, 0, 1 + u)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, 1 + d + u)).toISOString(),
      domainIds: [`bench-domain-${d}`],
    };
  });
  seedPortfolio({ domains, understandings });
}

function longThinking(i: number): string {
  const paragraph = [
    `第 ${i} 轮思考：先回顾前文结论，再拆解问题 ${i} 的关键约束，`,
    `对比方案 A（直接查询）与方案 B（走检索增强）在延迟与准确性上的取舍，`,
    `并评估是否需要工具调用补充上下文。`,
  ].join("");
  return Array.from({ length: 12 }, (_, k) => `${paragraph} 段落${k}。`).join("\n");
}

/**
 * 造一个「长对话 + 高复杂度消息」的线程。
 * 每条 assistant 消息 = 长 thinking(reasoning) + 3 个同组 tool（聚合 activity group）+ 复杂 markdown。
 * @param threadId 线程 id
 * @param turnCount 往返轮数
 * @param markdownRepeats 正文 markdown 重复次数（放大单条消息体量）
 */
export function seedLongThread(threadId: string, turnCount: number, markdownRepeats = 8): void {
  const messages = Array.from({ length: turnCount }, (_, i) => [
    userMessage(
      `${threadId}:u${i}`,
      `第 ${i} 轮问题：Reflecta 长对话压测，请详细分析 ${i} 号议题。`,
    ),
    assistantMessage(`${threadId}:a${i}`, [
      reasoningPart(longThinking(i)),
      toolPart("search", `${threadId}:tc${i}-1`, {
        results: [
          { id: `r${i}-1`, title: `结果 ${i}-1`, snippet: `关于 ${i} 的背景……` },
          { id: `r${i}-2`, title: `结果 ${i}-2`, snippet: `关于 ${i} 的案例……` },
        ],
      }),
      toolPart("search", `${threadId}:tc${i}-2`, {
        results: [
          { id: `r${i}-3`, title: `结果 ${i}-3`, snippet: `关于 ${i} 的对比……` },
          { id: `r${i}-4`, title: `结果 ${i}-4`, snippet: `关于 ${i} 的实践……` },
        ],
      }),
      toolPart("search", `${threadId}:tc${i}-3`, {
        results: [{ id: `r${i}-5`, title: `结果 ${i}-5`, snippet: `关于 ${i} 的延伸……` }],
      }),
      {
        type: "text",
        text: complexMarkdown(`answer-${i}`, { repeats: markdownRepeats }),
        state: "done",
      },
    ]),
  ]).flat();
  seedAgentThread({
    id: threadId,
    title: `BENCH_LONG_${turnCount}`,
    messages,
  });
}
