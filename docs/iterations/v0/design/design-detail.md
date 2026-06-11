# Domain Workspace 设计规范

这是 Domain Workspace demo 的页面级设计规范，不生成 class。Human review
应该先看这份文档，再判断间距、颜色和组件是否合适。实现时再把这里的意图翻译到
`index.tsx` 和 `styles.ts`。

## 意图

Domain Workspace 是一个以文档为中心的安静工作区，用来形成、回看和修正个人理解。

它应该像：

- 一张写作桌，旁边有可导航的理解索引。
- 一个文档表面，由领域导航和来源追溯支撑。
- 一个克制、精确、面向工作的工具。

它不应该像：

- dashboard。
- 卡片浏览器。
- marketing page。
- 一组漂浮面板拼起来的界面。

## 原则

- **焦点顺序：** 文档内容 -> 当前理解指针 -> 来源追溯 -> 领域方位 -> 次要控件。
- **层级来源：** 层级主要由排版、间距和对齐建立，界面 chrome 保持安静，只承担结构作用。
- **Surface 语义：** surface 用来组织局部内容，不表示「浮起来」。shadow/ring 只表示临时 overlay，不表示普通选中。
- **密度：** 左栏和中栏可以紧凑；文档区应该有呼吸感，但不能空。
- **气质：** 冷静、精确、工作导向。避免泡泡感、装饰性卡片、hero 大标题和过度兴奋的选中态。

## 轻重档位

| 档位      | 用途                         | 可以使用                                      | 避免使用                                 |
| --------- | ---------------------------- | --------------------------------------------- | ---------------------------------------- |
| `ground`  | 方位和背景上下文             | muted text、透明背景、结构性间距              | shadow、ring、raised surface、强边框     |
| `tool`    | 控件、元信息、索引、辅助操作 | 轻微 tint、细边框、紧凑密度、hover affordance | 和文档竞争、大字号、显眼容器             |
| `surface` | 安静的局部组织或可查看证据   | 低对比背景、轻分割、小圆角                    | lift、卡片阴影、选中 ring、大圆角矩形    |
| `stage`   | 相邻区域共享的布局场         | 共享背景、栏间线、滚动边界                    | 独立面板底色、嵌套卡片                   |
| `focus`   | 当前正在阅读或编辑的文档内容 | 更强排版、舒适行高、编辑焦点                  | 可见输入框 chrome、hero scale、外包 Card |

## 状态语义

- **Idle：** 默认安静。大多数元素在不被使用时应该融入工作区。
- **Hover：** 用轻微底色、更清晰文字或更清晰边框提示可交互，不做 lift。
- **Selected：** 表示当前位置或当前文档指针。使用弱背景、左侧 accent 或标题对比增强；不用 shadow/ring。
- **Focus：** 主要属于文档编辑器。focus 不应该把文字区域变成表单盒子。
- **Overlay：** 临时查看状态。只有 overlay surface 可以有 shadow 或更强边界。

## 布局

页面横向分为三个区域：

1. `navigation`：领域方位。
2. `index`：紧凑的理解索引。
3. `document`：主要阅读和写作表面。

navigation、index、document 共享同一个 workspace。index 服务 document，不是第二个主面板。

## 区域

### Navigation

角色：领域方位。  
档位：`ground`。

导航栏是安静的 rail，由紧凑 row 组成。选中态表示用户当前处在领域地图的哪里。

规则：

- 不做卡片化处理。
- 不使用 shadow 或 ring。
- icon 和 label 默认 muted，选中时稍微清晰。
- 保持可读，但不能和文档区竞争。

### Index

角色：理解索引。  
档位：`stage` 内的 `tool`。

Index 是当前领域下的文档指针列表。它应该像索引一样快速扫描，而不是像卡片墙一样浏览。

规则：

- Row 可以使用轻微 tint、小圆角、紧凑 padding 和低对比边框。
- Row 不投影。
- 选中 row 表示当前文档指针，不应该像被提升的卡片。
- Index 和 document 之间可以有结构性栏间线。

子结构：

- `indexToolbar`：breadcrumb、search、create action 都保持次要。
- `createUnderstandingRow`：安静的 inline create action，比已有理解 row 更轻。
- `understandingRow`：当前文档指针，包含标题、摘要和更新时间。

### Document

角色：主要阅读和写作表面。  
档位：`stage` 内的 `focus`。

Document 是居中的隐形 frame。用户注意力应该落在内容上，而不是容器上。

规则：

- 不出现可见 document card。
- 内容起点要足够靠上，避免顶部空白过大。
- 使用文档级标题，不使用 hero 级标题。
- Input 和 textarea 应该像可编辑文本，不像表单字段。

子结构：

- `documentIdentity`：小号元信息 + 清晰但克制的文档标题。
- `documentBody`：可读、可编辑的正文。
- `evidence`：正文下方的来源追溯，视觉上从属于正文。
- `provenanceRow`：无 surface 的 whisper 汇总行。

### Overlay

角色：临时来源阅读器。  
档位：`surface overlay`。

Overlay 是唯一允许使用 shadow 的地方。打开 overlay 不应该改变底层 document hierarchy；关闭后视觉焦点回到文档标题和正文。

## Organism Recipes

Review 时按可见 organism 整体判断，不要先拆成孤立的 type/color/shadow token。

### `navigationRail`

组成：rail background、category row、nested category row、icon、label。

- Surface：接近 background 的 rail，只保留一条结构性右边线。
- Radius：只在 hover/selected row 上使用小圆角。
- Border：row 本身不画边框；只保留 rail divider。
- Shadow：none。
- Typography：紧凑 label，默认 muted。
- Idle：透明 row，muted icon 和 label。
- Hover：轻微 row tint。
- Selected：location row tint 或 pill；label 对比度稍微提高。
- 避免：卡片化 nav item、selected shadow、强色块 active state。

### `indexToolbar`

组成：breadcrumb、create action、search field。

- Surface：没有外包面板的 tool strip。
- Radius：search 可以使用小圆角。
- Border：search 可以使用低对比边框。
- Shadow：none。
- Typography：breadcrumb 和 controls 保持次要。
- Search focus：只做轻微 focus，不要让 search 成为主视觉对象。
- Create hover：表现为 inline tool affordance，不做 primary CTA。
- 避免：厚重 toolbar chrome、primary color create button、强 input ring。

### `createUnderstandingRow`

组成：单行 action label。

- Surface：安静的 row surface，比 understanding row 更轻。
- Radius：小 row radius。
- Border：可选低对比边框，也可以没有。
- Shadow：none。
- Typography：紧凑 medium label。
- Idle：像内联动作一样收敛。
- Hover：轻微 tint，label 更清晰。
- 避免：漂浮 compose card、CTA button treatment。

### `understandingRow`

组成：title、excerpt、updated date。

- Surface：有边界感的 row surface，不是 floating card。
- Radius：小到中小圆角。
- Border：允许低对比边框；selected 时边框可以略微 sharpen。
- Shadow：idle、hover、selected 都是 none。
- Typography：紧凑 title、muted excerpt、小号 tabular date。
- Idle：低对比边框 + 安静背景，足够让用户读出这是一个 row。
- Hover：边框或背景略微 sharpen，不 lift。
- Selected：弱视觉效果；border/background/title 稍微增强；无 ring，无 shadow。
- 避免：raised card stack、大圆角卡片、selected glow、primary-color selected fill。

### `documentFrame`

组成：date、title、body、evidence area。

- Surface：隐形 frame；文档内容直接放在 workspace 上。
- Radius：none。
- Border：无外边框。
- Shadow：none。
- Typography：由 document title 和 body 建立主层级。
- Spacing：内容起点足够靠上；宽度受控；section gap 适中。
- 避免：document card、hero-like title、巨大顶部空白。

### `documentIdentity`

组成：updated date、document title、quiet divider。

- Surface：无填充表面。
- Radius：none。
- Border：可选低对比 bottom divider。
- Shadow：none。
- Typography：小号 whisper date + 克制的 document heading。
- Editor focus：只用文字 caret 和 selection 表达；不出现 input box chrome。
- 避免：表单字段边框、hero heading scale、badge-heavy metadata。

### `documentBody`

组成：editable prose。

- Surface：透明文本表面。
- Radius：none。
- Border：none。
- Shadow：none。
- Typography：主要正文，行高适合中文阅读和编辑。
- Editor focus：由 caret 和文本 selection 表达。
- 避免：textarea box、dense form feel、视觉重量低于 source cards。

### `sourceTrace`

组成：source type、source title、word count、excerpt。

- Surface：附着在文档下方的次级 evidence surface。
- Radius：小圆角，或只用 divider。
- Border：允许低对比边框或 divider。
- Shadow：none。
- Typography：比 document body 更轻；title 可以 medium，excerpt muted。
- Idle：读起来像 evidence，不像第二个 document。
- Hover：border/text 稍微 sharpen，提示可以查看。
- 避免：和 understanding row 同等重量、floating citation card、shadow。

### `provenanceRow`

组成：source count、first source path、linked understanding count。

- Surface：none。
- Radius：none。
- Border：none。
- Shadow：none。
- Typography：whisper row。
- 避免：badge cluster、card treatment、高对比 summary。

### `sourceDetailOverlay`

组成：sheet、source metadata、source title、source body。

- Surface：位于 document 上方的临时 overlay surface。
- Radius：沿用系统 sheet/dialog radius。
- Border：允许 overlay boundary。
- Shadow：允许，因为它在空间上高于 workspace。
- Typography：overlay 内部仍保持 reader/editor hierarchy。
- Open：可以比普通 surface 更强。
- Close：视觉焦点回到 document title/body。
- 避免：改变底层 document hierarchy、让普通 row 也使用 overlay shadow。

### `sourceEditSurface`

组成：source type picker、source title input、source content input。

- Surface：位于 document body 下方的安静 supporting surface。
- Radius：小到中小圆角。
- Border：允许低对比边框。
- Shadow：none。
- Typography：form controls 从属于 document body。
- Field focus：轻微 form focus，避免强 ring。
- 避免：显眼 card、primary form panel、shadow。

## 跨 organism 规则

- **Shadow：** 只有 overlay 使用 shadow。普通 selected/hover state 永不使用 shadow。
- **Border：** border 可以用于定义 organism 边界，例如 `understandingRow`；避免在内部子元素上制造边框噪音。
- **Selected：** selected 表示当前指针或当前位置。它应该可见但弱，不要做成兴奋态。
- **Hover：** hover 通过 border/background/text 变清晰来表达 affordance，不做位移。
- **Typography：** document typography 是主层级。index 和 source organisms 保持紧凑、从属。
