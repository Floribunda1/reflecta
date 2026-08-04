import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../../.storybook/story-showcase";
import { useAutoFrame } from "../../../.storybook/use-auto-frame";
import {
  markdownBoundaryDocument,
  markdownStorySections,
} from "../../editor/markdown-story-fixtures";
import type { ChatEntityReference } from "../entity";
import { entityKey } from "../entity-visual";
import { ChatMarkdown } from "./chat-markdown";

const presentations = new Map([
  ["understanding:u_irrigation", { state: "ready" as const, label: "分区灌溉策略", canOpen: true }],
  ["context:c_night_shift", { state: "loading" as const, label: "夜班联调记录加载中" }],
  ["domain:d_facility", { state: "ready" as const, label: "设施工程", canOpen: false }],
  ["context:missing", { state: "unavailable" as const, label: "引用不可用" }],
  ["understanding:error", { state: "error" as const, label: "引用加载失败" }],
]);

const resolveEntity = (reference: ChatEntityReference) => presentations.get(entityKey(reference));

const diagramsAndMath = markdownStorySections.mathAndNested;

const entityMarkdown = `## Reflecta Entity

- 可打开：[[u:u_irrigation]]
- 加载中：[[c:c_night_shift]]
- 不可打开 Domain：[[d:d_facility]]
- 不可用：[[c:missing]]
- 错误：[[u:error]]
- 无 resolver 结果：[[u:unknown]]
`;

const conversationMarkdownCases = [
  {
    label: "超长工程分析",
    value: `这份总结按“核心模型 → 实际工作流 → 形成过程 → 当前缺口”展开。原因是这个项目最值得讲的并不是测试工具怎么配置，而是团队如何把产品承诺、自动化证据和技术回归拆成一套能够长期维护的协作方式。

## 一句话结论

这个桌面知识助手采用的不是“把 Gherkin 直接翻译成浏览器脚本”的传统做法，而是一套：

> 以 Feature 记录产品契约，以稳定 ID 连接 Acceptance，以 Regression 防守技术边界，再用自动检查和差异报告维持一致性的工作流。

换句话说，团队真正建立的是一套**测试治理机制**，而不只是一批 E2E 脚本。Feature 回答产品承诺了什么，Acceptance 和 Regression 回答为什么要测，E2E、Integration 与 Unit 则回答应该在哪一层提供证据。三个问题如果混在一起，文档会逐渐变成实现说明，测试也会越来越慢。

## 1. 先分开三个经常被混用的概念

### Feature：产品向用户承诺什么

Feature 是产品能力的可执行说明，不是代码路径，也不是 UI 控件清单。一个行为只有同时满足以下条件，才值得进入 Feature：

- 它来自明确的产品意图，而不是当前实现偶然表现出来的行为；
- 用户能够感知、操作或依赖它；
- 团队可以稳定判断它是否兑现。

因此，“用户修改一条知识记录，重新打开后仍能看到最新内容”是 Feature；“展开思考过程后再次进入仍保持展开状态”也可以是 Feature。相反，按钮存在、某个 React state 更新、某个 hook 被调用，都只是实现细节。

Feature 还需要同时覆盖两类承诺：

- **Happy path**：用户可以完成目标；
- **Expected error behavior**：产品已经明确设计过的失败反馈和恢复方式。

这里最容易犯的错误，是把历史 bug 的症状永久写进产品契约。例如“页面不会白屏”不是一个好的场景名称，因为它只记录了某次事故；“加载失败时保留用户输入并允许重试”才描述了长期应该成立的正确结果。

### Acceptance / Regression：为什么要测

这是测试意图，和测试采用什么技术没有直接关系。

| 类型 | 保护对象 | 是否关联 Feature ID | 典型例子 |
| --- | --- | :---: | --- |
| Acceptance | 产品对用户的明确承诺 | 是 | 用户停止生成后可以继续输入 |
| Regression | 历史缺陷、平台边界与技术不变量 | 否 | 窗口恢复焦点时不能重复投影消息 |

Acceptance 必须能追溯到一个稳定的产品场景。Regression 则记录“系统曾在哪个技术边界上失败”，它可以很重要，但不应该反过来污染产品语言。

### E2E / Integration / Unit：在哪里测

这是自动化层级。原则不是“重要功能全部写 E2E”，而是选择能够提供可信证据的最低成本层级：

1. 真实窗口、IPC、系统权限和 Electron 生命周期无法替代时，使用 E2E；
2. 数据库、repository、runtime 或进程边界需要一起工作时，使用 Integration；
3. 确定性的状态转换、payload 构造与渲染映射，优先使用 Unit 或 Component Test。

所以，Feature 不等于 E2E，Regression 也不等于 Unit。一条产品承诺可以由 E2E 证明主路径，再由低层测试覆盖边界；一条技术回归如果只涉及纯函数，就不应该启动整个桌面应用。

## 2. 实际开发工作流是怎样运转的

### 第一步：先修改产品契约

新增或改变功能时，先在 Feature 目录按用户能力描述场景：

\`\`\`text
acceptance/
├── feature/
│   ├── conversation/
│   ├── knowledge/
│   └── settings/
└── spec/
    ├── conversation/
    ├── knowledge/
    └── settings/
\`\`\`

场景只保留稳定 ID、用户目标、必要的前置状态、用户操作和可观察结果。它不应该出现 provider、stream delta、DOM selector 或内部 store 名称，否则 reviewer 看到的将是实现方案，而不是产品变化。

### 第二步：选择测试意图和证据层级

对每个场景依次问：

1. 这是产品明确承诺的行为，还是技术风险？
2. 最低哪一层能够给出可信证据？
3. 是否真的必须启动 Electron？

需要从真实用户入口验证的产品能力进入 Acceptance spec；不需要真实应用边界的规则下沉到 Integration 或 Unit；只有平台行为、历史缺陷或跨进程问题才保留为 Regression E2E。

### 第三步：用稳定 ID 连接契约与实现

Feature 和 Playwright 不共享 step definition，也不由 Gherkin 自动生成测试代码。两边通过稳定 ID 建立清楚、低耦合的关系：

\`\`\`ts
test("@CHAT-STOP-003 停止生成后仍可继续发送消息", async ({ page }) => {
  await page.getByRole("button", { name: "停止" }).click();
  await expect(page.getByRole("textbox")).toBeEnabled();
});
\`\`\`

稳定 ID 不会因为文件移动、标题润色、helper 重构或 spec 拆分而变化。这样产品契约可以独立 Review，自动化实现也可以按工程需要重构。

### 第四步：自动检查映射完整性

检查脚本需要保证：

- Feature ID 不重复；
- 每个 Scenario 都有对应的 Acceptance；
- 不存在没有 Feature 的孤儿 Acceptance；
- Regression 不冒用 Feature ID；
- 文件位于约定目录；
- 禁止遗留 \`test.only\` 或静默跳过关键门禁。

普通 Git diff 很难回答“产品承诺到底改了什么”，因此还需要一份按 ID 输出的 Feature Diff，把变化分成 Added、Removed、Changed 和 Moved。Reviewer 不必从大量目录调整和测试重构里手工还原产品变化。

### 第五步：让真实桌面测试可并行、可重复

E2E 环境不能共用开发数据库或应用配置。每条测试都应该拥有独立的 SQLite、content root、app config、检索索引与 Electron user data，并在启动前写入确定的 seed 数据。

这一步看似只是测试基础设施，实际解决了三个长期问题：

- 测试不会读取或污染开发数据；
- 不同 worker 可以安全并行；
- 失败现场可以由同一份 seed 和启动参数重新构造。

## 3. 这套方法为什么不是一次性设计出来的

最初团队也从“该写多少 E2E、多少 Unit”开始讨论。后来发现顺序反了：如果产品承诺还没有写清楚，争论测试层级只会让当前代码结构主导场景设计。

第一次关键调整，是把 Test Case 放回自动化之前。场景只对用户结果负责，不包含测试框架、技术标签和代码细节。这样即使实现从本地状态迁移到数据库，或者从单进程改成多进程，产品契约仍然成立。

第二次调整，是接受生成式 AI 的输出不可控。测试不能断言模型必须回复某句固定自然语言，而应该断言用户可观察的产品状态，例如：

- 回复开始并持续出现；
- 回复完成后操作恢复；
- 用户停止生成后输入仍被保留；
- 失败时出现明确反馈，并允许再次发送；
- 固定文案只来自 seed、fixture 或预置会话。

第三次调整，是解决人类 Review 不友好。随着 Feature 数量增加，仅靠目录和文件名无法判断一次改动究竟改变了哪些产品承诺。稳定 ID、映射检查和 Feature Diff 因此不是额外仪式，而是让人和 Agent 可以共同维护同一套语义资产。

## 4. 一个具体例子：流式回复时保持阅读位置

假设用户正在阅读一段很长的回答，并主动向上滚动查看早期内容。模型仍在底部持续输出 token，此时产品希望：

1. 用户停留在底部时，页面自动跟随新内容；
2. 用户主动上翻后，页面不再把视线强行拉回底部；
3. 用户重新回到底部后，自动跟随恢复；
4. 窗口失焦、恢复或列表重新测量时，阅读位置仍然稳定。

其中前 3 条是用户可以明确依赖的产品行为，适合写入 Feature 并由 Acceptance E2E 验收。第 4 条如果只在特定浏览器 observer 或虚拟列表时序下出现，更接近技术回归，可以单独由 Regression 防守。

低层测试仍然有价值：Unit 可以验证“是否接近底部”的判定和状态转换，Component Test 可以验证新 token 到达时是否调用滚动回调。但只有真实窗口中的 E2E 能证明 ResizeObserver、内容增高、用户滚动和虚拟列表组合后仍然符合体验。

这个例子也说明，**同一个用户体验可以由多层测试共同保护，但每一层必须回答不同的问题**。重复同一条断言只会增加成本，不会增加信心。

## 5. 当前仍有三个值得注意的缺口

第一，真实 AI E2E 仍然有成本和不稳定性。主路径需要少量真实 provider smoke test，但大部分等待、停止、失败和工具状态应该由可重复的 scripted fixture 覆盖。否则一次普通 UI 调整也会消耗模型额度，并把网络波动带进发布门禁。

第二，复杂 Regression 是否允许拥有自己的 Feature 说明还没有完全统一。默认规则应该是 Regression 不创建产品 Feature；但当一个历史缺陷本身对应复杂、长期有效的体验约束时，单纯的测试标题又可能不够。这个例外需要被明确记录，而不是靠目录里的偶然文件暗示。

第三，严格门禁与紧急发布之间仍有张力。完整回归应该是默认值，但如果维护者明确决定跳过昂贵测试，系统至少要记录跳过范围、原因和风险，而不能让“没有运行”看起来像“已经通过”。

## 最后的判断

这套工作流真正有价值的地方，不是它使用了 Gherkin、Playwright 或某个检查脚本，而是它建立了一条稳定的推理链：

> 先明确产品行为，再选择测试意图；先选择最低可信层级，再实现自动化；最后用稳定 ID、隔离环境和发布门禁保证契约不会悄悄漂移。

如果未来要继续演进，优先级也很清楚：先降低真实 AI 测试成本，再补齐 Regression 例外规则，最后完善门禁豁免记录。暂时不需要引入新的测试 DSL、代码生成器或复杂平台，现有结构已经足够承载下一阶段。`,
  },
  {
    label: "实施总结",
    value: `排版调整已完成，核心变化集中在共享的 Markdown 主题：

- \`strong\` 只承担语义强调，不再把整段文字推到最高亮度。
- \`code\` 使用中性底色与等宽字体；蓝色只保留给可点击链接。
- 标题、段落和列表使用同一套垂直节奏。
  - 长回复保持连续阅读。
  - 短回复不会产生多余留白。
- 默认宽度沿用生产会话的 \`max-w-4xl\`，不增加新的布局配置。

## 验证结果

样式在[暗色主题](https://example.com/themes/dark)与浅色主题下均保持可读；代码、列表和长中文段落没有溢出。相关组件位于 [chat-markdown.tsx](https://example.com/source/chat-markdown.tsx)。`,
  },
  {
    label: "简短决策",
    value: `建议先不增加“紧凑 / 舒适”模式，当前只有一种明确的会话阅读场景。

> 先把默认值做好，再用真实反馈决定是否需要配置。

1. 收敛正文、标题和粗体的层级。
2. 用 Storybook 固定长篇分析与实施总结。
3. 只有用户明确需要更高密度时，再增加显示选项。

**何时重新评估：** 同一种排版无法同时满足长文阅读和高频日志扫描时。`,
  },
] as const;

const streamingCases = [
  {
    label: "未闭合强调",
    frames: ["正在生成 **重要", "正在生成 **重要结论", "正在生成 **重要结论**。"],
  },
  {
    label: "未闭合代码块",
    frames: [
      "```ts",
      "```ts\nconst status =",
      '```ts\nconst status = "streaming";',
      '```ts\nconst status = "streaming";\n```',
    ],
  },
  {
    label: "未完成表格",
    frames: [
      "| Module |",
      "| Module | 状态 |\n| ---",
      "| Module | 状态 |\n| --- | --- |\n| Tool",
      "| Module | 状态 |\n| --- | --- |\n| Tool | running |",
    ],
  },
  {
    label: "未完成链接与 Entity",
    frames: [
      "[Storybook",
      "[Storybook](https://",
      "[Storybook](https://example.com)\n\n[[u:",
      "[Storybook](https://example.com)\n\n[[u:u_irrigation]]",
    ],
  },
  {
    label: "未完成 Mermaid 与公式",
    frames: [
      "```mermaid\nflowchart LR",
      '```mermaid\nflowchart LR\n  A["输入"] -->',
      '```mermaid\nflowchart LR\n  A["输入"] --> B["输出"]\n```',
      '```mermaid\nflowchart LR\n  A["输入"] --> B["输出"]\n```\n\n$E = mc^2$',
    ],
  },
] as const;

const streamingFrames = streamingCases.flatMap((entry) =>
  entry.frames.map((value, index) => ({
    label: entry.label,
    value,
    frame: index + 1,
    frameCount: entry.frames.length,
  })),
);

function StreamingSyntaxDemo() {
  const current = streamingFrames[useAutoFrame(streamingFrames.length)];

  return (
    <div className="grid max-w-4xl gap-3">
      <p className="text-sm text-muted-foreground">
        当前语法：{current.label} · 第 {current.frame}/{current.frameCount} 帧 · 自动播放
      </p>
      <div className="min-h-40">
        <ChatMarkdown value={current.value} streaming resolveEntity={resolveEntity} />
      </div>
    </div>
  );
}

function EntityDemo() {
  const [opened, setOpened] = useState("尚未打开 Entity");
  return (
    <div className="grid gap-3">
      <ChatMarkdown
        value={entityMarkdown}
        resolveEntity={resolveEntity}
        onEntityOpen={(reference) => setOpened(`已打开：${reference.type}:${reference.id}`)}
      />
      <p className="text-xs text-muted-foreground">{opened}</p>
    </div>
  );
}

function MarkdownShowcase() {
  return (
    <StoryShowcase
      title="Markdown"
      description="按语法族集中验收 Agent Markdown 的完整内容、Reflecta 扩展、自动 Streaming 和几何边界。"
    >
      <StoryCase
        title="典型对话中的阅读层级"
        description="连续比较超长工程分析、实施总结和简短决策，观察真实内容密度下的标题、强调、代码、链接与段落节奏。"
      >
        <div className="grid max-w-4xl divide-y">
          {conversationMarkdownCases.map((sample) => (
            <div key={sample.label} className="grid gap-3 py-8 first:pt-0 last:pb-0">
              <span className="text-xs font-medium text-muted-foreground">{sample.label}</span>
              <ChatMarkdown value={sample.value} />
            </div>
          ))}
        </div>
      </StoryCase>

      <StoryCase title="标题与行内样式">
        <ChatMarkdown value={markdownStorySections.headingsAndInline} />
      </StoryCase>

      <StoryCase title="列表与引用">
        <ChatMarkdown value={markdownStorySections.listsAndQuotes} />
      </StoryCase>

      <StoryCase
        title="代码与表格"
        description="覆盖 JavaScript、Python、CSS、JSON、Bash 和多种表格对齐。"
      >
        <ChatMarkdown value={markdownStorySections.codeAndTables} />
      </StoryCase>

      <StoryCase
        title="媒体与扩展语法"
        description="图片、HTML、details、kbd、脚注和定义列表按 renderer 支持能力展示或安全降级。"
      >
        <ChatMarkdown value={markdownStorySections.mediaAndExtensions} />
      </StoryCase>

      <StoryCase title="数学公式与 Mermaid">
        <ChatMarkdown value={diagramsAndMath} />
      </StoryCase>

      <StoryCase
        title="Reflecta Entity"
        description="并排包含 ready、loading、不可打开、unavailable、error 和 fallback。"
      >
        <EntityDemo />
      </StoryCase>

      <StoryCase
        title="自动 Streaming"
        description="同一个组件实例自动循环未闭合强调、代码块、表格、链接、Entity、Mermaid 和公式。"
      >
        <StreamingSyntaxDemo />
      </StoryCase>

      <StoryCase
        title="空内容与几何边界"
        description="空白内容、长 URL、长代码、宽表格和连续字符串不能撑破窄容器。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[240px_360px]">
          <div className="min-h-24">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">空字符串</span>
            <ChatMarkdown value="" />
          </div>
          <div className="w-[360px] max-w-full">
            <span className="mb-2 block text-xs font-medium text-muted-foreground">窄容器</span>
            <ChatMarkdown
              value={markdownBoundaryDocument}
              tone="muted"
              resolveEntity={resolveEntity}
            />
          </div>
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Agent/基本组件",
  component: ChatMarkdown,
  args: {
    value: markdownStorySections.headingsAndInline,
    resolveEntity,
  },
} satisfies Meta<typeof ChatMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkdownStory: Story = {
  name: "Markdown",
  render: () => <MarkdownShowcase />,
};
