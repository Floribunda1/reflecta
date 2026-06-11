# Domain Workspace 视觉轻重规范

> 日期：2026-06-10
>
> 状态：Draft
>
> 主题：Domain Workspace Demo 页面的 **视觉轻重树** — 先定义 group / 元素的轻重关系，再推导 shadcn/ui token。
>
> 相关文档：
>
> - `docs/2-design/domain-workspace-detail-ux-path.md` — 右侧详情交互路径
> - `docs/2-design/pmf-mvp-information-architecture.md` — 信息架构
>
> 实现入口：`apps/electron/src/renderer/src/modules/demo/domain-workspace/index.tsx`

---

## 1. 本文解决什么问题

Token 不能先于结构。当前问题的根源不是「没用 shadcn/ui」，而是 **页面里有哪些视觉 group、谁该重谁该轻，没有写成可执行的规范**。

本文用 **treelist** 列出页面全部 group 与元素，并在每个 group 上标注 **视觉轻重档位**。后续所有 token / variant / shadow 的选择，必须能从这个树里的父子关系和档位推导出来，而不是反过来猜 class。

---

## 2. 轻重档位定义

用四档描述 **用户眼睛的停留优先级**，不是 CSS 字面量：


| 档位    | 标记     | 含义              | 用户感受         |
| ----- | ------ | --------------- | ------------ |
| **A** | `▁` 地面 | 退后、仅提供方位，不应抢戏   | 「我知道自己在哪」    |
| **B** | `▂` 工具 | 可操作但不构成内容主体     | 「我能搜、能新建」    |
| **C** | `▃` 悬层 | 画布上的卡片 / 条目，可拾取 | 「这里有一条理解可以点」 |
| **D** | `▅` 舞台 | 当前工作区的主体平面      | 「我正在这里工作」    |
| **E** | `█` 焦点 | 全页最重要的阅读 / 写作对象 | 「这就是我要读的东西」  |


### 2.1 Group 与元素

- **Group**：有独立背景、边框或阴影语义的容器（栏、画布、卡片组）。
- **Element**：group 内的叶子节点（文字、输入框、Chip、图标），继承 group 档位，可在括号内 **下调** 半档，不能上调超过父 group。

### 2.2 硬性规则

1. **同一父 group 内，子 group 档位不得高于父 group**（不能子比父更「重」）。
2. **全页只允许一个 `█` 焦点 group** — 阅读态下是「理解正文」；写作态下是「新理解正文」。
3. `**▅` 舞台只有一个连续区域** — 中栏列表 + 右栏正文共享，不能拆成两个不同深度的底色平面。
4. `**▃` 悬层只出现在 `▅` 舞台之上** — 不能出现在 `▁` 地面上。
5. **选中态不是新档位** — 仍是 `▃`，通过 **抬起**（对比度 / 阴影 / 边框）在同档位内区分，不得升级到 `█`。

### 2.3 Description Label 原则

**Description label** 指解释「这是什么区域 / 该怎么用」的文字，而不是用户内容本身。例如 section title、hint、eyebrow、操作说明、空状态引导语。

用户一旦理解区域或功能，这些文字 **不应再占用视觉带宽**。因此：

1. **能省则省** — 结构或 placeholder 已经能说明的，不再重复写 label。
2. **能弱则弱** — 必须保留时，档位固定为 `▁` 或更低（`whisper`），不得升到 `▂` 以上。
3. **不重复说教** — 同一信息只出现一次；breadcrumb 已说明领域时，不再另起标题解释「理解流是什么」。
4. **首访可发现，熟客可忽略** — 引导性文案优先放进 placeholder / `aria-label`，而不是页面上常驻的说明行。
5. **内容优先** — 任何 description label 的合计视觉重量，必须 **轻于** 同区域内的用户内容（标题、正文、卡片标题）。

#### Label 处置三态


| 处置     | 标记  | 含义                                 |
| ------ | --- | ---------------------------------- |
| **省略** | `⊘` | 不渲染；用结构、图标、placeholder 替代          |
| **耳语** | `∷` | 保留但最弱；`text-muted`、小字号、无 icon 装饰   |
| **结构** | `§` | 区域仍陌生时需要的 orienting 标题；熟客模式下可折叠或省略 |


---

## 3. 布局语法（参照 Linear）

```
[ ▁ 左栏导航 ]  |  [ ▅ 舞台 ───────────────────────────── ]
                 |  [ ▂ 理解流工具区 ] [ █ 理解正文 ······ ]
                 |  [ ▃ 理解卡片列表 ] [ ▂ 来源摘影 ······ ]
                 |                      [ ▁ 溯源条 ······ ]
```

- 全页 **仅左栏** 使用 `▁` 地面。
- **中栏 + 右栏** 同属一块 `▅` 舞台（一张白纸）。
- 中栏理解列表是 `**▃` 悬层** 落在舞台上，不是第二块地面。

---

## 4. 视觉轻重树（Treelist）

图例：`{档位}` group 名 — 说明；description label 附 `[⊘|∷|§]` 处置标记

```
DomainWorkspacePage {— 根，无自身档位，只承载子 group}
│
├─ LeftRail {▁ 地面}
│  ├─ NavHeader {▁}
│  │  ├─ eyebrow「Reflecta」          (⊘ — App 顶栏已有品牌，左栏重复)
│  │  └─ title「领域」                (∷ — 可弱化为小字或 ⊘，树结构已自明)
│  └─ CategoryTree {▁}
│     └─ CategoryItem {▁}
│        ├─ icon                      (element, ▁)
│        ├─ label                     (element, ▁ — 用户内容，非 description)
│        ├─ chevron                   (element, ▁)
│        └─ [selected] CategoryItem   (element, ▁+)
│
└─ WorkspaceCanvas {▅ 舞台 — 中栏 + 右栏共享}
   │
   ├─ StreamColumn {▅ 舞台子区}
   │  ├─ StreamHeader {▂ → 降为 ∷ 组}
   │  │  ├─ breadcrumb                 (∷ — 保留，已足够定向)
   │  │  ├─ title「理解流」             (⊘ — 与 breadcrumb 重复)
   │  │  └─ count badge                (∷ — 可选；无条目时可 ⊘)
   │  │
   │  ├─ ComposeEntry {▃ 悬层}
   │  │  ├─ icon                       (element, ▂)
   │  │  ├─ title                       (element, ▃ — 动作文案，非 description)
   │  │  └─ hint「正文里用 [[双链]]…」   (⊘ — 并入 placeholder / 首次空状态)
   │  │
   │  ├─ StreamSearch {▂ 工具}
   │  │  └─ SearchField                 (placeholder ∷，无额外 label)
   │  │
   │  └─ UnderstandingList {▃ 悬层组}
   │     └─ UnderstandingCard {▃}
   │        ├─ title                    (element, ▃ — 用户内容)
   │        ├─ excerpt                  (element, ▁)
   │        ├─ timestamp                (∷)
   │        ├─ meta chips               (∷ — 熟客可 ⊘，改 hover 披露)
   │        └─ [selected] UnderstandingCard  (▃+)
   │
   └─ ReaderColumn {▅ 舞台子区}
      │
      ├─ [mode: reading] ReadingView {▅}
      │  ├─ DocHeader {▂ → 仅承载 █，去掉说明层}
      │  │  ├─ timestamp               (∷)
      │  │  ├─ save status chip        (∷ — 保存成功可短暂出现后 ⊘)
      │  │  └─ ThoughtTitle {█ 焦点}
      │  │     └─ title input          (element, █)
      │  │
      │  ├─ DocBody {█ 焦点}
      │  │  └─ body textarea           (element, █)
      │  │
      │  ├─ SourcePreviewSection {▂ → ∷ 组}
      │  │  ├─ section title「来源摘影」  (∷ — 有卡片后标题可 ⊘)
      │  │  ├─ section hint「点击…」     (⊘ — 可点击卡片已暗示)
      │  │  └─ SourcePreviewCard {▃}
      │  │     ├─ type chip             (∷)
      │  │     ├─ source name          (element, ▃ — 用户内容)
      │  │     ├─ word count           (∷)
      │  │     └─ excerpt               (element, ▁)
      │  │
      │  └─ ProvenanceBar {▁}
      │     ├─ context summary         (∷ — 统计句，无 section 标题)
      │     └─ wikilink summary        (∷)
      │
      ├─ [mode: composing] ComposeView {▅}
      │  ├─ DocHeader {▂}
      │  │  └─ context line「写入 X」    (∷ — 仅 breadcrumb 不够时保留)
      │  ├─ DocBody {█}
      │  └─ SourceDraftSection {▂}
      │     ├─ section title           (∷ 或 ⊘ — 表单 field 自带 label)
      │     └─ ContextDraftCard {▃}
      │        ├─ type selector        (element, ▂ — 控件自解释)
      │        ├─ field labels         (∷ — 仅 focus 时显示，或 placeholder)
      │        └─ content field       (element, ▃)
      │
      ├─ [mode: empty] EmptyView {▅}
      │  └─ placeholder text           (∷ — 仅首访；有选中后永不出现)
      │
      └─ [overlay] ContextDrawer {▃+}
         ├─ type chip / word count    (∷)
         ├─ save status                (∷ 可 ⊘)
         ├─ source title field       (element, ▃)
         └─ source body field        (element, ▃)
```

---

## 5. Group 档位对照表


| Group                      | 档位  | 与相邻 group 的关系           |
| -------------------------- | --- | ----------------------- |
| `LeftRail`                 | ▁   | 全页最轻；唯一灰色地面             |
| `WorkspaceCanvas`          | ▅   | 全页最重平面；中栏 + 右栏共享        |
| `StreamColumn`             | ▅   | 舞台左半，不得独立成灰区            |
| `ReaderColumn`             | ▅   | 舞台右半，与 StreamColumn 同平面 |
| `StreamHeader`             | ▂   | 低于舞台内的卡片                |
| `ComposeEntry`             | ▃   | 高于工具区，低于正文焦点            |
| `StreamSearch`             | ▂   | 与 StreamHeader 同级       |
| `UnderstandingList`        | ▃   | 卡片组，整体悬在舞台上             |
| `UnderstandingCard`        | ▃   | idle；selected 为 ▃+ 不升级  |
| `DocHeader`                | ▂   | 元信息 + 标题容器              |
| `ThoughtTitle` / `DocBody` | █   | 全页唯一焦点（二选一模式）           |
| `SourcePreviewSection`     | ▂   | 正文之下的辅助区                |
| `SourcePreviewCard`        | ▃   | 可点击摘影，低于 █              |
| `ProvenanceBar`            | ▁   | 最轻的信息汇总，不得用 Card 重阴影    |
| `ContextDrawer`            | ▃+  | 临时覆盖，关闭后回到 █            |


---

## 5.1 Description Label 清单（当前 Demo）


| 位置         | 文案             | 处置    | 理由                        |
| ---------- | -------------- | ----- | ------------------------- |
| 左栏 header  | Reflecta       | ⊘     | 顶栏已有                      |
| 左栏 header  | 领域             | ∷ 或 ⊘ | 分类树已说明                    |
| 中栏 header  | 理解流            | ⊘     | breadcrumb 已含领域路径         |
| 中栏 header  | 条目数 badge      | ∷     | 非必须                       |
| Compose 卡片 | [[双链]] 说明行     | ⊘     | 写入 placeholder 一次即可       |
| 搜索框        | 查找已有理解         | ∷     | 仅 placeholder，无 label     |
| 右栏 header  | 已自动保存          | ∷     | 状态反馈，非说明；可淡出              |
| 右栏 header  | 写入 {领域}        | ∷     | compose 时 breadcrumb 可替代  |
| 来源区        | 来源摘影           | ∷     | 有卡片后可省略                   |
| 来源区        | 点击具体来源查看全文     | ⊘     | 卡片可点击已足够                  |
| 来源草稿       | 来源类型 / 标题 / 内容 | ∷     | 表单 focus 时显示或 placeholder |
| 溯源条        | N 个来源 / N 个双链  | ∷     | 保留为最弱汇总，不加 section 标题     |
| 空状态        | 选择一条理解…        | ∷     | 仅无选中时出现一次                 |
| 列表卡片       | 来源数 / 双链数 chip | ∷     | 熟客可 hover 披露              |


### 5.2 弱 label 的 Token 约束（实现时）


| 处置             | 字号            | 颜色           | 装饰                               |
| -------------- | ------------- | ------------ | -------------------------------- |
| `∷` whisper    | `body-xs` 或更小 | `text-muted` | 无 icon；无 uppercase；无粗体           |
| `§` structural | `body-sm`     | `text-muted` | 最多一个细 icon，不得与 `█` 同量级           |
| `⊘`            | —             | 不渲染          | 信息并入 placeholder、`aria-label`、结构 |


---

## 6. 选中态与桥接

### 6.1 左栏 `CategoryItem [selected]`

- 档位保持 `▁`
- 表现：同档位内的 `default` pill，**无阴影、无白卡片**
- 目的：告诉用户「当前领域」，但不与舞台竞争

### 6.2 中栏 `UnderstandingCard [selected]`

- 档位保持 `▃`
- 表现：相对 idle 卡片 **抬起**（对比更强、阴影更深、可选细 ring）
- 目的：桥接视线到右侧 `█` 正文，而不是自己变成焦点

### 6.3 右栏 `ThoughtTitle` + `DocBody`

- 档位 `█`
- 表现：**无 Card 包裹**，直接在 `▅` 舞台上排版
- 目的：舞台中最重的必须是文字本身，不是容器

---

## 7. 当前实现偏离（对照用）


| 偏离                     | 应有档位关系                    | 问题               |
| ---------------------- | ------------------------- | ---------------- |
| 中栏曾用独立灰底               | StreamColumn 应是 ▅ 子区，不是 ▁ | 出现第二块地面，舞台被割裂    |
| 卡片与画布同用 `surface`      | ▃ 必须比 ▅ 低一档 nested        | 悬层看不见，像平面污渍      |
| 左栏选中用白卡片 + 阴影          | CategoryItem 保持 ▁         | 导航变重，抢舞台         |
| 正文包在 Card 里            | DocBody 应是 █ on ▅         | 焦点被容器稀释          |
| 溯源条用重 Card             | ProvenanceBar 应是 ▁        | 页脚比摘影还重，倒挂       |
| section 标题 + hint 双行说明 | 来源区最多 ∷ 一行或 ⊘             | 说明压过摘影卡片         |
| 左栏 + 中栏双 header        | breadcrumb 或树二选一          | 重复 orienting 抢 █ |


---

## 8. Token 规范（最小一致集）

> 服从第 4 节 treelist 与第 2.3 节 label 原则。全页 **只使用本节列出的 token**；不新增第五种阴影、第三种分割、自定义灰色。

### 8.0 统一优先

对用户来说，**一致比精巧更重要**。因此：

1. **一个词一套用法** — 每个 shadcn/ui 语义 token 在全页只有一个职责（见 §8.1）。
2. **一个抽象管悬层** — 所有 `▃` 卡片只用 `Card` + `variant`，不另写 `ProminenceLevel` 以外的 class 名。
3. **状态用变体，不用新颜色** — idle / selected 只切换 Card `secondary` ↔ `default` 和阴影档，不引入 accent 底。
4. **说明文字共用 `whisper` 样式** — 所有 `∷` label 同一套字号与颜色。

---

### 8.1 颜色（6 个角色，够用即可）


| 角色      | shadcn/ui token                                        | 用于                        | 不得用于         |
| ------- | --------------------------------------------------- | ------------------------- | ------------ |
| **地面**  | `bg-background`                                     | `LeftRail` 整栏             | 中栏、右栏、卡片     |
| **舞台**  | `bg-surface`                                        | `WorkspaceCanvas`（中+右）    | 左栏、idle 卡片底色 |
| **嵌套**  | `Card variant="secondary"` → `bg-surface-secondary` | idle 理解卡片、来源摘影、Compose 入口 | 舞台底色、选中态     |
| **抬起**  | `Card variant="default"` → `bg-surface`             | selected 卡片、Drawer 面板     | idle 卡片、舞台   |
| **下沉**  | `Card variant="tertiary"` → `bg-surface-tertiary`   | 溯源条、表单内嵌块                 | 列表卡片         |
| **交互底** | `bg-default`                                        | 左栏选中 pill、列表 hover        | 大面积背景        |


文字只认两档：


| 角色     | Token             | 用于                                      |
| ------ | ----------------- | --------------------------------------- |
| **正文** | `text-foreground` | 标题、卡片标题、正文、输入内容                         |
| **耳语** | `text-muted`      | 所有 `∷` label、timestamp、placeholder、meta |


**Accent（`text-accent` / `Button primary`）**：全页仅 **表单内主操作**（如来源类型切换中当前项）。不用于选中、导航、卡片底。

---

### 8.2 阴影（3 档，全页共用）


| 档     | Token            | 用于                                 |
| ----- | ---------------- | ---------------------------------- |
| **无** | —                | 地面、舞台、█ 正文、溯源条、`∷` 区域              |
| **浅** | `shadow-surface` | idle `▃` 卡片（`variant="secondary"`） |
| **深** | `shadow-overlay` | selected `▃+` 卡片、Drawer            |


规则：**同一 group 内只用一档阴影**。选中卡片 = 换 `variant` + 升一档阴影，不加别的特效。

---

### 8.3 分割（2 种，少即是多）


| 类型      | Token                       | 用于                           | 不用于                |
| ------- | --------------------------- | ---------------------------- | ------------------ |
| **栏间线** | `border-separator`          | 左栏｜舞台之间；舞台内 Stream｜Reader 之间 | 卡片内部、列表项之间         |
| **文内线** | `border-b border-separator` | 右栏 DocHeader 与正文之间（唯一横线）     | 来源区上方、中栏 header 下方 |


卡片边界用 `border-border/50`（idle）→ `border-border`（selected），**不再叠 `Separator` 组件**。

---

### 8.4 字体（4 级，对应档位）

全页只这四种排版，不新增 intermediate 尺寸：


| 级别              | 样式                                                                           | 档位  | 用于                              |
| --------------- | ---------------------------------------------------------------------------- | --- | ------------------------------- |
| **focus-title** | `text-[2.125rem] font-semibold leading-tight tracking-tight text-foreground` | █   | 理解标题输入                          |
| **focus-body**  | `text-[1.0625rem] leading-[1.85] text-foreground`                            | █   | 理解正文输入                          |
| **card-title**  | `Typography body-sm semibold`                                                | ▃   | 理解卡片标题、来源名                      |
| **whisper**     | `Typography body-xs color=muted`                                             | ∷   | breadcrumb、timestamp、溯源、chip 文字 |


卡片摘要、来源 excerpt 用 `Typography.Paragraph sm muted`（介于 card-title 与 whisper 之间，仍算用户内容，不是 label）。

---

### 8.5 对齐与间距（一套网格）


| 区域             | 宽度 / 约束    | 水平 padding                   | 垂直节奏                      |
| -------------- | ---------- | ---------------------------- | ------------------------- |
| `LeftRail`     | `220px` 固定 | `px-2`                       | 项间距 `gap-0.5`             |
| `StreamColumn` | `340px` 固定 | `px-4`                       | 工具区 `gap-3`；卡片列表 `gap-1`  |
| `ReaderColumn` | `flex-1`   | 内容 `max-w-3xl mx-auto px-12` | 区块 `gap-8` / `space-y-10` |


三栏 **顶对齐**，不做 vertical center。右栏阅读宽 `max-w-3xl`，与中栏卡片左缘 **不强制列对齐** — 舞台内两列独立排版，只靠栏间线分割。

---

### 8.6 悬层卡片：唯一组件模式

所有 `▃` / `▃+` group 统一为：

```
Card variant={selected ? "default" : "secondary"}
  + shadow-surface (idle) 或 shadow-overlay (selected)
  + rounded-xl p-3
  + selected 时 ring-1 ring-border/50
```


| Group               | idle              | selected                   |
| ------------------- | ----------------- | -------------------------- |
| `UnderstandingCard` | `secondary` + 浅阴影 | `default` + 深阴影 + ring     |
| `ComposeEntry`      | `secondary` + 浅阴影 | `default` + 深阴影 + ring     |
|                     | `secondary` + 浅阴影 | —（hover 仅 `border-border`） |
| `ContextDrawer`     | —                 | `overlay` 浮层 + 深阴影         |


`ProvenanceBar` / `ContextDraft` 内嵌：`**tertiary` + 无阴影**，不用 Card 的默认 `shadow-surface`。

---

### 8.7 选中与交互（仅 2 套，全页复用）


| 位置                     | 选中表现    | Token                                                |
| ---------------------- | ------- | ---------------------------------------------------- |
| 左栏 `CategoryItem`      | 浅灰 pill | `bg-default` + `font-semibold`，**无 shadow、无 ring**   |
| 中栏 `UnderstandingCard` | 抬起卡片    | `Card default` + `shadow-overlay` + `ring-border/50` |


Hover：列表项 `bg-default`（左栏）；卡片 `border-border/80`（中栏）。**不用 accent，不用白底 + 阴影组合在导航上。**

---

### 8.8 Chip 与表单


| 组件                          | 统一用法                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `Chip`                      | 仅 `variant="tertiary"`；meta、保存状态、来源类型                        |
| `SearchField`               | `variant="secondary"`；只有 placeholder，无 label                 |
| `Input` / `TextArea`（█）     | 透明底：`!bg-transparent !border-transparent !shadow-none !px-0` |
| `Input` / `TextArea`（▃ 表单内） | `variant="secondary"`                                        |


---

### 8.9 Group → Token 速查


| Group               | 背景                     | 分割                    | 阴影  | 字体                          |
| ------------------- | ---------------------- | --------------------- | --- | --------------------------- |
| `LeftRail`          | `background`           | 右 `border-separator`  | 无   | whisper / 项 label `text-sm` |
| `WorkspaceCanvas`   | `surface`              | —                     | 无   | —                           |
| `StreamColumn`      | 继承 surface             | 右 `border-separator`  | 无   | breadcrumb = whisper        |
| `UnderstandingCard` | Card secondary/default | `border-border/`*     | 浅/深 | card-title + whisper        |
| `ReaderColumn`      | 继承 surface             | —                     | 无   | focus-title / focus-body    |
| `SourcePreviewCard` | Card secondary         | `border-border/*`     | 浅   | card-title + excerpt muted  |
| `ProvenanceBar`     | Card tertiary          | 可选 `border-separator` | 无   | whisper                     |
| `ContextDrawer`     | `overlay`              | —                     | 深   | card-title 级                |


---

### 8.10 禁止（保证 consistency）

- 禁止 `bg-background-secondary` 做中栏底色。
- 禁止 idle 卡片 `bg-surface`（与舞台同色）。
- 禁止 `accent-soft` / 彩色选中底。
- 禁止 █ 区域外包 Card 或加阴影。
- 禁止同一功能混用 `Separator` + `border-b` + 卡片 border 三种分割。
- 禁止为单个组件发明 `zinc-*` / 任意 hex — 只用 §8.1–8.3 的语义 token。
- 禁止 `∷` label 使用 `font-semibold` 或 icon 装饰。

---

### 8.11 实现检查（3 问）

1. 任意两个 `▃` 卡片，是否 **同一套** Card + shadow 规则？
2. 任意两处 `∷` 文字，是否 **同一套** whisper 样式？
3. 是否还能找到 **本节未列出** 的颜色 / 阴影 / 分割 token？若有，应删或并入上表。

---

## 9. 验收问题

实现完成后，用下面五个问题自检；任一为「否」则 token 仍错：

1. 左栏是否明显 **轻于** 中右合并区域？
2. 中栏理解卡片是否像 **悬在白纸上的卡片**，而不是另一块灰底？
3. 选中理解后，视线是否自然滑到 **右侧标题**，而非停在中栏卡片？
4. 正文标题 + 正文是否 **没有 Card 外框**，且是全页最醒目文字？
5. 溯源条是否 **轻于** 来源摘影卡片？
6. 页面上是否还存在 **可删的 description label**（应标 ⊘ 的仍常驻）？
7. 保留的说明文字是否都 **弱于** 同区用户内容（`∷` 未升到 `▂`）？

---

## 10. 下一步

1. 按 §5.1 **⊘ / ∷** 清单削减 description label。
2. 按 §8.9 速查表逐 group 套用 token，**不新增** §8.10 以外的 class。
3. 悬层统一走 §8.6 一种 Card 模式；选中只走 §8.7 两套交互。
4. 若 `surface` 与 `surface-secondary` 对比不足，**只调 theme 两级亮度**，不改组件结构。
5. 用 §8.11 三问 + §9 七问验收后，再考虑是否抽取共享组件。

