# Capture 用户操作路径测试清单

> 目的：React / shadcn/ui 迁移后，用用户真实操作路径逐条验证 Capture 页面，而不是按组件散点测试。
>
> 使用方式：每条路径按编号执行，记录 `通过 / 失败 / 阻塞`。失败项写清楚复现步骤、实际表现、预期表现和关联代码位置。
>
> 范围：只覆盖 Capture 页面及其直接打开的共享弹窗 / 抽屉 / 下拉菜单。跨模块跳转只验证入口是否可达，不展开测试 Contemplate / Agent。

## 测试环境

| 项 | 内容 |
| --- | --- |
| 页面 | `/#/capture` |
| 执行方式 | Electron dev app + Computer Use |
| 数据要求 | 至少存在多个 Category、多个 Thought、至少一条带 Context 的 Thought |
| 基础检查 | 页面无白屏，控制台无 React runtime error，`typecheck:web` 通过 |

## 状态标记

| 标记 | 含义 |
| --- | --- |
| `TODO` | 尚未执行 |
| `PASS` | 操作结果符合预期 |
| `FAIL` | 可复现 bug，需要修 |
| `BLOCKED` | 当前数据或前置 bug 导致无法继续 |

## C0. 页面基础可用性

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C0.1 | 打开 Capture 页面 | 左侧分类树、顶部导航、右侧 Thought 列表正常渲染 | PASS | Electron dev app `localhost:5173/#/capture` 可正常渲染 |
| C0.2 | 点击顶部 `Capture / Contemplate / Agent` 后回到 Capture | 导航高亮正确，返回 Capture 后不白屏 | PASS | 已从 Capture 切到 Connect，再返回 Capture |
| C0.3 | 打开页面后观察控制台 | 无 React DOM nesting warning、无 uncaught error | PASS | 当前 dev console 未再出现 Dropdown.Trigger 嵌套 button 警告 |
| C0.4 | 调整窗口大小到较窄宽度 | 主列表和左侧栏不重叠，关键按钮仍可点击 | PASS | 窄宽窗口下左栏、详情正文和右侧 Context 面板不重叠，关键按钮仍可点击；测试后已恢复窗口宽度 |

## C1. Category 导航与管理

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C1.1 | 点击 `全部` | 右侧显示全部 Thought，标题和数量更新 | PASS | 标题切到 `全部笔记`，数量显示 30 thoughts |
| C1.2 | 点击一个一级 Category | 该 Category 高亮，右侧列表切换到对应内容 | PASS | 点击 `交易` 后标题和列表切换正常 |
| C1.3 | 展开 / 折叠有子节点的 Category | 子节点显示 / 收起，选中态不丢失 | PASS | `交易` 可折叠 / 展开，当前列表不白屏 |
| C1.4 | 点击子 Category | 子 Category 高亮，右侧标题显示对应分类语境 | PASS | 点击 `心智认知` 后标题和数量切换正常 |
| C1.5 | 点击左侧 `+` 新建分类 | 新建分类弹窗居中出现，背景遮罩正确 | PASS | 弹窗居中，Backdrop 正常 |
| C1.6 | 在新建分类弹窗输入名称并取消 | 弹窗关闭，不新增分类 | PASS | 输入 `RTK Cancel Test` 后取消，分类树未新增该节点 |
| C1.7 | 在新建分类弹窗打开父分类选择 | 下拉列表位置正确，可选择父分类，可关闭 | PASS | 父分类下拉选项位置正常，可用 Esc 关闭 |
| C1.8 | 新建一个临时分类并保存 | 分类树出现新节点，右侧不白屏 | PASS | 创建 `RTK Temp Category` / `RTK Delete Regression` 均成功，右侧空态正常；测试分类已删除清理 |
| C1.9 | 删除当前选中的临时分类 | 删除确认居中，删除后分类树和右侧列表回到有效状态 | PASS | 先复现删除后标题为空；修复后删除 `RTK Delete Regression` 自动回到 `全部笔记` |

## C2. Thought 列表浏览、搜索和筛选

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C2.1 | 在 `全部` 下滚动列表 | 列表滚动流畅，卡片布局不跳动 | PASS | 向下滚动一屏后卡片间距稳定，左侧栏不受影响 |
| C2.2 | 点击一张 Thought 卡片 | 进入详情态，左侧分类保留，详情内容正确 | PASS | 打开 `工作流拆分：细粒度便于后续自由组合`，标题、正文、右侧 tab 正常 |
| C2.3 | 从详情点击关闭 | 回到列表态，保留原分类和筛选上下文 | PASS | 关闭详情后回到 `全部笔记` 列表 |
| C2.4 | 在搜索框输入已有关键词 | 列表按关键词过滤，搜索框值保留 | PASS | 搜索 `FVG` 后列表显示 1 thoughts，搜索框保留输入值 |
| C2.5 | 清空搜索框 | 列表恢复，未选错分类 | PASS | 清空后恢复 30 thoughts，仍在 `全部` |
| C2.6 | 点击 `Idea` 筛选 | 只显示 Idea 类型，筛选按钮高亮正确 | PASS | `Idea` 高亮，列表变为 27 thoughts |
| C2.7 | 点击 `Insight` 筛选 | 只显示 Insight 类型，筛选按钮高亮正确 | PASS | `Insight` 高亮，列表变为 3 thoughts |
| C2.8 | 切回 `全部` 筛选 | 类型过滤清除，列表恢复 | PASS | 类型过滤清除，列表恢复 30 thoughts |
| C2.9 | 点击 `无标签` | 无标签过滤状态正确，列表或空态正常 | PASS | `无标签` 高亮后显示 0 thoughts 空态，切回后恢复列表 |
| C2.10 | 点击排序按钮 | 排序切换后列表顺序变化或状态文案变化，无报错 | PASS | 按钮文案从 `按创建时间` 切到 `按修改时间`，首条内容变化 |

## C3. 新建 Thought

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C3.1 | 点击 `新建 Thought` | 下拉菜单出现在按钮附近，无 DOM nesting warning | PASS | 菜单在按钮附近，`Idea` / `Insight` 选项可见 |
| C3.2 | 选择 `Idea` | 创建 Idea 并进入详情态，类型显示为 Idea | PASS | 创建 `RTK Test Idea Thought` 后进入详情，类型显示 Idea |
| C3.3 | 返回列表 | 新 Thought 出现在当前分类语境内 | PASS | 关闭详情后列表顶部出现测试 Idea，列表数量从 30 增至 31 |
| C3.4 | 点击 `新建 Thought` 后选择 `Insight` | 创建 Insight 并进入详情态，类型显示为 Insight | PASS | 创建 `RTK Test Insight Thought` 后进入详情，类型显示 Insight |
| C3.5 | 新建后直接输入标题和正文 | 输入无卡顿，内容自动保存或按既有逻辑保存 | PASS | 标题与 Markdown 正文输入正常，返回列表后摘要同步 |
| C3.6 | 新建空 Thought 后关闭详情 | 不产生异常空白详情；列表状态符合既有产品规则 | PASS | 空 Idea 关闭后列表显示 `未命名 Thought` 与空正文提示，无异常 |

## C4. Thought 详情编辑

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C4.1 | 打开已有 Thought | 标题、类型、分类、正文、Context 数量正确显示 | PASS | 打开测试 Thought，详情字段和 Context / Connections 数量正常显示 |
| C4.2 | 修改标题 | 标题输入正常，离开后列表标题同步或按保存策略更新 | PASS | 标题修改为 `RTK Test Idea Thought Updated` 后保留；后续 AI 又生成新标题 |
| C4.3 | 修改正文 | Markdown 编辑器可输入，内容不丢失 | PASS | 正文追加 `RTK appended edit line` 后界面和 accessibility value 均保留 |
| C4.4 | 点击类型 badge / 类型下拉 | 下拉位置正确，可切换 Idea / Insight | PASS | 类型下拉贴近 badge；Idea -> Insight -> Idea 切换成功 |
| C4.5 | 打开分类选择 | 选择器位置正确，可添加 / 移除分类 | PASS | 分类选择器在按钮下方展开；添加并移除 `心智认知` 成功 |
| C4.6 | 点击 AI 生成摘要标题 | loading 状态可见，失败时不破坏当前内容 | PASS | 按钮进入 loading/disabled；AI 返回后标题变为 `RTK清单编辑：主体与追加行结构`，正文未丢失 |
| C4.7 | 点击专注模式 | 详情布局进入专注态，再次点击恢复 | PASS | 专注态隐藏顶部/左侧导航，退出后布局恢复 |
| C4.8 | 点击更多操作 | 菜单位置正确，菜单项可点击 | PASS | 更多菜单在按钮附近展开，`删除 Thought` 可见 |
| C4.9 | 点击删除 Thought 后取消 | 删除确认弹窗居中，取消后 Thought 仍存在 | PASS | 删除确认弹窗居中，点击取消后仍停留在当前 Thought |

## C5. Context 列表与抽屉

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C5.1 | 打开一条带 Context 的 Thought | 右侧 Context tab 显示数量，Context 卡片正常 | PASS | 测试 Thought 新增 Context 后显示 `Context 1` 和卡片 |
| C5.2 | 点击 Context 卡片展开 / 收起 | 内容原地展开 / 收起，布局不遮挡正文 | PASS | 点击展开按钮后显示完整内容，再次点击收起 |
| C5.3 | 点击 Context 卡片操作菜单 | 菜单位置正确，编辑 / 删除项可见 | PASS | 菜单在卡片右侧附近展开，`编辑` / `删除` 可见 |
| C5.4 | 点击编辑 Context | 抽屉从预期位置打开，遮罩正确，表单带入原值 | PASS | 编辑抽屉从右侧打开，内容带入 |
| C5.5 | 编辑 Context 后取消 | 抽屉关闭，原 Context 未变化 | PASS | 将内容改为取消专用文本后取消，卡片仍显示原内容 |
| C5.6 | 点击新增 Context | 抽屉从预期位置打开，表单为空或有默认来源类型 | PASS | 回归通过：新增 Context 抽屉从右侧打开，表单为空 |
| C5.7 | 新增 Context 后保存 | 抽屉关闭，Context 列表新增一条，数量更新 | PASS | 新增 `RTK Context Source`，显式选择来源类型后保存，数量更新为 1 |
| C5.8 | 删除 Context 后取消 | 删除确认居中，取消后 Context 仍存在 | PASS | 删除确认弹窗居中，取消后 Context 仍存在 |

## C6. Connections / 双向链接

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C6.1 | 点击 `Connections` tab | 列表切换到连接视图，数量正确 | PASS | 在测试 Thought 上切换到 Connections 空态正常；在真实连接 Thought 上显示 `Connections 2` |
| C6.2 | 打开有连接的 Thought | 连接卡片正常显示，不遮挡详情正文 | PASS | `交易本质：edge假设—执行—监控直至失效` 显示引用/被引用卡片 |
| C6.3 | 点击连接卡片 | 可跳转到关联 Thought 或按既有设计响应 | PASS | 点击引用卡片跳转到 `From Quantity To Quality` |
| C6.4 | 从连接跳转后返回 | 能回到合理的上一个详情或列表上下文 | PASS | 在反向连接卡片点击后回到 `交易本质：edge假设—执行—监控直至失效` |

## C7. 全局入口与共享 Overlay 回归

| ID | 操作路径 | 预期结果 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| C7.1 | 点击顶部搜索 | 全局搜索弹窗 / 面板位置正确，可关闭 | PASS | 搜索弹窗居中，输入框聚焦，Esc 可关闭 |
| C7.2 | 点击设置 | 设置弹窗位置正确，可关闭 | PASS | 设置弹窗居中，Storage / AI / Trash tabs 可见，Esc 可关闭 |
| C7.3 | 打开任意 Modal 后按 `Esc` | 弹窗关闭，页面焦点回到合理位置 | PASS | 搜索和设置 Modal 均可用 Esc 关闭 |
| C7.4 | 打开任意 Dropdown 后按 `Esc` | 菜单关闭，无控制台错误 | PASS | 类型 Dropdown 原本正常；分类选择器先复现 Esc 不关闭，修复后回归通过；控制台未新增 nesting / PressResponder warning |
| C7.5 | 打开任意 Drawer 后按 `Esc` | 抽屉关闭，无残留遮罩 | PASS | 新增 Context Drawer 可用 Esc 关闭，无残留遮罩 |

### BUG-CAPTURE-001 Context 抽屉从左侧打开

- 路径编号：C5.6
- 状态：已修复并回归通过
- 复现步骤：打开一条 Thought 详情，点击右侧 Context 区域的 `新增`
- 预期结果：新增 Context 抽屉从右侧打开，遮罩覆盖页面，表单面板贴近右侧
- 实际结果：抽屉面板显示在左侧，和右侧 Context 面板的操作语境不一致
- 控制台信息：无 runtime error
- 关联代码：`apps/electron/src/renderer/src/modules/shared/hooks/use-drawer.tsx`
- 修复记录：shadcn/ui `SheetContent` 使用 fixed 侧边定位，`widthClassName` 不能加在这一层；已移动到 `Drawer.Dialog`
- 回归结果：点击测试 Thought 右侧新增 Context 后，抽屉从右侧打开，遮罩正常，表单位置正确

### BUG-CAPTURE-002 共享 Modal / Drawer 尺寸类加错层级

- 路径编号：C1.5, C4.9, C5.6, C7.1-C7.5
- 状态：已修复并回归通过
- 复现步骤：打开 Capture 内任意 Modal / Drawer
- 预期结果：Backdrop / Container 负责定位，Dialog 面板负责宽度、padding 和内容样式
- 实际结果：迁移时把 `widthClassName` 加到了定位 wrapper，Drawer 直接导致右侧抽屉错位；Modal 当前可见但尺寸类语义不正确
- 控制台信息：无 runtime error
- 关联代码：`apps/electron/src/renderer/src/modules/shared/hooks/use-modal.tsx`, `apps/electron/src/renderer/src/modules/shared/hooks/use-drawer.tsx`
- 修复记录：已将 `widthClassName` / `className` 移到 `Modal.Dialog` 和 `Drawer.Dialog`
- 回归结果：新建/删除分类 Modal、删除 Thought Modal、删除 Context Modal 均居中；新增/编辑 Context Drawer 均从右侧打开

### BUG-CAPTURE-003 删除当前选中分类后保留失效选中态

- 路径编号：C1.9
- 状态：已修复并回归通过
- 复现步骤：创建临时分类，点击该分类进入空列表，再通过分类操作菜单删除该分类
- 预期结果：删除成功后分类树选中态回到 `全部`，右侧标题显示 `全部笔记` 并恢复列表
- 实际结果：删除后临时分类从树中消失，但 Capture 仍保留已删除的 `selectedCategoryId`，右侧标题为空且显示 0 thoughts 空态
- 控制台信息：无 runtime error
- 关联代码：`apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`
- 修复记录：删除选中分类或其子分类成功后，将 `selectedCategoryId` 回退到 `all`，并清空 `selectedThoughtId`
- 回归结果：删除 `RTK Delete Regression` 后左侧选中 `全部`，右侧恢复 `全部笔记` 和 30 thoughts

### BUG-CAPTURE-004 分类选择器 Esc 不关闭

- 路径编号：C7.4
- 状态：已修复并回归通过
- 复现步骤：打开 Thought 详情，点击分类选择器展开 Category 列表，按 `Esc`
- 预期结果：Category 列表关闭，焦点回到触发按钮或页面内合理位置
- 实际结果：列表仍然显示，只是焦点回到触发按钮
- 控制台信息：无 runtime error
- 关联代码：`apps/electron/src/renderer/src/modules/shared/biz-components/CategoryTreeSelect.tsx`
- 修复记录：在打开态注册 `keydown` 监听，捕获 `Escape` 后关闭自定义选择器，并在卸载/关闭时移除监听
- 回归结果：再次打开详情分类选择器后按 `Esc`，列表关闭；类型 Dropdown 也可正常用 `Esc` 关闭

## Bug 记录模板

```md
### BUG-CAPTURE-001 标题

- 路径编号：
- 状态：
- 复现步骤：
- 预期结果：
- 实际结果：
- 控制台信息：
- 关联代码：
- 修复记录：
- 回归结果：
```
