import type { AgentReducedAssistantBlock, AgentReducedMessage } from "@shared/agent";
import { buildAgentTurnView } from "./messages/agent-turn-view";
import { AgentMessageContent, type ApproveToolInput } from "./messages/agent-message-content";

const CREATED_AT = "2026-06-25T00:00:00.000Z";

type ToolBlock = Extract<AgentReducedAssistantBlock, { kind: "tool" }>;
type ApprovalBlock = Extract<AgentReducedAssistantBlock, { kind: "approval" }>;

type DemoTurn = {
  id: string;
  title: string;
  blocks: AgentReducedAssistantBlock[];
};

function toolBlock({
  id,
  toolName,
  input = {},
  output,
  state = "completed",
  error,
}: {
  id: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  state?: ToolBlock["state"];
  error?: string;
}): AgentReducedAssistantBlock {
  return {
    kind: "tool",
    toolCallId: id,
    toolName,
    input,
    output,
    state,
    ...(error ? { error } : {}),
    createdAt: CREATED_AT,
  };
}

function approvalBlock({
  id,
  toolName,
  payload,
  state = "pending",
  output,
  error,
}: {
  id: string;
  toolName: string;
  payload: Record<string, unknown>;
  state?: ApprovalBlock["state"];
  output?: unknown;
  error?: string;
}): AgentReducedAssistantBlock {
  return {
    kind: "approval",
    approvalId: `approval-${id}`,
    toolCallId: id,
    toolName,
    title: "",
    payload,
    approved: state === "approved" || state === "completed",
    state,
    ...(output ? { output } : {}),
    ...(error ? { error } : {}),
    createdAt: CREATED_AT,
  };
}

const sampleUnderstanding = {
  id: "u_feedback_loop",
  title: "小反馈能降低判断成本",
  body: "先用低成本反馈验证判断，再扩大投入。",
  domains: [{ id: "d_product", name: "产品判断" }],
  contextCount: 3,
  referenceCount: 2,
  referencedByCount: 1,
  connectionCount: 4,
};

const sampleContext = {
  id: "c_review",
  title: "一次项目复盘",
  medium: "experience",
  content: "这次推进慢，主要是没有及时把判断变成可验证的小实验。",
};

const demoTurns: DemoTurn[] = [
  {
    id: "knowledge-lookup",
    title: "Lookup group: search / retrieve_knowledge / graph",
    blocks: [
      toolBlock({
        id: "tool-search",
        toolName: "search",
        input: { query: "反馈 成本", limit: 5 },
        output: {
          hits: [
            {
              type: "understanding",
              understanding: sampleUnderstanding,
              matchedText: "低成本反馈能减少错误判断持续的时间。",
            },
            {
              type: "context",
              context: sampleContext,
              understandingId: sampleUnderstanding.id,
            },
          ],
        },
      }),
      toolBlock({
        id: "tool-retrieve",
        toolName: "retrieve_knowledge",
        input: { query: "怎么降低试错成本", limit: 3 },
        output: {
          candidates: [
            {
              ...sampleUnderstanding,
              snippet: "把大判断拆成可回收的小实验。",
              matchedContexts: [
                {
                  ...sampleContext,
                  contextId: sampleContext.id,
                  snippet: "先做一版很小的 demo，再决定是否继续投入。",
                },
              ],
            },
          ],
        },
      }),
      toolBlock({
        id: "tool-graph",
        toolName: "graph",
        input: { understandingId: sampleUnderstanding.id },
        output: {
          nodes: [
            sampleUnderstanding,
            { id: "u_decision", title: "判断要尽早外显", body: "外显后才容易被校准。" },
          ],
          edges: [{ from: "u_feedback_loop", to: "u_decision" }],
        },
      }),
    ],
  },
  {
    id: "domain-read",
    title: "Domain tools",
    blocks: [
      toolBlock({
        id: "tool-domain-list",
        toolName: "domain_list",
        output: {
          domains: [
            { id: "d_product", name: "产品判断" },
            { id: "d_engineering", name: "工程质量" },
          ],
        },
      }),
      toolBlock({
        id: "tool-domain-inspect",
        toolName: "domain_inspect",
        input: { domainId: "d_product" },
        output: {
          domain: { id: "d_product", name: "产品判断" },
          domains: [{ id: "d_research", name: "用户研究" }],
          understandings: [sampleUnderstanding],
          contexts: [sampleContext],
        },
      }),
    ],
  },
  {
    id: "understanding-read",
    title: "Understanding tools",
    blocks: [
      toolBlock({
        id: "tool-understanding-list",
        toolName: "understanding_list",
        output: { understandings: [sampleUnderstanding] },
      }),
      toolBlock({
        id: "tool-understanding-get",
        toolName: "understanding_get",
        input: { understandingId: sampleUnderstanding.id },
        output: {
          understanding: {
            ...sampleUnderstanding,
            contexts: [sampleContext],
            relations: [
              {
                direction: "outgoing",
                targetTitle: "判断要尽早外显",
                rawText: "反馈回路需要外显判断才能成立。",
              },
            ],
          },
        },
      }),
    ],
  },
  {
    id: "context-read",
    title: "Context tools",
    blocks: [
      toolBlock({
        id: "tool-context-list",
        toolName: "context_list",
        output: { contexts: [sampleContext] },
      }),
      toolBlock({
        id: "tool-context-get",
        toolName: "context_get",
        input: { contextId: sampleContext.id },
        output: { context: sampleContext },
      }),
    ],
  },
  {
    id: "peripheral-read",
    title: "Peripheral reads: web / attachment / file",
    blocks: [
      toolBlock({
        id: "tool-web-fetch",
        toolName: "web_fetch",
        input: { url: "https://example.com/product-notes" },
        output: {
          finalUrl: "https://example.com/product-notes",
          title: "Product Notes",
          markdown: "# Product Notes\nSmall experiments reduce uncertainty.",
          truncated: true,
        },
      }),
      toolBlock({
        id: "tool-web-fetch-blocked",
        toolName: "web_fetch",
        input: { url: "https://example.com/login-only" },
        output: {
          finalUrl: "https://example.com/login-only",
          blocked: true,
          error: "Page appears blocked or login-gated.",
        },
      }),
      toolBlock({
        id: "tool-attachment-read",
        toolName: "attachment_read",
        input: { attachmentId: "att-product-notes" },
        output: {
          filename: "product-notes.pdf",
          kind: "pdf",
          totalPages: 4,
          content: "The notes compare heavy planning with small feedback loops.",
        },
      }),
      toolBlock({
        id: "tool-file-read",
        toolName: "file_read",
        input: { path: "<projectRoot>/docs/notes.md" },
        output: {
          path: "<projectRoot>/docs/notes.md",
          encoding: "utf8",
          content: "Make the tool card explain the action, not the transport payload.",
        },
      }),
    ],
  },
  {
    id: "bash-activity",
    title: "Bash activity states",
    blocks: [
      toolBlock({
        id: "tool-bash-running",
        toolName: "bash",
        state: "running",
        input: { command: "bun run typecheck:web", cwd: "<projectRoot>" },
      }),
      toolBlock({
        id: "tool-bash-completed",
        toolName: "bash",
        input: { command: "printf hello" },
        output: { exitCode: 0, stdout: "hello", stderr: "" },
      }),
      toolBlock({
        id: "tool-bash-failed",
        toolName: "bash",
        state: "failed",
        input: { command: "exit 1" },
        error: "Command failed with exit code 1",
      }),
    ],
  },
  {
    id: "knowledge-proposals",
    title: "Knowledge write proposals",
    blocks: [
      approvalBlock({
        id: "proposal-understanding-create",
        toolName: "understanding_create",
        payload: {
          title: "小反馈能降低判断成本",
          body: "先用低成本反馈验证判断，再扩大投入。",
          domainIds: ["d_product"],
        },
      }),
      approvalBlock({
        id: "proposal-understanding-update",
        toolName: "understanding_update",
        payload: {
          understandingId: sampleUnderstanding.id,
          before: { body: "先做反馈。" },
          after: { body: "先用低成本反馈验证判断，再扩大投入。" },
          reason: "补充了为什么要先小规模验证。",
        },
      }),
      approvalBlock({
        id: "proposal-context-create",
        toolName: "context_create",
        payload: {
          understandingId: sampleUnderstanding.id,
          medium: "experience",
          title: "一次项目复盘",
          content: sampleContext.content,
        },
      }),
    ],
  },
  {
    id: "generic-proposals",
    title: "Generic write proposals",
    blocks: [
      approvalBlock({
        id: "proposal-domain-create",
        toolName: "domain_create",
        payload: { name: "产品判断", parentId: null },
      }),
      approvalBlock({
        id: "proposal-domain-update",
        toolName: "domain_update",
        payload: { domainId: "d_product", name: "产品决策" },
        state: "approved",
      }),
      approvalBlock({
        id: "proposal-domain-delete",
        toolName: "domain_delete",
        payload: { domainId: "d_old" },
        state: "rejected",
      }),
      approvalBlock({
        id: "proposal-understanding-delete",
        toolName: "understanding_delete",
        payload: { understandingId: "u_old", reason: "重复内容" },
      }),
      approvalBlock({
        id: "proposal-context-update",
        toolName: "context_update",
        payload: {
          contextId: sampleContext.id,
          title: "一次 demo 复盘",
          content: "把展示内容从原始字段改成产品语义。",
        },
      }),
      approvalBlock({
        id: "proposal-context-delete",
        toolName: "context_delete",
        payload: { contextId: "c_old", reason: "引用已迁移" },
      }),
    ],
  },
  {
    id: "bash-proposals",
    title: "Bash proposals",
    blocks: [
      approvalBlock({
        id: "proposal-bash-pending",
        toolName: "bash",
        payload: {
          command: "find <projectRoot>/.local/blog/content/posts -maxdepth 2 -type f | head -200",
          cwd: "<projectRoot>",
          timeoutMs: 30000,
        },
      }),
      approvalBlock({
        id: "proposal-bash-approved",
        toolName: "bash",
        payload: {
          command:
            "find <projectRoot>/.local/blog/content/posts -maxdepth 2 -type f | sed 's#^#/#' | head -200",
          timeoutMs: 30000,
        },
        state: "approved",
      }),
    ],
  },
];

const ignoreApprove = (_input: ApproveToolInput) => undefined;

function DemoMessage({ demo }: { demo: DemoTurn }) {
  const message: AgentReducedMessage = {
    id: `message-${demo.id}`,
    role: "assistant",
    text: "",
    createdAt: CREATED_AT,
    blocks: demo.blocks,
  };
  const turn = buildAgentTurnView(demo.blocks);

  return (
    <section className="min-w-0 border-t border-border/70 pt-4">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-medium text-foreground">{demo.title}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">{demo.blocks.length} blocks</span>
      </div>
      <div className="grid min-w-0 gap-2">
        <AgentMessageContent
          message={message}
          turn={turn}
          isBusy={false}
          isLastAssistant={false}
          onApproveTool={ignoreApprove}
          expandToolDetails
        />
      </div>
    </section>
  );
}

export function ToolDemoPage() {
  return (
    <main className="h-full min-h-0 w-full overflow-auto bg-background">
      <div className="mx-auto grid max-w-5xl gap-5 px-6 py-6">
        <header className="grid gap-1">
          <h1 className="text-xl font-semibold text-foreground">Agent Tool Rendering Demo</h1>
          <p className="text-sm text-muted-foreground">
            使用真实 Agent 消息渲染链路展示 activity 和 approval 工具状态。
          </p>
        </header>
        <div className="grid gap-6">
          {demoTurns.map((demo) => (
            <DemoMessage key={demo.id} demo={demo} />
          ))}
        </div>
      </div>
    </main>
  );
}
