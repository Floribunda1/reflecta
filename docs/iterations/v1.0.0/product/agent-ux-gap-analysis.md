# Reflecta V2 Agent UX Gap Analysis

> 状态：Draft
>
> 目标：对比 `vercel-labs/personal-agent-template` 和社区 Agent Chat 共识，说明 Reflecta 当前 Agent 前端在用户体验上还差什么。
>
> 范围：只讨论 Agent Interaction Legibility。这里不比较 Slack / Linear / Auth / Memory Import 等产品功能。

## 1. 结论

Reflecta 当前差的不是“能不能 chat”，而是用户是否能清楚理解：

- Agent 正在想、查、读、写哪一步。
- Agent 调用 tool 的目的和结果。
- 哪些内容是证据，哪些是 AI 生成的解释。
- 哪些动作会写入知识库。
- 用户点按钮后，控制权交给谁。

按 `personal-agent-template` 这类成熟 Agent Chat UX 来看，Reflecta 当前主链路已经能跑，但 Agent Interaction Legibility 大约只有 **45%-55%**。

不是因为功能少，而是因为太多内部状态还没有被翻译成用户能理解的交互语言。

## 2. 社区共识基线

### 2.1 Stream 必须可读

成熟 chat UI 会把 streaming、auto-scroll、retry、message action、markdown 等当作基础能力，而不是高级功能。`assistant-ui` 把这些直接列为 production UX 能力；它的 primitives 也把 `Thread`、`Message`、`ActionBar`、`ThreadList`、`Error`、`ChainOfThought` 拆成稳定交互单元。

参考：

- https://github.com/assistant-ui/assistant-ui
- https://www.assistant-ui.com/docs/primitives

对 Reflecta 的含义：

- 有 stream markdown 不够。
- 用户还需要知道现在是等待首 token、正在调用工具、正在整理回答，还是已经停止。

### 2.2 Tool call 必须被产品化

AI SDK 文档明确支持 tool call streaming，让 tool input 生成过程也能被 UI 展示。assistant-ui 的 Tool UI 也把 tool call 当作“自定义 UI 组件”，要求展示 loading、result 和 interactive states，而不是暴露原始 JSON。

参考：

- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
- https://www.assistant-ui.com/docs/tools/tool-ui

对 Reflecta 的含义：

- 用户不应该看到 `search_all`、`understanding_get`、`graph_neighborhood` 这种内部工具名。
- 用户应该看到“搜索了 12 条内容”“读取了 3 条想法”“查看了附近关联”。
- JSON 只能是展开后的 debug/detail，不应该是默认信息架构。

### 2.3 HITL 的核心是控制权

CopilotKit 对 Human-in-the-Loop 的定义是：Agent 暂停，向用户收集输入、确认或选择，再把答案折回 Agent 流程。关键不是按钮本身，而是用户保留 steering wheel。

参考：

- https://docs.copilotkit.ai/agent-spec/human-in-the-loop

对 Reflecta 的含义：

- 写入知识库的 proposal 必须明确暂停。
- 用户动作必须表达控制权流向：
  - `确认`：写入。
  - `拒绝`：不写入，交回 AI 继续一小步。
  - `忽略`：不写入，AI 停住，等用户输入。

### 2.4 不是所有 tool 都需要确认

Vercel AI SDK 6 的实践是：简单安全 tool 可以自动执行，危险动作需要 approval。

参考：

- https://vercel.com/blog/ai-sdk-6

对 Reflecta 的含义：

- Read tools 自动执行。
- Write proposal tools 必须确认。
- 只读 tool 的 UX 应该轻，不要把每次读取都做成强打断。

### 2.5 不展示原始推理链

OpenAI reasoning 文档把 reasoning tokens 描述为模型内部使用的 token；原始 reasoning 不直接作为默认输出。用户需要的是可理解的阶段或摘要，而不是模型脑内文本。

参考：

- https://developers.openai.com/api/docs/guides/reasoning

对 Reflecta 的含义：

- 不做 chain-of-thought 展示。
- 可以做阶段性 thinking：`正在理解问题`、`正在查找相关内容`、`正在整理回答`。

## 3. personal-agent-template 的体验参考

`personal-agent-template` 的前端不是靠功能数量取胜，而是把 Agent 状态翻译得比较干净。

### 3.1 Thinking 是明确状态

它在 assistant busy 但还没有 visible parts 时显示 `Thinking...`，避免用户看到空白等待。

参考：

- https://github.com/vercel-labs/personal-agent-template/blob/main/app/components/chat/ActivityIndicator.vue
- https://github.com/vercel-labs/personal-agent-template/blob/main/app/pages/chat/%5Bid%5D.vue

Reflecta 当前问题：

- 现在只有无 text / 无 tool 时的 `...` 占位。
- 用户不知道 Agent 是在等待模型、准备 tool、还是卡住。

### 3.2 Message renderer 按 part 分流

它把 reasoning、tool、text、save_memory 分开渲染。普通 tool 有 fallback，关键 tool 有专用 UI。

参考：

- https://github.com/vercel-labs/personal-agent-template/blob/main/app/components/chat/message/MessageContentEve.vue

Reflecta 当前问题：

- `chat/index.tsx` 已经按 text/tool/candidate 分流，但很多体验都塞在一个文件。
- ToolActivity 仍偏工程日志，不像用户可读的活动流。

### 3.3 Save memory approval 是产品卡片

它的 `Save to memory` 卡片有状态点、状态文案、分类 badge、原因说明、可展开详情、approve/skip 操作。

参考：

- https://github.com/vercel-labs/personal-agent-template/blob/main/app/components/chat/tool/ToolSaveMemory.vue

Reflecta 当前问题：

- Candidate card 已有，但状态语言还粗。
- 当前 Understanding create / update 还允许用户手动编辑，这和我们刚定的心智不一致。我们希望用户通过继续对话让 Agent 改，而不是把 proposal 变成表单。
- 当前没有 `忽略`。
- 当前 `拒绝` 只是标记 rejected，没有把下一轮控制权交回 AI。

### 3.4 Debug Inspector 只在 dev 出现

它有 stream inspector，但只在 dev 显示，用于看 stream event 和 event counts。

参考：

- https://github.com/vercel-labs/personal-agent-template/blob/main/app/components/chat/StreamInspector.vue

Reflecta 当前问题：

- 普通用户界面有时还承担了 debug 信息展示职责。
- 我们没有 dev-only stream/tool inspector，所以排查时只能看 console 或 raw JSON。

## 4. Reflecta 当前 UX 债务

### P0. Thinking legibility 不够

当前表现：

- 等首 token 时只可能看到 `...`。
- 没有阶段感。
- 没有区分“模型在生成”和“Agent 在调用 tool”。

应该变成：

- 首 token 前显示轻量状态。
- tool 执行时状态切换成用户语义。
- 出现 assistant 文本后，thinking 状态自然消失。

建议状态：

| 内部状态              | 用户看到                 |
| --------------------- | ------------------------ |
| submitted             | 正在理解问题             |
| read tool running     | 正在查找相关内容         |
| multiple reads        | 正在整理找到的内容       |
| proposal tool running | 正在准备候选项           |
| text streaming        | 直接显示流式 Markdown    |
| stopped               | 已停止                   |
| error                 | 显示可恢复错误和重试入口 |

### P0. Read tool 仍像调用日志

当前表现：

- `ToolActivity` 会显示 `AI 正在使用 ${name}`。
- 展开后直接看 input/output JSON。
- 用户不能快速判断 tool 调用是否和当前问题相关。

应该变成：

- 默认一行折叠摘要。
- 不显示内部 tool 名。
- 显示动作、数量、关键对象名。

建议摘要：

| Tool                 | 默认摘要                               |
| -------------------- | -------------------------------------- |
| `snapshot_project`   | 查看了知识库概览                       |
| `domain_list`        | 列出了领域目录                         |
| `domain_inspect`     | 查看了「领域名」下的内容               |
| `understanding_list` | 列出了 8 条相关想法                    |
| `understanding_get`  | 读取了「Understanding 标题」           |
| `context_list`       | 读取了 3 条来源                        |
| `search_all`         | 搜索了 12 条相关内容                   |
| `graph_neighborhood` | 查看了「Understanding 标题」附近的关联 |
| `graph_path`         | 查找了两条想法之间的路径               |

展开后可以看命中对象列表。JSON 放到 dev/debug，不做默认信息。

### P0. Proposal 控制权语义还没做好

当前表现：

- UI 有 `确认 / 拒绝`。
- 没有 `忽略`。
- `拒绝` 后只是 patch 成 rejected，Agent 不会自动继续。
- Understanding proposal 可以手动编辑，偏离“用户通过聊天让 Agent 改”的心智。

已定产品语义：

| 动作 | 是否写入 | 下一步控制权 |
| ---- | -------- | ------------ |
| 确认 | 是       | 系统完成写入 |
| 拒绝 | 否       | 交给 AI      |
| 忽略 | 否       | 交给用户     |

应该变成：

- Proposal 卡片固定显示 `确认 / 拒绝 / 忽略`。
- `忽略` 后卡片保留，状态弱化为 `已忽略`，按钮消失，AI 停住。
- `拒绝` 后卡片保留，状态为 `已拒绝`，AI 自动继续一小步。
- P0 不提供手动编辑 proposal 字段。

### P0. Evidence legibility 不够

当前表现：

- 用户可以 `@` Understanding / Context / Domain。
- 消息下方有 context chips。
- 但 assistant 回答和 tool 证据之间的关系不够清楚。

应该变成：

- 回答后显示轻量 evidence chips。
- 只显示真实读取过的 Understanding / Context / Domain。
- chips 可以跳转到对象。
- 不做右侧 Inspector。

建议：

```text
基于：拖延与自我保护 · 自我要求过高 · 3 条来源
```

### P0. Stop / error / recovery 状态还粗

当前表现：

- 有 stop 按钮。
- 有 error block 和 retry。
- tool error 仍偏技术。
- stop 后没有明确的用户语义状态。

应该变成：

- 停止后显示 `已停止`，保留已生成内容。
- provider 错误用人话解释。
- tool 错误默认显示语义错误，展开再看技术信息。

示例：

| 场景               | 用户看到                         |
| ------------------ | -------------------------------- |
| 用户停止           | 已停止，保留已生成内容           |
| 搜索无结果         | 没有找到相关内容                 |
| 读取对象失败       | 读取失败，这次没有修改知识库     |
| 写入 proposal 失败 | 写入失败，知识库未发生变化       |
| Provider 404       | Base URL、模型或 provider 不匹配 |

### P1. Thread list 是功能可用，不是产品完成

当前表现：

- 有 thread list。
- 可新建、重命名、归档、删除。
- 没有按时间分组。
- loading / empty / active state 比较基础。

参考体验：

- `personal-agent-template` 按 Today / Yesterday / Last week / Last month / older group 分组。
- 删除走 context menu + confirm modal。

建议：

- 按时间分组。
- active thread 更明显。
- loading / empty 状态更克制。
- 删除和归档只保留一个 P0 动作，避免用户分不清。

### P1. Composer 还不像 Agent 产品输入框

当前表现：

- textarea + send/stop。
- `@` picker 可用。
- selected context chips 可移除。

缺口：

- picker 没有 loading state。
- 没有 keyboard navigation 明确体验。
- placeholder 仍泛泛。
- stop/send 按钮占用较重。

建议：

- `@` picker 支持上下选择和 Enter。
- 空 `@` 时优先显示最近/常用对象或分类目录。
- 输入框 placeholder 体现 Reflecta 心智：`询问、比较，或 @ 引用知识库内容...`

### P1. 缺 dev-only stream/tool inspector

当前表现：

- 没有 dev-only inspector。
- 排查 tool stream 只能看 raw UI 或日志。

建议：

- 只在 dev 显示。
- 展示 status、chunk count、tool events、requestId。
- 普通用户完全看不到。

### P2. 不追的体验

这些不是当前差距，不建议为了对齐模板去做：

- Slack / Linear / external integrations。
- Auth / profile shell。
- 独立 Memory Import UI。
- 右侧 Inspector。
- 原始 chain-of-thought。
- attachments / voice / branch picker。

## 5. 优先级路线

### 第一刀：让 Agent 行为可读

最小可交付：

- Thinking 状态。
- Read tool semantic summary。
- Stop 后 `已停止`。
- Tool error semantic label。

这能解决“AI 黑箱卡住”的主要体验问题。

### 第二刀：修 Proposal 控制权

最小可交付：

- Proposal card 动作改成 `确认 / 拒绝 / 忽略`。
- 移除手动编辑。
- `忽略` 状态落库并停住。
- `拒绝` 状态落库并触发 AI 继续一小步。

这能解决“用户不知道点了按钮之后谁接管”的问题。

### 第三刀：补 Evidence 和 Thread polish

最小可交付：

- Assistant 回答显示 evidence chips。
- Thread list 按时间分组。
- `@` picker 加 loading / keyboard navigation。
- dev-only stream inspector。

这能把体验从“能用”推进到“可信、可控、可调试”。

## 6. 完成度评估

| 体验面                       | 当前完成度 | 主要缺口                          |
| ---------------------------- | ---------- | --------------------------------- |
| 基础 chat stream             | 70%        | 首 token 前状态和 stopped 状态    |
| Markdown streaming           | 80%        | 已有 Streamdown，缺周边状态       |
| Tool calling legibility      | 35%        | 暴露工具名和 JSON，缺语义摘要     |
| Proposal HITL                | 45%        | 缺忽略，拒绝不交回 AI，动作语义弱 |
| Evidence / source legibility | 30%        | 缺回答后的证据 chips              |
| Thread management            | 50%        | 缺时间分组和细节状态              |
| Debuggability                | 35%        | 缺 dev-only inspector             |

总体判断：

Reflecta 的 Agent runtime 和功能底座已经接近 V2 baseline，但用户体验还停在“工程可用”。下一阶段不应该继续堆 Agent 功能，而应该优先提升 Agent Interaction Legibility。
