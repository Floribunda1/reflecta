# v1.2.5 Chat Message / Agent Message Module Design

> 状态：Planned
>
> 对应主计划：[Module 7：Chat Message](./ui-package-storybook-migration-plan.md)
>
> 组织逻辑：本文采用**递进型主线**，按“message ownership → UI-owned View Model → block composition → stream identity → Renderer Adapter → Storybook 验收”展开。原因是原计划只迁 assistant content 会把 user message 和 row chrome 留成同一视觉系统的孤岛；横向按 User Message、Assistant Message、Row Chrome、MessageList Workflow 做 MECE 分类。

## 1. 结论

Message Module 接管一条 Chat Message 的完整 visual：

```text
@reflecta/ui/chat
  ChatMessageRow
  AgentMessageView
  ChatMessageView
  ChatMessageAction
  findChatTextRanges
```

迁移：

- user message content；
- assistant/Agent block composition；-附件和 entity mention visual；
- message row alignment/highlight/timestamp；
- copy/edit/fork/regenerate action visual；
- stopped/error/pending visual；
- message 内 search highlight。

保留在 Electron：

- MessageList 排序、compaction 插入和 pending 判断；
- raw message → View Model；
- clipboard/toast；
- edit/regenerate/fork workflow；
- approval mutation；
- Thread Find navigation/scroll。

## 2. Current Implementation 处理

### 2.1 迁入 package

| 当前 implementation          | 新 implementation         | 可见性           |
| ---------------------------- | ------------------------- | ---------------- |
| `MessageRow` visual shell    | `ChatMessageRow`          | public           |
| `UserMessageContent`         | `UserMessageContent`      | package internal |
| `MessageAttachment`          | `MessageAttachment`       | package internal |
| user `MentionChip`           | `MessageEntityMention`    | package internal |
| `AgentMessageContent`        | `AgentMessageView`        | public           |
| text block JSX               | `AgentTextBlock`          | package internal |
| block dispatcher             | Agent message composition | package internal |
| stopped/empty/running visual | assistant status visual   | package internal |
| row action buttons           | `MessageActions`          | package internal |
| search attributes/highlight  | package search context    | package internal |
| `findChatTextRanges`         | pure helper               | public           |

### 2.2 留在 Electron

| 当前职责                                     | 原因                    |
| -------------------------------------------- | ----------------------- |
| `MessageList`                                | Thread orchestration    |
| message/compaction ordering                  | session workflow        |
| `shouldShowPendingAssistantPlaceholder`      | Thread state            |
| raw `AgentReducedMessage` parsing            | App Adapter             |
| Composer JSON → user display mapping         | Agent protocol Adapter  |
| clipboard + toast                            | browser/App side effect |
| edit/regenerate/fork callback implementation | Thread workflow         |
| approval mutation                            | Agent workflow          |
| active find result/DOM scroll                | Thread Find workflow    |
| timestamp formatter                          | App locale/time policy  |

### 2.3 删除或收缩

- UI 不接收 `AgentReducedMessage`；
- UI 不接收 `AgentEntityCatalogEntry[]`；
- UI 不接收 `isBusy + isLastAssistant` 两个布尔值；
- UI 不接收 `ApproveToolInput`；
- UI 不维护 public mutable search cursor；
- block key 不使用 `${message.id}-${kind}-${index}`；
- Renderer 中旧 user/assistant/message-row JSX 删除。

## 3. User Message View Model

```ts
export type ChatMessageEntityView = {
  id: string;
  type: "understanding" | "context" | "domain";
  label: string;
};

export type ChatMessageAttachmentView = {
  id: string;
  name: string;
  mediaType: string;
  previewUrl?: string;
};

export type ChatUserMessageView = {
  kind: "user";
  id: string;
  text?: string;
  entities?: readonly ChatMessageEntityView[];
  attachments?: readonly ChatMessageAttachmentView[];
};
```

规则：

- text、entity、attachment 至少一个存在；空 user message 在 Adapter 过滤；
- image attachment 用 `previewUrl`，其他类型显示 file visual；
- entity 已经有 display label，不在 UI 查询；
- raw Composer document 不进入 View Model；
- attachment provider metadata 不进入 View Model。

## 4. Assistant View Model

### 4.1 Text block

```ts
export type AgentTextBlockView = {
  kind: "text";
  id: string;
  markdown: string;
  status: "streaming" | "done" | "failed";
  error?: string;
};
```

- streaming/done 使用同一 `ChatMarkdown` visual；
- failed 显示用户可见 error，不同时渲染 stale Markdown；-空且非 failed 的 text block 由 Adapter 移除；
- text block `id` 在 delta 更新中稳定。

### 4.2 Block union

```ts
export type AgentMessageBlockView =
  | AgentTextBlockView
  | AgentExecutionBlockView
  | {
      kind: "proposal";
      proposal: AgentProposalView;
    };
```

Execution 来自 Module 5；Proposal 来自 Module 6。

### 4.3 Assistant message

```ts
export type ChatAssistantMessageView = {
  kind: "assistant";
  id: string;
  status: "streaming" | "done" | "stopped" | "failed";
  blocks: readonly AgentMessageBlockView[];
  error?: string;
};
```

规则：

- `streaming + blocks=[]` 显示 Pending；
- `stopped` 在现有 blocks 后显示 stopped visual；
- `failed + blocks=[]` 显示 message error；
- block order 由 Adapter 决定，UI 不重新 group；
- final answer 是普通 text block。

## 5. Row View Model

```ts
export type ChatMessageView = ChatUserMessageView | ChatAssistantMessageView;

export type ChatMessageActionType = "copy" | "edit" | "fork" | "regenerate";

export type ChatMessageAction = {
  messageId: string;
  type: ChatMessageActionType;
};

export type ChatMessageRowView = {
  message: ChatMessageView;
  timestampLabel?: string;
  highlighted?: boolean;
  enabledActions?: readonly ChatMessageActionType[];
  actionsDisabled?: boolean;
};
```

`enabledActions` 由 Renderer workflow 决定：

- user 通常 copy/edit；
- assistant 通常 copy/fork；
- last assistant 可 regenerate；
- busy 时可以整体 disabled。

UI 不根据 session state自行判断 action availability。

## 6. Component Interface

```ts
export type AgentMessageViewProps = {
  message: ChatAssistantMessageView;
  search?: {
    query: string;
  };
  entityBindings?: ChatEntityBindings;
  onProposalDecision?: (decision: AgentProposalDecision) => void;
};

export function AgentMessageView(props: AgentMessageViewProps): React.ReactNode;
```

```ts
export type ChatMessageRowProps = {
  row: ChatMessageRowView;
  search?: {
    query: string;
  };
  entityBindings?: ChatEntityBindings;
  onAction?: (action: ChatMessageAction) => void;
  onEntityOpen?: (entity: ChatMessageEntityView) => void;
  onProposalDecision?: (decision: AgentProposalDecision) => void;
};

export function ChatMessageRow(props: ChatMessageRowProps): React.ReactNode;
```

`ChatMessageRow` 负责选择 user/assistant internal renderer；Renderer 不再维护两套 row JSX。

## 7. Search Interface

```ts
export type ChatTextRange = {
  start: number;
  end: number;
};

export function findChatTextRanges(text: string, query: string): ChatTextRange[];
```

规则：

- query 是唯一 public search input；
- AST traversal cursor 保持 package internal；
- 每个 visible match 输出稳定 marker attribute；
- active result 和 scroll 继续由 Thread workflow 控制；
- user plain text 和 assistant Markdown 都支持 highlight。

## 8. Stream Identity

Message Module 接收 immutable View Model snapshots：

```text
live delta/tool event
  -> reducer 更新 raw message
  -> Electron Adapter 生成 next ChatAssistantMessageView
  -> 相同 message/block id rerender
  -> final assistant.turn 替换 live snapshot
```

硬约束：

- message key 只使用 `message.id`；
- text block 使用 Adapter 生成的稳定 id；
- Execution item 使用 `toolCallId` 投影出的稳定 id；
- Proposal 使用 `approvalId`；
- lifecycle/status 不进入 key；
- array index 不能单独作为 key；
- final turn 与 live state 对同一 semantic block 产生相同 id；
- props 更新不重置 Tool/Proposal 的手动折叠状态；
- search query 更新不能改变 block identity。

## 9. Internal Composition

```text
ChatMessageRow
├── UserMessageContent
│   ├── MessageEntityMention
│   ├── MessageAttachment
│   └── plain text
├── AgentMessageView
│   ├── AgentTextBlock
│   ├── AgentExecutionBlock
│   ├── AgentProposalCard
│   └── status visual
└── MessageActions
```

`MessageActions` 只发 `ChatMessageAction`，不执行 clipboard、edit、fork 或 regenerate。

## 10. Electron Adapter

建议两个层次：

```ts
function toChatMessageView(
  message: AgentReducedMessage,
  options: AgentMessageAdapterOptions,
): ChatMessageView;
```

纯 Adapter 负责：

- user text/entity/attachment projection；
- assistant raw blocks →稳定 block id；
- tool/proposal Adapter；
- message status；
- error projection。

connected container 负责：

- entity presentation query；
- proposal decision mapping；
- message action mapping；
- timestamp；
- clipboard/toast。

`MessageList` 调用形态：

```tsx
{
  messages.map((message) => {
    const row = buildChatMessageRow(message, threadState);
    return <ConnectedChatMessageRow key={row.message.id} row={row} search={search} />;
  });
}
```

## 11. Storybook Matrix

### 11.1 User

- text；
- entity mentions；
- image/file attachments；
- text + entity + attachment；
- long text；
- edit/copy actions；
- highlighted/search。

### 11.2 Assistant

- text streaming/done/failed；
- reasoning；
- ordinary Tool；
- Proposal；
- mixed block sequence；
- pending；
- stopped；
- failed；
- entity references；
- find highlight。

### 11.3 Row

- user/assistant alignment；
- timestamp；
- hover/focus actions；
- disabled actions；
- highlighted；
- narrow width；
- dark/light。

### 11.4 Stream sequence

- text delta snapshots；
- Tool running → completed；
- Tool running → failed；
- Proposal preview A → preview B → pending；
- Proposal pending → running → completed；
- final turn replacement。

Interaction test 断言 root/block DOM identity 和 manual collapse state 保持。

## 12. 测试归属

package tests：

- user/assistant dispatch；
- attachment/entity visual；
- action event；
- pending/stopped/failed visual；
- search highlight；
- stream rerender identity；
- block order；
- Proposal decision passthrough。

Electron tests：

- raw message → View Model；
- stable block id mapping；
- action → clipboard/edit/fork/regenerate；
- proposal decision → approval command；
- list ordering/compaction/pending；
- final turn/live state reconciliation。

旧 `message-list.test.tsx` 中纯 visual assertions 移到 package；workflow assertions 保留。

## 13. Renderer 替换

- `MessageRow` 使用 `ChatMessageRow`；
- `AgentMessageContent` 替换为 `AgentMessageView`；
- user message/attachment/mention JSX 从 Renderer 删除；
- row action JSX 从 Renderer 删除；
- `findChatTextRanges` import 改到 `@reflecta/ui/chat`；
- `MessageList` 保留 orchestration；
- 旧 UI tests 与 IPC mocks 删除/替换。

## 14. Module 出口

- user、assistant 和 row chrome 使用同一 UI ownership；
- Renderer 不把 raw message 传进 package；
- message/block identity 在流式更新中稳定；
- 每个 Agent Tool 可在完整 message context 中验收；
- UI action 不泄漏 App workflow contract；
- `MessageList` 仍是 Thread orchestration Module。
