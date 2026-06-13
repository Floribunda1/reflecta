# UI Review 规范

## 文档目的

这份规范用于 review 前端 UI 设计稿、design spec 和实现代码。它不描述审美偏好，而是把常见判断变成可以逐项检查的规则。

适用范围：桌面端业务界面、工具型界面、列表 / 详情 / 编辑工作台。

## 核心判断

- 先看结构，再看颜色。布局层级不对时，不通过颜色补救。
- 先看常态，再看状态。hover、selected、active、focus-visible 必须服务同一个交互模型。
- 先删无用文案，再调字号。重复解释、低价值说明和每条都一样的文字标签会降低扫描效率。
- 优先使用 shadcn semantic token 和组件 variant，不引入硬编码色阶。

## Layout / Surface

- 页面只能有一个主视觉权重最高的工作区。这个工作区可以通过 `bg-card`、`border`、`rounded-xl`、`shadow-sm` 形成悬浮 surface。
- App 大面积背景优先使用 `bg-background`。Electron / macOS 窗口材质场景可以使用透明窗口 + `bg-background/*` + `backdrop-blur-*`；需要轻微分层时最多使用 `bg-muted/30`。不要大面积使用脏感较强的 `bg-muted`。
- Electron 透明窗口必须同时保留窗口控制和拖动能力：macOS 使用 `titleBarStyle: hiddenInset` 或等价配置保留红绿灯；根 shell 提供 `-webkit-app-region: drag`；按钮、输入、滚动区和可点击内容必须标记 `no-drag`。
- 左侧导航、索引、详情如果同屏出现，必须明确层级：导航是语境层，索引是扫描层，详情是编辑 / 阅读层。
- 右侧主工作区不能只靠一条分割线强调，必须同时有 surface 对比、边界和轻量阴影。
- 不允许把页面 section 包成一层又一层 Card。Card 只用于重复条目、复杂表单、弹层内容或需要独立边界的内容块。
- 顶层列之间必须使用统一外边距和垂直节奏。左右两侧的 header 顶边或标题 baseline 必须对齐，不能一侧明显下沉。

检查方式：

1. 缩到整屏看，先判断哪个区域最重要。
2. 关掉文案理解，只看背景、边框、阴影，确认层级仍然成立。
3. 对齐左右 header、列表首项、详情正文起点，发现 4px 以上无理由错位就要修。

## Text Density

- UI 上的说明文字默认不展示。只有当用户需要做选择、理解后果或空态需要引导时，才写 description。
- SectionHeader 的 description 是可选项，不是默认结构。常规区块只保留标题和操作。
- 规则性说明应留在 spec 或代码约束里，不进入常规 UI。例如“关系来自正文双链”属于产品规则，不应长期占用详情页空间。
- 列表卡片内如果每条都重复同一类标签，优先改成 icon + count 或 icon + short value。
- 卡片摘要最多 2 行；详情正文才承载完整内容。
- 按钮文字只写动作，不写解释。能用图标表达的低风险 meta，不写成长文本 chip。

检查方式：

1. 逐个删除 description，只有删掉会让用户无法完成任务时才恢复。
2. 扫描列表卡片，重复出现 3 次以上的标签文案必须改成更轻的表达。
3. 检查空态文案是否服务下一步动作，不写功能介绍。

## Interactive States

- 可点击、可选中、可聚焦的单元必须 review `hover`、`selected`、`active`、`focus-visible` 是否需要额外约束。
- 不要求每个组件都写全状态；只写会影响视觉、布局、交互反馈或用户理解的状态。
- local-only 页面不要为了完整性写 `loading`、`error`。没有远程请求、异步恢复或系统异常展示时，这些不是 UI 状态。
- 业务条件不是状态。例如 invalid name 是校验条件，对应 UI 表达通常是 disabled、helper text 或 form message。
- hover、selected、active 不得改变 padding、border width、height、grid track、字体大小或布局位置。
- dense list 里的 active 不使用 translate / scale。点击时只允许改变 background、border color 或保持不变，避免卡顿感。
- selected 可以使用 `shadow-sm` 表达当前指针；普通 hover 默认不加 shadow，除非该 spec 明确把 hover 作为悬浮反馈。
- focus-visible 保留 shadcn ring，不用 focus ring 表达 selected。

检查方式：

1. 连续快速点击列表项，卡片不能发生位移、尺寸变化或阴影强弱跳变。
2. 鼠标 hover 与键盘 focus 分别检查，二者都要可见但语义不同。
3. selected 和 hover 叠加时，selected 优先级更高。

## Card / Row

- 可选中 Card 的默认、hover、selected、active 必须使用同一套边框和背景逻辑。
- 默认 Card：`bg-card border-border shadow-none` 或 shadcn Card 默认。
- hover Card：只做轻量反馈，建议 `bg-accent/30 border-border`，不加 shadow。
- selected Card：当前详情指针，建议 `bg-card border-ring shadow-sm`。
- active Card：不改变尺寸和位置，建议 `bg-accent/20` 或不单独定义。
- Tree / navigation row 的 selected 不使用 shadow，只用 `bg-accent text-accent-foreground font-medium`。
- Tree / navigation row 优先使用单个整行 button 承载选择和展开，chevron 只是行内状态图标；低频操作优先走右键菜单，不默认展示 more 按钮。
- Row 如果确实需要多个点击区，多个 button 必须是兄弟关系，不能 button 嵌套 button。可用 `ContextMenuTrigger asChild` 或 `DropdownMenuTrigger asChild` 绑定对应 button。

## Icon Meta

- 列表卡片的来源、关系、附件、评论等重复 meta 优先用 lucide icon + count。
- 0 值 meta 使用 muted icon + `0`，不要写“无来源”“暂时独立”这类解释性 chip。
- icon meta 使用 `text-xs text-muted-foreground`；selected 卡片中仍保持弱权重，不抢标题。
- icon 必须有 `aria-label` 或 screen-reader 文案，不能只依赖视觉符号。
- 只有当 meta 值会影响用户决策且图标无法理解时，才允许短文本。

## Token Rules

- Text：
  - 标题使用 `font-medium` 或页面定义的标题 token。
  - 次级 meta 使用 `text-muted-foreground`。
  - 危险动作只使用 `text-destructive` 或 destructive variant。
- Surface：
  - 页面背景使用 `bg-background`，窗口材质场景使用 `bg-background/*` + `backdrop-blur-*`。
  - 主工作区使用 `bg-card` 或更实的 `bg-card/*`。
  - hover 使用 `bg-accent/*`。
  - 不把 `bg-muted` 用作大面积页面底色。
- Border / Shadow：
  - 主工作区可以 `border shadow-sm`。
  - hover 默认不加 shadow。
  - selected card 可以 `border-ring shadow-sm`。
- Spacing：
  - 页面级 spacing 只在 Template 定义。
  - Molecule 内部必须写具体 `gap` / `padding`。
  - 状态变化不得改变 spacing。

## Review 检查顺序

1. Layout：确认顶层布局只有一套主结构，主工作区权重清楚。
2. Surface：检查背景、Card、border、shadow 是否形成稳定层级。
3. Alignment：检查左右 header、列表首项、详情内容起点是否对齐。
4. Text Density：删除低价值 description 和重复标签文案。
5. States：逐项检查 hover、selected、active、focus-visible 的一致性。
6. Card / Row：确认可点击区域没有嵌套 button，状态不改变布局。
7. Icon Meta：重复 meta 是否已经用 icon + count，0 值是否保持低权重。
8. Tokens：检查是否只使用 semantic token、组件 variant 和 spec 中列出的状态 token。
9. Accessibility：图标按钮和 icon meta 必须有可访问名称，键盘焦点可见。

## 提交前 Checklist

```
□ 页面大面积背景没有使用 bg-muted
□ 如果使用透明窗口，body/root/AppLayout 没有重新铺满实色背景
□ 如果使用透明窗口，红绿灯可见，顶部拖动区可拖动，交互控件不被 drag region 截获
□ 主工作区不是只靠分割线表达层级
□ 左右两侧 header 顶边或标题 baseline 对齐
□ Card hover 没有改变尺寸、位置或加重到超过 selected
□ selected card 的状态比 hover 更明确
□ dense list 的 active 没有 translate / scale
□ SectionHeader 没有默认塞 description
□ 列表卡片重复 meta 已改为 icon + count
□ 0 值 meta 没有写成长文本解释 chip
□ Tree / navigation row 优先是单个整行 button；如果有多个点击区，也没有嵌套 button
□ local-only 页面没有无意义 loading / error 状态
□ 业务校验条件没有被误写成交互状态
□ 全文没有硬编码颜色色阶
```
