# Design Decision: Agent Chat Visual Hierarchy

> 日期：2026-06-18
>
> 状态：Draft
>
> 输入依据：当前 Agent Chat 截图、`docs/references/ui/ui-spec-guide.md`、v2 Agent 产品体验讨论。

## 1. 页面目标

面向高频使用 Reflecta 做理解深化和笔记关联讨论的桌面端用户，页面要让用户把注意力稳定放在当前对话内容和下一次输入上。Agent 工作过程需要可见但不能抢正文层级；左侧 thread list 是导航层，不应该比当前对话更重。

## 2. Template

```text
AgentChatPage
  w-full h-full max-w-none
  px-0 py-0
  overflow-hidden
  bg-background

  ChatShell
    grid h-full min-w-0
    grid-cols-[248px_minmax(0,1fr)]
    bg-background

    ThreadSidebar
      h-full min-w-0
      p-0

    ThreadWorkspace
      flex h-full min-w-0 flex-col
      bg-background

      MessageViewport
        flex-1 min-h-0 overflow-y-auto
        px-6 py-6

        MessageColumn
          mx-auto max-w-3xl
          flex flex-col gap-5

      DevStreamInspector
        mx-auto max-w-3xl
        px-6 py-2
        only DEV

      ComposerDock
        border-t
        px-6 py-4
```

排列逻辑：页面只有两个主层级：左侧导航和右侧工作区。左侧 ThreadSidebar 必须和 Capture 页面的 DomainNavigation 使用同一套 sidebar 视觉语法：同样的宽度、titlebar 对齐、弱 surface、ghost row selected state；它只帮助切换 thread，视觉权重必须低于右侧。右侧从上到下依次是 conversation、开发态 stream inspector、composer。对话流是主内容，composer 是持续可见的下一步行动入口；dev stream inspector 只在开发环境出现，且不能在视觉上插入正文和输入之间成为第三个主层级。

## 3. Organisms

### ThreadSidebar

- 容器 token：
  - Surface：复用 Capture `DomainNavigation` 的 sidebar surface；不设置独立 `bg-muted` 大面积底色，贴在页面底层 `bg-background` / app shell 材质上
  - Spacing：外层 `p-0`；SidebarHeader 使用 `px-5 pt-14 pb-3` 对齐 macOS traffic light；thread list 使用 `p-0 space-y-0.5`
  - Border / Radius / Shadow：不使用 `border`、`rounded-*` 或 `shadow-*`

```text
aside
  SidebarHeader
    title「Agent」
    Button(new thread)
  ThreadGroup[]
    GroupLabel
    ThreadRow[]
```

- 状态规则：
  - `selected-thread` → 复用 Capture `DomainNodeRow` 的选中语义：`bg-muted text-foreground font-medium`
  - `hover-thread` → 沿用 shadcn `Button ghost variant` 的轻量 hover，不改变尺寸
  - `renaming` → 原地 Input 编辑，不弹 Modal
- 约束：ThreadSidebar 是导航，不展示完整消息、Agent 状态、tool 结果或大型卡片；整体视觉必须和 Capture 左侧 DomainNavigation 保持同一系统，而不是另做一个独立 chat sidebar。

#### Detail: ThreadRow

- 组成：ContextMenuTrigger + single ghost row button + title + preview
- 布局：`flex min-w-0 items-start gap-2`
- 间距：复用 Capture row 节奏，row 保留 shadcn `Button ghost variant` + `size="sm"` 的默认 padding / radius / height；preview 作为 row 内第二行，不额外制造 Card padding
- 展示规则：title 最多 1 行；preview 最多 1 行；preview 使用弱 meta 语义
- 状态规则：
  - `context-menu` → 右键打开 shadcn `ContextMenu`，提供重命名、归档、删除；删除前必须确认
- 约束：不使用 `shadow-*`；不使用明显 Card surface；不使用独立 `rounded-lg border bg-card`；不放 hover action button；ThreadRow 和 Capture 的 DomainNodeRow 必须共享 `hover / selected` 视觉语言与右键操作模型。

### MessageViewport

- 容器 token：
  - Surface：`bg-background`
  - Spacing：viewport `px-6 py-6`；message column `gap-5`
  - Border / Radius / Shadow：无外层 border、radius、shadow

```text
main
  MessageColumn
    EmptyState
    UserTurn
    AssistantTurn
    ErrorBanner
```

- 状态规则：
  - `empty` → 使用 shadcn `Empty`，居中但不做营销式 hero
  - `error` → 就地 Alert-like row，靠近出错 turn
- 约束：MessageViewport 是最高阅读层级；不能让 sidebar、tool log、dev inspector、composer 使用更强视觉权重。

### UserTurn

- 容器 token：
  - Surface：user bubble 使用 `bg-primary text-primary-foreground`
  - Spacing：bubble `px-4 py-3`
  - Border / Radius / Shadow：`rounded-lg`，不使用 shadow

```text
div
  UserBubble
  ContextBadgeRow
  MessageActions
```

- 状态规则：
  - `hover-actions` → 复制 / 编辑按钮只在 hover 或 focus-within 出现
- 约束：User bubble 作为用户输入回显，宽度不超过 `max-w-[80%]`；context badges 是证据线索，不抢 bubble 层级。

#### Detail: ContextBadgeRow

- 组成：Badge[]
- 布局：`flex flex-wrap gap-1`
- 间距：紧贴对应 UserBubble，下方不单独拉开大间距
- 展示规则：Badge 文案使用 `Type · Title`
- 约束：Badge 只表示引用对象，不使用 filled primary 样式；不能被设计成 tag editor。

### AssistantTurn

- 容器 token：
  - Surface：默认无 bubble，正文直接落在 MessageColumn 上
  - Spacing：turn 内部 `gap-2`；正文段落使用 markdown 自己的垂直节奏
  - Border / Radius / Shadow：assistant 正文不使用 Card / bubble

```text
div
  ThinkingSummary
  ToolActivityGroup[]
  AssistantMarkdown
  ProposalCard[]
  EvidenceFooter
  MessageActions
```

- 状态规则：
  - `streaming` → 正文流式出现，thinking 可展开，tool activity 可显示运行中
  - `completed` → thinking 默认折叠成一行摘要；正文保持最高权重
  - `stopped` → 就地显示弱状态 pill，不使用 error 色
- 约束：Assistant 正文是主阅读对象，不能被 tool card、thinking card 或 evidence footer 视觉压过；不要把所有 tool 统一堆到 turn 底部之外。

#### Detail: AssistantMarkdown

- 组成：Streamdown 渲染结果
- 布局：`w-full max-w-[80%] px-1 py-1`
- 间距：正文 line-height 使用 `leading-6`
- 展示规则：普通段落使用正文语义；strong / list / quote 由 markdown renderer 承担
- 约束：不要给整段 assistant 正文套 Card；不要让长回答看起来像文档编辑器页面。

#### Detail: ThinkingSummary

- 组成：Collapsible + summary row + detail list
- 布局：`w-full max-w-[80%]`
- 间距：trigger `px-3 py-2`；content `px-3 py-2`
- 状态规则：
  - `running` → 默认展开或半展开
  - `completed` → 默认折叠
- 约束：Thinking 是过程线索，使用 dashed / muted 层级；不能和 ProposalCard 用同一强 surface。

#### Detail: ToolActivityGroup

- 组成：Collapsible + summary + status Badge + detail list
- 布局：`w-full max-w-[80%]`
- 间距：trigger `px-3 py-2`；content `px-3 py-2`
- 状态规则：
  - `running` → status Badge 使用 outline 语义
  - `failed` → status Badge 使用 destructive 语义
  - `completed` → 默认折叠
- 约束：多个连续 tool 应该表现为一个 activity group；tool 详情默认低于 assistant 正文，不使用大阴影或大圆角。

#### Detail: ProposalCard

- 组成：Card-like container + title/status + content preview + action buttons
- 布局：`w-full max-w-[80%]`
- 间距：container `px-3 py-2`；actions `mt-3 flex gap-2`
- 状态规则：
  - `pending` → 显示确认 / 拒绝 / 忽略
  - `approved` → 显示写入结果，降低行动按钮层级
  - `rejected` → destructive-ish status，但不占用错误 banner 层级
  - `ignored` → 弱状态，控制权回到 composer
- 约束：Proposal 是需要用户决策的唯一高权重 assistant 子块；不能和普通 tool log 一样弱。

#### Detail: EvidenceFooter

- 组成：label + Badge[]
- 布局：`flex max-w-[80%] flex-wrap items-center gap-1`
- 间距：贴近 turn 末尾，不单独形成卡片
- 展示规则：最多展示 3 条，更多使用 `+N`
- 约束：Evidence 是回答依据，不是导航主入口；视觉权重必须低于正文和 proposal。

### ComposerDock

- 容器 token：
  - Surface：dock 使用 `bg-background`；editor surface 使用 `border-input bg-background`
  - Spacing：dock `px-6 py-4`；内部 column `gap-2`
  - Border / Radius / Shadow：dock 只用顶部 `border-t`；editor 使用 `rounded-md border`，不使用大 shadow

```text
section
  EditingBanner
  ContextPicker
  ComposerRow
    EditorSurface
      TiptapEditorContent
    ActionColumn
      Button(send)
      Button(stop)
```

- 状态规则：
  - `editing` → EditingBanner 显示正在编辑上一条消息，可取消
  - `context-picker-open` → ContextPicker 出现在 editor 上方，不能抢 editor 焦点
  - `busy` → editor disabled-like，send disabled，stop visible
- 约束：Composer 是行动入口，不是底部浮动卡片；不使用比 MessageViewport 更强的阴影；send button 是唯一主按钮。

#### Detail: ContextPicker

- 组成：Command + CommandList + CommandItem[]
- 布局：`rounded-md border shadow-sm`
- 间距：沿用 Command 内部间距
- 状态规则：
  - `loading-empty` → 显示“正在查找可引用内容...”
  - `empty` → 显示“没有可选上下文”
- 约束：composer 场景不显示 CommandInput，query 来自正文里的 `@xxx`；CommandItem 鼠标选择不能让 editor 丢失 mention range。

#### Detail: EditorSurface

- 组成：Tiptap EditorContent + placeholder
- 布局：`relative flex min-w-0 flex-1`
- 间距：editor content `px-3 py-2`
- 展示规则：placeholder 只在 draft 为空且无 context chip 时显示
- 约束：inline chip 是正文 token，不是 editor 上方/下方的独立 badge list；editor surface 不使用 `Textarea`。

### DevStreamInspector

- 容器 token：
  - Surface：`border-dashed border-border/80`
  - Spacing：`px-3 py-2`
  - Border / Radius / Shadow：`rounded-md`，无 shadow

```text
details
  summary
  debug rows
```

- 状态规则：
  - `DEV only` → 只在开发环境显示
- 约束：不能出现在生产环境；不能在视觉上抢 composer 或正文层级。

## 4. Token Review

#### Surface Hierarchy

- 统一规则：主阅读区 `bg-background` 最高稳定性；ThreadSidebar 复用 Capture DomainNavigation 的弱 sidebar surface；tool/thinking 使用 muted/dashed 辅助 surface；proposal 使用普通 bordered surface；composer dock 只用 top border 和 editor border。
- 禁止：ThreadSidebar 添加独立 border/radius/shadow；sidebar thread row 使用 shadow card；assistant 正文整体套 Card；composer 使用大阴影浮层；dev inspector 生产可见。

#### Typography

- 统一规则：assistant/user 正文使用 `text-sm leading-6`；sidebar preview、evidence、tool detail 使用 `text-xs` 或 muted；proposal title 使用 `font-medium`。
- 禁止：把 tool summary、sidebar title、proposal title 都提升到同一粗标题层级；用大号标题制造聊天页面的 landing page 感。

#### Spacing Rhythm

- 统一规则：ThreadSidebar 沿用 Capture sidebar 的 `px-5 pt-14 pb-3` header 与 `p-0 space-y-0.5` list；右侧页面级 `px-6 py-6 / py-4`；message 间距 `gap-5`；turn 内部 `gap-2`；detail 内部 `gap-1/2`。
- 禁止：把右侧 message padding 复制到 sidebar；tool card 和正文之间出现比 message 间距更大的断裂；composer 与 inspector 之间形成多个独立 footer 层。

#### Interaction State

- 统一规则：Button hover/active/focus-visible/disabled 沿用 shadcn 默认；selected thread 复用 Capture DomainNodeRow 的 `bg-muted text-foreground font-medium`；busy composer 用 disabled-like opacity。
- 禁止：重写 shadcn Button 基础状态；用颜色同时表达 selected、disabled、error 三种语义。

#### Component Variants

- 统一规则：ThreadSidebar 新建入口复用 Capture 的 `Button ghost variant + size="icon-sm"`；ThreadRow 使用 `Button ghost variant + size="sm"`；主发送按钮使用 Button `default variant`；普通 icon action 使用 `ghost variant`；危险确认使用 destructive；状态 Badge 优先 outline。
- 禁止：ThreadSidebar 新建入口使用 outline button；普通 tool completion 使用 destructive / primary；忽略状态使用错误色；复制/编辑/重新生成按钮使用主按钮样式。

#### Hard-coded Values

- 统一规则：颜色必须使用 semantic token / shadcn variant / Tailwind semantic class。
- 禁止：使用 `#ffffff`、`bg-blue-*`、`text-gray-*` 这类脱离 token 系统的颜色；使用随机 shadow / radius 表达业务层级。

## 5. Atoms 索引

| 组件         | Variant / 配置                                       | 使用位置                                                                           |
| ------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Button       | default variant                                      | ComposerDock / send                                                                |
| Button       | ghost variant, icon-sm                               | ThreadSidebar new                                                                  |
| Button       | ghost variant, icon-xs                               | MessageActions、EditingBanner cancel                                               |
| Button       | ghost variant, size="sm"                             | ThreadRow select                                                                   |
| Button       | outline variant                                      | ComposerDock stop                                                                  |
| Button       | destructive variant                                  | ErrorBanner retry、未来 destructive confirm action                                 |
| Badge        | outline variant                                      | ToolActivityGroup status、EvidenceFooter、ContextBadgeRow、ContextPicker item type |
| Empty        | default composition                                  | MessageViewport empty state                                                        |
| Command      | `shouldFilter=false`                                 | ContextPicker                                                                      |
| CommandList  | default configuration                                | ContextPicker                                                                      |
| CommandItem  | default configuration + `onMouseDown preventDefault` | ContextPicker                                                                      |
| CommandInput | hidden in composer context                           | ContextPicker non-composer reuse only                                              |
| Collapsible  | default configuration                                | ThinkingSummary、ToolActivityGroup                                                 |
| Input        | default configuration                                | ThreadSidebar renaming                                                             |
| ContextMenu  | default configuration                                | ThreadRow 右键重命名 / 归档 / 删除                                                 |
| AlertDialog  | destructive-confirm                                  | Thread / proposal / future delete confirm flows                                    |

## 6. 不做的决策

- ❌ **不把 assistant 正文放进 Card** → 对话正文是主阅读内容，不应该被框成次级资料块。
- ❌ **不为 Agent sidebar 另做一套视觉系统** → 它应该和 Capture sidebar 保持同一产品骨架和 token 语义。
- ❌ **不把 sidebar thread row 做成阴影卡片** → sidebar 是导航层，不能比当前对话更重。
- ❌ **不在 ThreadRow 上放 hover 操作按钮** → Capture sidebar 的 row 操作通过右键菜单触发，Agent sidebar 必须保持同一交互模型。
- ❌ **不让 dev stream inspector 进入生产视觉层级** → 它是调试工具，不是用户理解 Agent 的 UI。
- ❌ **不把 context chip 放到 editor 上方或下方** → `@` 引用是句子中的 inline token，必须留在正文流里。
- ❌ **不为每个 tool call 做独立重卡片** → 连续 tool 是一个工作阶段，默认应该 group 和折叠。
- ❌ **不新增 Modal 来展示 thinking/tool 详情** → 详情是 turn 内部信息，弹层会打断阅读和输入节奏。
- ❌ **不硬编码品牌色或灰阶色** → 当前页面必须继续跟随 shadcn / app theme token。
