# v1.1.0 Contextual Agent Sidebar 计划

> 日期：2026-06-24
>
> 状态：Draft
>
> 目标：在 Capture / Graph 的对象页面里提供最小可用的 docked Agent sidebar，让用户可以从 Domain、Understanding 或图谱节点直接带上下文和 AI 对话。第一版不做独立窗口、不做完整知识库浏览、不做自动写入 proposal。

## 1. 结论

v1.1.0 先做 Capture 页面里的 contextual Agent sidebar。

正确方向不是把笔记浏览塞进 Agent 页面，而是让用户在查看自己的理解时，能从当前对象旁边召唤 Agent：

```txt
right click Domain / Understanding
  -> 和 AI 聊聊
  -> open docked Agent sidebar
  -> composer preloads the selected object as context
  -> user asks the actual question
```

第一版只做：

- Capture Domain 右键入口。
- Capture Understanding list 右键入口。
- Capture Understanding detail 顶部 chat 按钮。
- Docked Agent sidebar。
- 打开时带入当前 Domain / Understanding context chip。

暂时不做：

- Graph 节点右键入口。
- 独立弹窗或第二窗口。
- Agent 自动修改正文 / 新增 Context / 创建连接的 proposal UI。
- Agent 页面里完整浏览笔记或图谱。

原因：

- Reflecta 的主对象是 Understanding / Context / Domain，不是 Markdown 文件。
- 用户在 Capture 页的主任务是回看和整理个人理解，Agent 应该作为当前对象的辅助，而不是切换到另一个聊天工作区。
- 现有 Agent 页和 Capture 页已经有大部分组件，第一版应该复用并抽出可复用的单线程聊天面板。

## 2. 用户交互

### 2.1 入口

统一文案：

```txt
和 AI 聊聊
```

入口与上下文：

| 入口                                   | 带入上下文                  | 第一版 |
| -------------------------------------- | --------------------------- | ------ |
| Capture Domain tree 右键               | `{ type: "domain" }`        | 是     |
| Capture Understanding list 右键        | `{ type: "understanding" }` | 是     |
| Capture Understanding detail chat 按钮 | `{ type: "understanding" }` | 是     |
| Graph Understanding 节点右键           | `{ type: "understanding" }` | 否     |
| Graph Overview Domain 节点右键         | `{ type: "domain" }`        | 否     |

触发后不自动发送消息。只做：

1. 打开 docked Agent sidebar。
2. 在 composer 中预置 context chip。
3. 聚焦 composer。

不要自动生成类似“我们来聊聊这个理解”的用户消息。用户的问题必须由用户自己输入。

### 2.2 Sidebar 行为

第一版 sidebar 是 Capture 页右侧 dock，不是全局浮窗：

```txt
Domain tree | Understanding list + detail | Agent sidebar
```

行为：

- 点击同一个对象的“和 AI 聊聊”：复用当前 sidebar thread，聚焦输入框。
- 点击另一个对象的“和 AI 聊聊”：切换 sidebar scope，并在 composer 中预置新 context chip。
- 用户只是点击其他 Domain / Understanding 浏览内容时，不自动改变 sidebar scope。
- 关闭 sidebar 不删除 thread。

第一版不做复杂的“保持当前对话 / 切换当前对象”提示。入口动作本身表示用户要用这个对象开始或继续聊。

### 2.3 Understanding detail 的 chat 按钮显示规则

`UnderstandingDetail` 会被多个页面复用。chat 按钮只能在 Capture 主详情页出现：

- Capture 页面主 detail：显示。
- Graph detail panel：不显示。
- Agent context inspector：不显示。
- 其他嵌入式 preview / panel：不显示。

组件 contract：

```ts
type UnderstandingDetailProps = {
  understandingId: string;
  onDeleted?: () => void;
  onWikiLinkClick?: (understandingId: string) => void;
  onChat?: (input: { type: "understanding"; id: string; title?: string }) => void;
};
```

不需要 `showChatAction`。有 `onChat` 才显示按钮，默认不显示。

## 3. 当前代码复用点

### 3.1 Agent page 已经有可复用核心

现有文件：

```txt
apps/electron/src/renderer/src/modules/chat/index.tsx
apps/electron/src/renderer/src/modules/chat/session/pi-thread-view.ts
apps/electron/src/renderer/src/modules/chat/session/thread-view.ts
apps/electron/src/renderer/src/modules/chat/composer/chat-composer.tsx
apps/electron/src/renderer/src/modules/chat/messages/message-list.tsx
```

已经具备：

- `usePiAgentThreadView(sessionId)`：单个 Agent session 的消息、状态、操作。
- `AgentThreadView`：单线程聊天视图模型。
- `MessageList`：消息列表。
- `ChatComposer`：发送消息、@ 引用、附件、模型选择。
- `ResizablePanelGroup`：Agent 页右侧 inspector 已经使用。

需要抽取：

```txt
ChatPage private ThreadChatSurface
  -> AgentThreadPanel
```

建议新增：

```txt
apps/electron/src/renderer/src/modules/chat/agent-thread-panel.tsx
```

职责：

- 渲染一个 sessionId 对应的消息列表和 composer。
- 不包含 Agent thread sidebar。
- 不负责创建 / 删除 / 选择 thread。
- 接收 `initialContextRefs` / `initialContextKey`，用于入口触发后把 context chip 塞进 composer。

草案 contract：

```ts
type AgentThreadPanelProps = {
  threadId: string;
  scrollRequest?: number;
  initialContextKey?: string;
  initialContextRefs?: AgentContextRef[];
  onInspectContextRef?: (ref: InspectableContextRef) => void;
};
```

### 3.2 ChatComposer 需要一个小入口

`ChatComposer` 已经通过 editor JSON 维护 `selectedContexts`，发送时也会把 `contextRefs` 传给 Agent。

缺的是从外部预置 context chip。

建议给 `ChatComposer` 增加：

```ts
initialContextKey?: string;
initialContextRefs?: AgentContextRef[];
```

行为：

- `initialContextKey` 改变时触发。
- 当前不在编辑消息。
- composer 为空时，执行 `setComposerContent("", initialContextRefs)`。
- composer 不为空时，不覆盖用户输入。

这比暴露 editor imperative ref 更简单，也避免 Capture 直接碰 composer 内部状态。

### 3.3 Capture 已有 context menu

现有文件：

```txt
apps/electron/src/renderer/src/modules/capture/domain/components/DomainTree.tsx
apps/electron/src/renderer/src/modules/capture/understanding-list/UnderstandingRow.tsx
apps/electron/src/renderer/src/modules/capture/understanding-detail/UnderstandingDetail.tsx
apps/electron/src/renderer/src/modules/capture/index.tsx
apps/electron/src/renderer/src/modules/capture/store.ts
```

已经具备：

- Domain tree 右键菜单。
- Understanding row 右键菜单。
- Capture store 管理当前选中的 Domain / Understanding。
- Understanding detail 顶部已有删除按钮区域。

需要新增：

- `onChat` 从 `CapturePage` 下传到 `DomainTree` / `UnderstandingList` / `UnderstandingRow` / `UnderstandingDetail`。
- 在对应菜单中增加 `和 AI 聊聊`。
- 在 detail 删除按钮旁边增加 chat icon button。

## 4. Capture sidebar 状态

建议在 `capture/store.ts` 增加最小 UI 状态：

```ts
type CaptureAgentScope = {
  type: "domain" | "understanding";
  id: string;
  title?: string;
};

type CaptureAgentDockState = {
  open: boolean;
  scope: CaptureAgentScope | null;
  threadId: string | null;
  contextKey: string | null;
};
```

需要的 actions：

```ts
openAgentDock(scope: CaptureAgentScope): void;
bindAgentDockThread(threadId: string): void;
closeAgentDock(): void;
```

`contextKey` 用于通知 composer 重新预置 context chip：

```txt
`${scope.type}:${scope.id}:${Date.now()}`
```

也可以用 store 内递增 nonce，避免时间依赖：

```ts
agentDockContextNonce: number;
```

第一版不需要把 scope 和 thread 做复杂映射。当前 dock 只维护一个 thread。

## 5. Thread 创建策略

第一版采用简单策略：

```txt
openAgentDock(scope)
  -> if current dock thread exists, reuse it
  -> otherwise create one Agent thread
  -> seed composer with scope context chip
```

thread 标题：

```txt
聊聊：{title}
```

如果用户切换 scope，第一版仍复用当前 dock thread，只是把新对象作为下一条消息的 context chip。

原因：

- 每次右键都新建 thread 会制造太多空 thread。
- 做 per-scope thread map 会增加状态和恢复逻辑，第一版不需要。
- 用户可以在同一条对话里连续讨论多个理解；每轮消息的 `contextRefs` 已经记录当时上下文。

后续如果发现用户强烈需要“每条 Understanding 一条固定侧边对话”，再加 scope-to-thread 映射。

## 6. Layout 改造

当前 Capture 页面：

```txt
grid: 248px | main
main grid: list | detail
```

目标：

```txt
grid: 248px | resizable main group
main group:
  panel capture-main: list | detail
  panel capture-agent: AgentThreadPanel
```

伪结构：

```tsx
<div className="grid h-full grid-cols-[248px_minmax(0,1fr)]">
  <DomainTree onChat={openAgentDock} />
  <ResizablePanelGroup orientation="horizontal">
    <ResizablePanel id="capture-main">
      <div className="grid h-full grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <UnderstandingList onChat={openAgentDock} />
        <UnderstandingDetail onChat={openAgentDock} />
      </div>
    </ResizablePanel>

    {agentDock.open ? (
      <>
        <ResizableHandle withHandle />
        <ResizablePanel id="capture-agent">
          <CaptureAgentDock />
        </ResizablePanel>
      </>
    ) : null}
  </ResizablePanelGroup>
</div>
```

宽度建议：

- default: 36%
- min: 320px 或 28%
- max: 56%

保持和 Agent inspector 的 handle 样式一致，直接复用现有 class。

## 7. Graph 第二阶段

Graph 相关文件：

```txt
apps/electron/src/renderer/src/modules/contemplate/graph/index.tsx
apps/electron/src/renderer/src/modules/contemplate/graph/UnderstandingCanvas.tsx
apps/electron/src/renderer/src/modules/contemplate/graph/OverviewAtlas.tsx
```

当前 Graph 已经有：

- `selectedUnderstandingId`
- React Flow node rendering
- OverviewAtlas 的 Domain 节点

第二阶段入口：

- `UnderstandingCanvas` 给 understanding node 增加右键菜单或 React Flow `onNodeContextMenu`。
- `OverviewAtlas` 给 domain node 增加右键菜单。
- 触发同一个 `openContextualAgent(scope)` contract。

先不做：

- 多选节点 scope。
- 边 scope。
- 图上临时 proposal edge。
- Agent 回复联动高亮节点。

Graph 阶段只要做到“右键节点 -> 和 AI 聊聊 -> 带入节点上下文”。

## 8. 测试与验收

实现阶段修改测试前，先阅读项目单元测试规范：

```txt
docs/references/technical/architecture/unit-test-principles.md
```

建议最小测试：

- `capture/store.test.ts`
  - `openAgentDock` 打开 dock 并设置 scope。
  - 多次打开同一 scope 会递增 context nonce，让 composer 可重新 focus / seed。
  - `closeAgentDock` 只关闭，不清空 threadId。
- `chat-composer` 附近新增一条测试或组件测试
  - `initialContextKey` 改变且 composer 为空时，会预置 context ref。
  - composer 已有用户输入时，不覆盖。

手动验收：

- Capture Domain 右键能看到 `和 AI 聊聊`。
- Capture Understanding row 右键能看到 `和 AI 聊聊`。
- Capture Understanding detail 删除按钮旁边有 chat icon。
- Agent inspector 里展开 Understanding detail 时没有 chat icon。
- Graph detail / panel 里展开 Understanding detail 时没有 chat icon。
- 触发入口后右侧 dock 打开，composer 里有对应 context chip，输入框获得焦点。
- 发送消息后 Agent 收到 `contextRefs`。

## 9. 不做项

第一版明确不做：

- Markdown 文件浏览器。
- 数据看板。
- 独立窗口 / pop-out。
- 每个 Understanding 的持久专属 chat thread。
- Graph 多选和边级上下文。
- Agent 自动写入正文、Context 或 Connection。
- 在所有嵌入式 UnderstandingDetail 里显示 chat 按钮。

这些都可以后续加，但不应该挡住第一版最短路径。
