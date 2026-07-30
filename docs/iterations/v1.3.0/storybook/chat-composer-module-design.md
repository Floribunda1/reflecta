# v1.3.0 Chat Composer Module Design

> 状态：Planned
>
> 对应主计划：[Module 3：Chat Composer](./ui-package-storybook-migration-plan.md)
>
> 组织逻辑：本文采用**递进型主线**，按“现有耦合 → UI-owned draft model → async Adapter → component interface → Storybook 验收”展开。原因是 Composer 的视觉和交互应整体迁移，但当前 props 泄漏 Agent、main config、messages 和 query 类型；横向能力按 text/entity、attachment、model/reasoning、submit status 做 MECE 分类。

## 1. 结论

Chat Composer 是一个深 UI Module，应整体迁入：

```text
@reflecta/ui/chat
  ChatComposer
  ChatComposerDocument
  ChatComposerValue
  ChatComposerEntityOption
  ChatComposerAttachment
```

它负责：

- TipTap editor lifecycle；
- `@` mention 输入、键盘导航和 visual；
- attachment preview/remove/error visual；
- model/reasoning selector visual；
- context usage meter；
- editing/running/compacting 状态；
- submit/reset 的本地交互。

它不负责：

- React Query/IPC；
- Agent DTO；
- attachment data URL/Agent metadata 序列化；
- 从 messages 计算 context usage；
- model config 解释；
- send/stop/edit workflow。

## 2. 当前资产处理

### 2.1 迁入 package

| 当前资产                    | 目标                      | 可见性           |
| --------------------------- | ------------------------- | ---------------- |
| `ChatComposer`              | `ChatComposer`            | public           |
| `ContextPicker`             | `ChatContextPicker`       | package internal |
| `ContextUsageMeter`         | usage visual              | package internal |
| `AttachmentPreview`         | attachment visual         | package internal |
| TipTap setup                | composer implementation   | package internal |
| context mention visual      | entity mention            | package internal |
| `nextContextPickerIndex`    | keyboard helper           | package internal |
| composer JSON codec         | document codec            | public           |
| initial context apply logic | controlled draft behavior | package internal |

### 2.2 留在 Electron

| 当前资产或职责                     | 原因                             |
| ---------------------------------- | -------------------------------- |
| `useContextMentionLookup`          | React Query/IPC Adapter          |
| `AgentContextRef` mapping          | Agent protocol                   |
| `AgentFileAttachment` mapping      | Agent protocol/provider metadata |
| `AgentReducedMessage[]` usage 计算 | session state                    |
| `AiModelOption` mapping            | main-process config type         |
| send/stop/edit mutation            | Thread workflow                  |
| inspect entity navigation          | App workflow                     |

### 2.3 删除或收缩

- Composer 不再接收整个 `messages`；
- Composer 不再接收 `@main/config` 或 `@shared/agent` 类型；
- `fileToAttachment` 从 UI implementation 删除；
- context lookup hook 不在 package 内创建；
- `onUpdate:modelValue` 一类兼容 props 不进入新 interface；
- TipTap `Editor` instance 不公开。

## 3. UI-owned Types

### 3.1 Entity

```ts
export type ChatComposerEntityType = "understanding" | "context" | "domain";

export type ChatComposerEntityReference = {
  type: ChatComposerEntityType;
  id: string;
  label: string;
};

export type ChatComposerEntityOption = ChatComposerEntityReference & {
  subtitle?: string;
};
```

### 3.2 Attachment

```ts
export type ChatComposerAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size?: number;
  previewUrl?: string;
};

export type ChatComposerAttachmentAdapter = {
  addFiles(files: readonly File[], signal: AbortSignal): Promise<readonly ChatComposerAttachment[]>;
};
```

UI 只保留展示信息和 opaque `id`；Electron Adapter 维护 `id → AgentFileAttachment` 映射。编辑旧消息时由 Adapter 先生成 View Model。

### 3.3 Model 与 reasoning

```ts
export type ChatComposerReasoningOption = {
  id: string;
  label: string;
};

export type ChatComposerModelOption = {
  id: string;
  label: string;
  reasoningOptions: readonly ChatComposerReasoningOption[];
};
```

`id` 是 UI opaque key。Renderer Adapter 映射 provider/model/reasoning level。

### 3.4 Context usage

```ts
export type ChatComposerContextUsage = {
  percent?: number;
  label: string;
  description: string;
};
```

UI 只画 meter，不读取 message token data。

### 3.5 Document 与 value

```ts
export type ChatComposerDocumentNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: ChatComposerDocumentNode[];
};

export type ChatComposerDocument = ChatComposerDocumentNode;

export type ChatComposerValue = {
  text: string;
  document: ChatComposerDocument;
  entities: readonly ChatComposerEntityReference[];
  attachments: readonly ChatComposerAttachment[];
};
```

`document` 用于编辑/重发 round-trip；`text` 和 `entities` 由 package codec 从 document 派生，不由 Renderer 重复解析。

## 4. Async Adapter

```ts
export type ChatComposerEntitySearch = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ChatComposerEntityOption[]>;
```

要求：

- 后一次 query 必须取消前一次；
- stale result 不得覆盖当前列表；
- error 转为 picker error state，不抛出到 render；
- Storybook 使用内存 Adapter；
- production Adapter 可使用 React Query cache，但 hook 留在 Electron container。

## 5. Component Interface

```ts
export type ChatComposerStatus = "idle" | "running" | "compacting";

export type ChatComposerSubmit = {
  value: ChatComposerValue;
  modelId?: string;
  reasoningId?: string;
  editingMessageId?: string;
};

export type ChatComposerProps = {
  draftId?: string;
  initialValue?: ChatComposerValue;
  editingMessageId?: string;
  status: ChatComposerStatus;
  canStop?: boolean;
  focusRequest?: number;
  initialEntities?: readonly ChatComposerEntityReference[];
  modelOptions: readonly ChatComposerModelOption[];
  selectedModelId?: string;
  selectedReasoningId?: string;
  contextUsage?: ChatComposerContextUsage;
  searchEntities: ChatComposerEntitySearch;
  attachmentAdapter?: ChatComposerAttachmentAdapter;
  onSubmit: (submission: ChatComposerSubmit) => void | Promise<void>;
  onModelChange?: (modelId: string) => void;
  onReasoningChange?: (reasoningId: string) => void;
  onEntityOpen?: (reference: ChatComposerEntityReference) => void;
  onCancelEdit?: () => void;
  onStop?: () => void;
};

export function ChatComposer(props: ChatComposerProps): React.ReactNode;
```

Interface 规则：

- `status="running"` 禁止 submit，并在 `canStop` 时显示 stop；
- `status="compacting"` 显示 compacting 状态且禁止 submit；
- `draftId` 改变才重置完整 draft；
- `focusRequest` 只触发 focus，不参与 draft identity；
- `initialEntities` 只在空 draft 首次应用；
- submit 成功前可以立即清空，但失败恢复由 Electron container 决定并重新传入 `initialValue`；
- attachment 限制由 UI Module统一执行，Adapter 只负责转换；
- model/reasoning 选项必须是 display-ready；
- entity click 只发语义 callback。

## 6. Context Picker Interface

```ts
type ChatContextPickerProps = {
  query: string;
  state: "idle" | "loading" | "ready" | "empty" | "error";
  options: readonly ChatComposerEntityOption[];
  activeId?: string;
  showInput?: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (option: ChatComposerEntityOption) => void;
  onCancel: () => void;
};

function ChatContextPicker(props: ChatContextPickerProps): React.ReactNode;
```

Composer 内部使用该 component，并为它建立独立 Story；当前没有第二个生产调用方，因此不扩大 package public interface。

## 7. Internal Composition

```text
ChatComposer
├── EditingBanner
├── ChatContextPicker
├── AttachmentList
│   └── AttachmentPreview
├── TipTapComposerSurface
│   └── EntityMention
└── ComposerToolbar
    ├── AttachmentButton
    ├── ModelSelector
    ├── ReasoningSelector
    ├── ContextUsageMeter
    └── SubmitOrStopButton
```

以上子组件均 package internal。

## 8. Electron Adapter

Renderer container 负责：

```text
AgentContextRef              -> ChatComposerEntityReference
ContextCandidate             -> ChatComposerEntityOption
AgentFileAttachment          -> ChatComposerAttachment
ChatComposerAttachment.id    -> AgentFileAttachment
AiModelOption                -> ChatComposerModelOption
AgentReducedMessage[]        -> ChatComposerContextUsage
ChatComposerSubmit           -> ComposerSendInput
```

建议保留一个 connected container：

```tsx
function AgentChatComposerContainer(props: AgentChatComposerContainerProps) {
  const searchEntities = useChatComposerEntitySearch();
  const attachmentAdapter = useAgentAttachmentAdapter();
  const composerProps = buildChatComposerProps(props);
  return (
    <ChatComposer
      {...composerProps}
      searchEntities={searchEntities}
      attachmentAdapter={attachmentAdapter}
    />
  );
}
```

它有真实 Adapter/I/O 职责，不是 pass-through。

## 9. Storybook 矩阵

### 9.1 Draft

- empty；
- text；
- multi-line；
- existing entity mentions；
- editing previous message；
- initial entity；
- draft switch。

### 9.2 Entity Picker

- loading；
- no result；
- Understanding/Context/Domain mixed；
- long labels；
- keyboard up/down/enter/tab/escape；
- stale async response；
- error。

### 9.3 Attachment

- image；
- document；
- multiple files；
- remove；
- max count；
- oversized；
- adapter failure。

### 9.4 Model/Reasoning

- one/multiple models；
- reasoning off only；
- multiple reasoning levels；
- disabled model selection；
- long model name。

### 9.5 Status

- idle；
- running + stop；
- running without stop；
- compacting；
- submit pending；
- submit failure restore。

## 10. 测试归属

package tests：

- document codec round-trip；
- mention keyboard navigation；
- async stale result protection；
- attachment limits；
- initial entity application；
- draft identity/reset；
- submit/stop state。

Electron tests：

- entity query Adapter；
- attachment mapping；
- model/reasoning mapping；
- message usage mapping；
- submit → Agent command。

## 11. Renderer 替换

- `AgentThreadPanel` 使用 connected Composer container；
- 原 `ChatComposer` 和 `ContextPicker` implementation 删除；
- composer codec import 改到 `@reflecta/ui/chat`；
- Agent/Main types 只存在于 Adapter；
- TipTap dependencies 移到 UI package；
- query/cache 依赖继续属于 Electron。

## 12. Module 出口

- Composer 可在 Storybook 中完成输入、mention、附件和 submit；
- package 不引用 `@main`、`@shared/agent`、React Query 或 IPC；
- edit/resend document 可无损 round-trip；
- async entity search 不产生 stale result；
- App workflow 仍由 Renderer container 控制。
