# 样式一致性审计 · 逐条修改清单

> 配套报告：`frontend-design-consistency-audit.md`（同目录）
> 工作方式：逐条审阅 —— 用户说「改」→ 执行 → 展示 diff → 确认后 commit；「过」→ 标记跳过；「拍板」→ 对特批项表态
> 状态图例：☐ 待审 ｜ 🔄 执行中 ｜ ✅ 已改已确认 ｜ ⏸ 跳过/放弃 ｜ 🟦 等拍板 ｜ 🟨 审阅中有疑问

---

## 无争议改动（按序执行）

### ✅ #5 · P1 domain-tree-select.tsx（B 面升级，A 方案已拍板）✅ 已 commit 56bf48e

- [x] ~~ComboboxTrigger 删 8 个重复类~~ —— **误判撤销**：base-ui ComboboxTrigger 为无样式组件（非 InputGroup 包装，InputGroup 属 ComboboxInput 形态），className 全部必要，保留
- [x] **用户拍板 A**：只读 trigger 自绘 + Badge 自造 tag → `ComboboxChips/ComboboxChip/ComboboxChipsInput` 形态（可输入过滤 + ChipRemove 移除交互，组件库能力）✅ 已改，typecheck/lint/88 测试过
- [x] `domain-tree-select.tsx:56` ComboboxItem 删 `rounded-md`（base combobox.tsx:133 已有）✅ 已改
- [x] ComboboxList `p-0`：确认合理（覆盖 base p-1 适配缩进树），保留
- [x] ComboboxContent `min-w-64 p-1`：保留
- [x] `bg-secondary/60`（domain-tree-select）随重构消失；StorageSection:156 / tool-details:120 两处仍待拍板（见 #13）

### ✅ #6 · P2 Button 激活态改 variant 切换 ✅ 已改

- [x] 用户拍板：项目不需要 a11y → 去掉 aria-pressed 属性与 className 激活态覆盖、DESIGN 注释
- [x] knowledge-wander:145 持久激活 → variant="secondary"
- [x] understanding-list:123/135 切换激活 → variant={active ? "secondary" : "ghost"}
- [x] typecheck/lint 通过

### ✅ #7 · P3 AiSection 搜索框改用 InputGroup ✅ 已改 (commit 41f0ae7)

- [x] 自造 absolute Search + Input pl-9 → `InputGroup` + `InputGroupAddon(align="inline-start")` + `InputGroupInput`
- [x] 获得 focus-within 高亮、disabled 容器态、addon 规范间距；typecheck/lint 通过

### ✅ #8 · P1 contextual-agent-dock 删重复开合态 ✅ 已 commit 34afda7

- [x] 已验证：base-ui MenuRoot 设 `aria-expanded`、MenuTrigger state mapping 设 `data-popup-open`，同元素并存；ghost Button 内置 `aria-expanded:bg-muted` 态 → 删 `data-popup-open:bg-muted data-popup-open:text-foreground` ✅ 已改

### ✅ #9 · P4 布局魔法数收敛为标准档位 ✅ 已改 (commit 8323504c)

- [x] layout-constants.ts：`w-[248px]`→`w-62`、`pl-[86px]`→`pl-21.5`、`left-[86px]`→`left-21.5`（tailwind v4 动态间距等值）
- [x] tailwind 生成验证：新类已生成；grid-cols 保留（grid 轨道语境）

### ✅ #10 · P4 树缩进对齐魔法数 → 保留精确值 + DESIGN 注释 ✅ 已改

- [x] 共享常量方案取消（值互不相同、各单文件使用，无共享语义）
- [x] 取整档位方案**回滚**（实测 1px 偏差破坏竖线对齐）
- [x] 最终方案：还原 ml-[13px]/ml-[7px]/pl-[17px]，补 DESIGN 注释说明对齐依据（trigger 首图标 size-4 中线/右缘对齐）

---

## 需用户裁决

### ☐ #11 · P5 pressable 双按压反馈

- [ ] `chat-composer.tsx:385/1035/1037/1082/1084`：pressable（scale 0.96）叠加 Button 内置按压（active:translate-y-px + transition-all）
- 裁决：□ 删除 pressable ｜ □ 保留并补 DESIGN 注释（「位移+缩放」双重反馈为刻意）

### ☐ #12 · P5 context-picker 补 DESIGN 注释

- [ ] `context-picker.tsx:115/132`：中和 CommandItem data-selected 态、自绘滑动高亮 → 补 DESIGN 注释（当前无理由记录）

### 🟦 #13 · P6 特批保留项清单（逐项拍板，不改代码）

1. ✅ `bg-secondary/60`（StorageSection:156、tool-details:120）—— **已收敛 variant="secondary"**（domain-tree-select 处随 A 重构消失）
2. ✅ `bg-primary/10` 选中态（understanding-row:51）—— **已换 bg-muted 选中约定**（与 domain-tree 一致），DESIGN 注释同步更新
3. ✅ 运行中计数徽标（chat-thread-sidebar:161）—— **用户拍板删除**：count 链路全删（runningCount prop + 徽标 JSX + renderer 计算），运行中标记（列表行 running）保留
4. ✅ `bg-sidebar/50`（chat/index.tsx:253）—— **保留**（已有 DESIGN 注释：macOS vibrancy 窗口级毛玻璃效果，非 surface 色）
5. ✅ Alert 行内 action（agent-execution-block）—— **已用组件样式**：去掉 grid-cols/pr/static 覆盖，恢复 AlertAction 右上角浮动默认布局
6. ✅ Badge 计数徽标（agent-activity-group:54）—— 用户拍板**先留着**（保留）
7. ✅ Button text-muted-foreground 图标钮 ×6（agent-thread-panel ×3、AiSection ×1、composer ×2）—— **用户拍板不需要灰色**：删除全部灰色覆盖，恢复 ghost 默认 foreground 色
8. ✅ 悬浮 FAB（agent-thread-panel:239）—— 特批保留（组件库无 FAB 形态）
9. ✅ 可选卡片行（understanding-row:51、UnderstandingDetail:124）—— 特批保留（多行卡片+选中态，Item/Button 无法承载）
10. ✅ context-inspector:29 全屏专注模式 —— 特批保留（无遮罩非抽屉语义）
11. ✅ Item 换用 —— **已换 3 处**（TrashSection ×2、StorageSection ×1 → Item outline + ItemContent/ItemActions）；agent-proposal-card（无边框 hover 行非 Item 形态）与 chat-thread-sidebar（已用 Button+variant 标准写法）不换
12. ✅ 功能性任意值清单（§1.5 共 14 处）—— 整体确认保留（视口/容器相对尺寸、动画属性、grid 轨道、选择器均无标准类可替代）

---

## 可选后续（结构层）

### ☐ #14 · P7 结构层抽取

- [ ] 抽 `PanelHeader`（capture/index:141、knowledge-wander:116、agent-thread-panel:522）
- [ ] 侧栏头组合（understanding-list:99-107、knowledge-wander:131-139）
- [ ] UnderstandingDetail 滚动容器常量（:184/524）
- [ ] unstyled Input ×3 共享组合（UnderstandingDetail:615、agent-thread-panel:399/537）
- [ ] ComboboxContent `p-1`（domain-tree-select:156）确认收敛

---

## 不进修改（附录记录）

- F1 `--reflecta-chat-muted-foreground` 定义位置（_surface.scss，违反单一文件原则）
- F2 destructive/danger 同值双家族混用（message-list:169）
- F3 组件库 variant 缺口（muted 图标钮 / bare input / soft-primary badge / 行内 alert action / Item 交互态）
- F4 focus ring 档位不统一（ring-1/2/3）
- F5 `AppChromeMenu.tsx:17` `sm:max-w-none` 冗余

---

## 复查补漏（Step 4 复查发现）

- ✅ AiSection:299 Codex 授权状态行 → `Item variant="outline"`（漏出 #13-11 清单，方向已拍板，已补换）
- ✅ agent-working-indicator `gap-[1.5px]`/`rounded-[1px]` —— 用户拍板保留，已补 DESIGN 注释（4px 格子 3 点精确分配 + 1px 圆角补偿）
- ✅ chat-composer:174 `inset-[3px]` —— 用户确认无现成替代组件（Progress 仅线性），保留 + DESIGN 注释（环宽 16/2-3=5px，取整细 1px）
