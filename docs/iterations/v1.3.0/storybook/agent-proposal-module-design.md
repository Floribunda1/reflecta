# v1.3.0 Agent Proposal Module Design

> 状态：Planned
>
> 对应主计划：[Module 6：Agent Proposal](./ui-package-storybook-migration-plan.md)
>
> 组织逻辑：本文采用**递进型主线**，按“Tool protocol 全量盘点 → streaming lifecycle → UI-owned View Model → internal renderer → Adapter → Storybook 验收”展开。原因是 mutation Tool 会在参数生成期间连续更新 Proposal，必须先固定 identity 和 snapshot 语义，再设计每种 Tool 的 content；横向按 Understanding、Domain、Context、Bash、Unknown 五个 visual family 做 MECE 分类。

## 1. 结论

所有需要用户确认的 Tool 都通过一个 public Module 渲染：

```text
@reflecta/ui/chat
  AgentProposalCard
  AgentProposalView
  AgentProposalDecision
```

但已知 Tool 不再被压进 `generic`：

```text
understanding_create
understanding_update
understanding_delete
domain_create
domain_update
domain_delete
context_create
context_update
context_delete
bash (dangerous)
```

每个 Tool：

- 有明确 View Model kind；
- 有独立 Story；
- 有 Adapter mapping；
- 若 visual shape 相同，可以共享 internal renderer；
- 不成为单独 public export。

## 2. 当前 Component 处理

### 2.1 迁入 package

| 当前 implementation                 | 新 implementation                 | 可见性           |
| ----------------------------------- | --------------------------------- | ---------------- |
| `ToolCard`                          | `AgentProposalCard`               | public           |
| `CandidateShell`                    | `ProposalCardShell`               | package internal |
| `CandidateUnderstandingCard`        | `UnderstandingCreateProposal`     | package internal |
| `UpdateUnderstandingDiffCard`       | `UnderstandingUpdateProposal`     | package internal |
| generic delete fields               | `DeleteProposal`                  | package internal |
| generic Domain fields               | Domain create/update renderer     | package internal |
| `CandidateContextCard`              | `ContextCreateProposal`           | package internal |
| generic Context update fields       | `ContextUpdateProposal`           | package internal |
| `BashProposalCard`                  | `BashProposal`                    | package internal |
| `GenericProposalCard`               | `UnknownProposal` fallback        | package internal |
| status/default-open/duration visual | lifecycle visual helpers          | package internal |
| result detail visual                | 复用 Agent Execution Tool Details | package internal |

### 2.2 留在 Electron

| 当前职责                      | 原因                      |
| ----------------------------- | ------------------------- |
| `proposalTypeFor`             | raw Tool protocol mapping |
| `proposalViewFor` raw parsing | App/Agent Adapter         |
| `hydratePiApprovalPayload`    | App service I/O           |
| Understanding/Context query   | React Query/IPC           |
| Domain path lookup            | Capture tree              |
| approval mutation             | Agent workflow            |
| query invalidation/toast      | App state/feedback        |
| result ref mapping            | App entity contract       |
| raw error/output              | trust-boundary projection |

### 2.3 删除

- UI 根据 raw field key 查询 entity；
- UI 接收 `AgentReducedMessage`、`ApproveToolInput`；
- known Tool 使用 `GenericProposalView`；
- `status + state + preview` 三套重叠状态；
- React key 包含 lifecycle/status/index；
- package 内创建 query hook。

## 3. Streaming Lifecycle

```ts
export type AgentProposalLifecycle =
  "preview" | "pending" | "running" | "completed" | "rejected" | "failed";
```

### 3.1 Mutation Tool sequence

九种 mutation Tool 在模型生成 arguments 时发送多个完整 snapshot：

```text
preview(snapshot A)
  -> preview(snapshot B)
  -> pending(final hydrated snapshot)
  -> running
  -> completed | failed
```

用户拒绝：

```text
preview* -> pending -> rejected
```

规则：

- preview event 是完整 snapshot，不是字段 delta；
- 后一个 snapshot 替换前一个 content；
- 所有 frame 使用同一 `approvalId`；-最终 pending payload 可能经过 hydration，与最后 preview 不完全相同；
- preview 不显示确认/拒绝按钮；
- 缺字段显示 skeleton/fallback，不抛错。

### 3.2 Dangerous Bash sequence

dangerous Bash 由 permission gate 创建 Proposal，不参与 mutation arguments preview：

```text
pending -> running -> completed | failed
pending -> rejected
```

safe Bash 不进入本 Module，而是普通 Tool Activity。

### 3.3 Stable identity

```ts
export type AgentProposalBaseView = {
  id: string;
  title: string;
  lifecycle: AgentProposalLifecycle;
  note?: string;
  error?: string;
  result?: AgentToolDetailsView;
  decisionEnabled?: boolean;
};
```

- `id` 在 production 使用 `approvalId`；
- React key 只使用 `proposal.id`；
- lifecycle 更新不能 remount component；
- 手动折叠状态在 preview/frame 更新中保留；
- `decisionEnabled` 只有 final `pending` 可以为 true；
- `error` 只接受用户可见文本。

## 4. Understanding View Model

### 4.1 Create

```ts
export type UnderstandingCreateProposalView = AgentProposalBaseView & {
  kind: "understanding-create";
  content: {
    heading?: string;
    body?: string;
    domainPaths?: readonly string[];
  };
};
```

preview 中 `body` 允许暂时缺失；final pending 时 Adapter 必须提供最终 body。

### 4.2 Update

```ts
export type UnderstandingUpdateProposalView = AgentProposalBaseView & {
  kind: "understanding-update";
  content: {
    targetLabel?: string;
    beforeHeading?: string;
    afterHeading?: string;
    beforeBody?: string;
    afterBody?: string;
    domainPaths?: readonly string[];
    reason?: string;
  };
};
```

`before*` 通常只在 final hydrated snapshot 出现。preview 先展示已生成的 after 内容，不能等待 hydration 才出现卡片。

`domainPaths`：

- `undefined`：没有生成该字段；
- `[]`：明确移出所有 Domain；
- 非空：展示已解析 path。

### 4.3 Delete

```ts
export type UnderstandingDeleteProposalView = AgentProposalBaseView & {
  kind: "understanding-delete";
  content: {
    targetLabel?: string;
    reason?: string;
  };
};
```

使用 shared `DeleteProposal` visual，显示 destructive warning。

## 5. Domain View Model

### 5.1 Create

```ts
export type DomainCreateProposalView = AgentProposalBaseView & {
  kind: "domain-create";
  content: {
    name?: string;
    parentPath?: string | null;
    reason?: string;
  };
};
```

`parentPath`：

- `undefined`：stream 尚未生成/没有提供；
- `null`：明确创建为根 Domain；
- string：完整父路径。

### 5.2 Update

```ts
export type DomainUpdateProposalView = AgentProposalBaseView & {
  kind: "domain-update";
  content: {
    targetPath?: string;
    nextName?: string;
    nextParentPath?: string | null;
    reason?: string;
  };
};
```

只显示实际提供的 change；不把缺失字段误认为清空。

### 5.3 Delete

```ts
export type DomainDeleteProposalView = AgentProposalBaseView & {
  kind: "domain-delete";
  content: {
    targetPath?: string;
    deleteUnderstandings?: boolean;
    reason?: string;
  };
};
```

`deleteUnderstandings=true` 显示强化 warning；UI 不自行推断受影响数量。

## 6. Context View Model

### 6.1 Create

```ts
export type ContextCreateProposalView = AgentProposalBaseView & {
  kind: "context-create";
  content: {
    understandingLabel?: string;
    mediumLabel?: string;
    contextLabel?: string;
    body?: string;
  };
};
```

medium code → 中文 label 由 Electron Adapter 处理。

### 6.2 Update

```ts
export type ContextUpdateProposalView = AgentProposalBaseView & {
  kind: "context-update";
  content: {
    targetLabel?: string;
    understandingLabel?: string;
    mediumLabel?: string;
    nextTitle?: string;
    nextBody?: string;
    reason?: string;
  };
};
```

只显示实际更新字段。v1.3.0 没有 before snapshot，不伪造 Diff UI。

### 6.3 Delete

```ts
export type ContextDeleteProposalView = AgentProposalBaseView & {
  kind: "context-delete";
  content: {
    targetLabel?: string;
    reason?: string;
  };
};
```

使用 shared `DeleteProposal` visual。

## 7. Bash 与 Unknown

### 7.1 Bash

```ts
export type BashProposalView = AgentProposalBaseView & {
  kind: "bash";
  content: {
    command?: string;
    cwd?: string;
    timeoutMs?: number;
  };
};
```

- command 缺失显示“正在生成命令”或“未提供命令”；
- UI 不判断命令危险度；
- output 复用 `AgentToolDetailsView`；
- duration formatter 属于 UI。

### 7.2 Unknown fallback

```ts
export type UnknownProposalFieldView = {
  id: string;
  label: string;
  value: {
    format: "text" | "markdown" | "pre";
    value: string;
  };
};

export type UnknownProposalView = AgentProposalBaseView & {
  kind: "unknown";
  content: {
    fields: readonly UnknownProposalFieldView[];
  };
};
```

Unknown 只用于：

- future Tool；-历史 persisted Tool；
- Adapter 无法识别但仍需安全展示的 Proposal。

九种当前 mutation Tool 不允许映射到 unknown。

## 8. Union 与 Component Interface

```ts
export type AgentProposalView =
  | UnderstandingCreateProposalView
  | UnderstandingUpdateProposalView
  | UnderstandingDeleteProposalView
  | DomainCreateProposalView
  | DomainUpdateProposalView
  | DomainDeleteProposalView
  | ContextCreateProposalView
  | ContextUpdateProposalView
  | ContextDeleteProposalView
  | BashProposalView
  | UnknownProposalView;

export type AgentProposalDecision = {
  proposalId: string;
  decision: "approve" | "reject";
};

export type AgentProposalCardProps = {
  proposal: AgentProposalView;
  onDecision?: (decision: AgentProposalDecision) => void;
  entityBindings?: ChatEntityBindings;
};

export function AgentProposalCard(props: AgentProposalCardProps): React.ReactNode;
```

Button 规则：

- 只在 `lifecycle="pending"` 且 `decisionEnabled=true` 时显示；-点击只发 UI decision；
- Renderer 映射回 approval command；
- preview/running/terminal state 不保留隐藏的 active decision button。

## 9. Internal Renderer

```text
AgentProposalCard
└── ProposalCardShell
    ├── UnderstandingCreateProposal
    ├── UnderstandingUpdateProposal
    ├── DeleteProposal
    │   ├── Understanding Delete
    │   ├── Domain Delete
    │   └── Context Delete
    ├── DomainCreateProposal
    ├── DomainUpdateProposal
    ├── ContextCreateProposal
    ├── ContextUpdateProposal
    ├── BashProposal
    └── UnknownProposal
```

每个 Tool 不一定对应不同 React function，但每个 View Model kind 必须显式 dispatch；不允许 default 分支把已知 kind 静默降级。

## 10. Electron Adapter Mapping

| Raw Tool               | UI kind              | 必须解析的数据                          |
| ---------------------- | -------------------- | --------------------------------------- |
| `understanding_create` | understanding-create | title/body/domain paths                 |
| `understanding_update` | understanding-update | target/before/after/domain paths/reason |
| `understanding_delete` | understanding-delete | target/reason                           |
| `domain_create`        | domain-create        | name/parent path/reason                 |
| `domain_update`        | domain-update        | target/new name/new parent/reason       |
| `domain_delete`        | domain-delete        | target/deleteUnderstandings/reason      |
| `context_create`       | context-create       | parent Understanding/medium/title/body  |
| `context_update`       | context-update       | target/changed fields/reason            |
| `context_delete`       | context-delete       | target/reason                           |
| dangerous `bash`       | bash                 | command/cwd/timeout                     |
| unknown                | unknown              | safe display fields                     |

Adapter 规则：

- `id = approvalId`；
- partial preview 不做 required-field assertion；
- final pending 尽可能解析 entity label/path；
- 找不到 entity 时使用稳定 ID fallback；
- raw field key、query key、DTO 不进入 View Model；
- output/error 在 trust boundary 截断和脱敏；
- lifecycle 从 reducer `displayState + preview` 映射。

## 11. Storybook Matrix

### 11.1 每种 Tool

- Understanding Create；
- Understanding Update；
- Understanding Delete；
- Domain Create；
- Domain Update；
- Domain Delete；
- Context Create；
- Context Update；
- Context Delete；
- dangerous Bash；
- Unknown fallback。

### 11.2 Lifecycle

每个 visual family 至少覆盖：

- partial preview；
- later preview；
- final pending；
- running；
- completed；
- rejected；
- failed。

### 11.3 Sequence Story

必须提供可交互/自动播放 sequence：

```text
preview A -> preview B -> pending -> running -> completed
```

断言：

- DOM root identity 不变；-内容按 snapshot 更新；
- manual collapse state 保留；
- decision 只在 pending 出现；
- final hydrated fields 替换 preview；
- error 终态不会被后续旧 snapshot 降级。

## 12. 测试归属

package tests：

- lifecycle badge/open policy；
- known kind dispatch；
- partial field fallback；
- decision visibility/event；
- collapse state survives rerender；
- Delete warning；
- unknown safe rendering。

Electron Adapter tests：

- 九种 raw payload mapping；
- preview → final hydration；
- entity/path resolution；
- dangerous/safe Bash 分流；
- lifecycle mapping；
- unknown/legacy fallback。

Reducer integration tests继续覆盖：

- repeated preview request replace；
- approval/execution state monotonic merge；
- final assistant turn 不使状态倒退。

## 13. Renderer 替换

- `agent-turn-view.ts` 保留并收缩为 Adapter；
- 删除现有 Candidate/ToolCard JSX；
- connected container 提供 entity/path presentation；
- `onDecision` 映射到 approval mutation；-旧 message-list proposal tests 被 package + Adapter tests 替换。

## 14. Module 出口

- 每个 known Proposal Tool 有明确 UI kind；
- 每个 Tool 有独立 Story；
- mutation preview 连续更新不 remount；
- partial preview 不崩溃且不能决策；
- package 不依赖 raw payload/query/IPC；
- Renderer 只调用 `AgentProposalCard`。
