# Feature Set Guide

> 职责：说明如何从 Value Proposition 推导 Feature Set。本文关注产品推理逻辑，不直接写 UI spec，也不承担实现方案。

## 核心定义

Feature Set 不是功能清单。

Feature Set 是：

> 在不改变 Value Proposition 的前提下，选择一种合适的产品承载方式，并定义验证这套承载方式所需的最小功能集合。

Value Proposition 不绑定产品形态。它定义的是：

- 用户的问题是什么。
- 产品承诺创造什么价值。
- 这件事为什么值得做。
- 哪些方向不能走偏。

Feature Set 要做的是把这个价值主张继续往下推导：

```text
Value Proposition
  -> JTBD
  -> Product Requirements
  -> User Mental Model
  -> Product Shape Options
  -> Shape Selection
  -> Selected Product Shape
  -> Minimum Feature Set
  -> Support / Later / Not Now
  -> Validation
```

这条链路的关键是：不要从 Value Proposition 直接跳到功能，也不要一开始就选定产品形态。

## 1. Value Proposition

先确认输入是什么。

这一步只引用或总结上游 Value Proposition，不重新发明产品形态。

需要回答：

- 我们承诺为用户创造什么价值？
- 这个价值解决了用户什么痛点？
- 这个价值有哪些不可违背的原则？
- 哪些方向会让产品走偏？

输出应该像：

```text
Graph 帮用户看见个人理解正在形成怎样的认知结构。

它不是数量统计，不是 AI 自动关系网，也不是只展示连接的点线图。
它必须让用户看到理解、来源、显式关系、孤岛和边界。
```

## 2. JTBD

JTBD 解释用户为什么会在某个场景下需要这个能力。

它不是功能，也不是产品形态。

推荐格式：

```text
当我 [处在某个场景 / 遇到某个障碍]，
我想要 [完成某个进展]，
以便 [获得某个结果]。
```

例子：

```text
当我已经在多个领域沉淀了一批理解，
但回看时觉得它们像散乱条目，
我想知道哪些理解已经连起来、哪些仍然孤立、哪些缺少来源、哪些跨到了其他领域，
以便决定下一步补来源、补连接，还是沉淀更高层理解。
```

JTBD 的作用是把价值主张落到真实用户进展里。没有 JTBD，后面的 Product Requirements 容易变成团队主观想象。

## 3. Product Requirements

Product Requirements 是从 JTBD 推导出来的产品承载要求。

这一步仍然不选产品形态，只说明产品必须能承载什么。

需要回答：

- 为了让用户完成 JTBD，产品必须呈现什么？
- 用户必须能判断什么？
- 用户必须能采取什么下一步动作？
- 哪些信息不能被隐藏？
- 哪些复杂度必须被控制？

例子：

```text
产品必须承载：
- 呈现 Understanding。
- 呈现用户显式建立的 Connection。
- 呈现哪些 Understanding 缺少 Context。
- 呈现哪些 Understanding 暂时独立。
- 允许用户从观察回到原 Understanding。
- 避免全局复杂度压垮用户。
```

Product Requirements 是能力要求，不是 feature。

例如“呈现缺少 Context 的 Understanding”是 requirement；“节点用空心样式表示无来源”才是某种 shape 下的 feature / shape rule。

## 4. User Mental Model

User Mental Model 说明可以借力的用户已有认知。

这一步回答：

- 用户熟悉哪些概念？
- 用户用过或理解哪些相近产品？
- 用户看到什么对象和动作时，会自然知道怎么用？
- 哪些表达方式能降低解释成本？

例子：

```text
Graph 可以借力的用户心智：
- 用户熟悉笔记。
- 用户熟悉双链 / backlink。
- 用户熟悉 graph 里的节点和边。
- 用户理解点击节点查看详情。
- 用户理解用筛选缩小范围。
- 用户可能熟悉 Obsidian / Roam / Logseq 的局部图谱体验。
```

这一步的目的不是做用户画像，而是为后面的产品形态选型提供约束。

如果一个形态需要用户学习太多新概念，它就不适合 PMF 阶段的 Feature Set。

## 5. Product Shape Options

到这里才进入产品形态候选。

Product Shape 是承载 Product Requirements 的整体产品形态，不是具体功能。

需要列出 2 到 5 个可行候选，并说明它们如何承载价值。

例子：

| Shape Option    | 如何承载价值                                   | 主要风险                                 |
| --------------- | ---------------------------------------------- | ---------------------------------------- |
| 单画布笔记图谱  | 用节点和边直接展示 Understanding 与 Connection | 全局节点过多时可能变乱                   |
| 多栏 Topic Map  | 用领域、主题、笔记分层表达结构                 | 主对象过多，新用户第一眼复杂             |
| Dashboard       | 用统计和状态概览表达积累情况                   | 容易走向数量指标                         |
| 对话式回看      | 通过 AI 问答帮助用户发现关系                   | 结构感不够直接，也容易让 AI 代替用户判断 |
| 列表 + 局部关系 | 延续列表心智，局部展示关系                     | 图谱价值感可能不明显                     |

这一步不要急着选。先把可选形态放到同一张桌子上，避免默认采用最显眼的 solution。

## 6. Shape Selection

Shape Selection 说明为什么选择某个产品形态。

选择标准应来自前面的三件事：

- 是否承载 Product Requirements。
- 是否符合 User Mental Model。
- 是否足够小，可以验证 Value Proposition。

推荐判断维度：

| 维度       | 问题                                             |
| ---------- | ------------------------------------------------ |
| 价值承载   | 它是否直接承载 Value Proposition 的核心感受？    |
| 心智成本   | 用户是否能用已有概念理解它？                     |
| 主对象数量 | 第一屏需要用户同时理解几个主对象？               |
| 行动闭环   | 用户能否从观察进入下一步整理动作？               |
| 走偏风险   | 它是否容易滑向数量统计、管理后台或 AI 代替判断？ |
| 实现复杂度 | 它是否足够小，适合当前阶段验证？                 |

输出应该是一个明确选择：

```text
第一版选择单画布笔记图谱。

原因：
- 它最直接呈现 Understanding 与 Connection。
- 用户熟悉节点和边的图谱心智。
- Source / Context 可以作为节点状态和点击详情承载。
- 孤岛可以自然表现为未连接节点。
- 跨领域关系可以表现为跨 cluster 的边。
- 相比多栏 Topic Map，它的第一屏主对象更少。
- 相比 Dashboard，它不把价值导向数量统计。
```

## 7. Selected Product Shape

选定形态后，才具体定义它长什么样。

这一节要非常具体，因为它会约束 Feature Set。

需要回答：

- 第一屏是什么？
- 主对象是什么？
- 次级对象如何出现？
- 用户的核心动作是什么？
- 这个形态有哪些呈现规则？

例子：

```text
Selected Shape: 单画布笔记图谱

第一屏：
- 一张图谱画布。
- Understanding 节点。
- Connection 边。
- 顶部轻筛选。
- 轻量图例。

主对象：
- Node = Understanding。
- Edge = Connection。

次级对象：
- Domain = 节点标签 / cluster。
- Source / Context = 节点状态 / 点击详情。

核心动作：
- 看图。
- 筛范围。
- 点节点。
- 打开原笔记。
```

## 8. Minimum Feature Set

Feature Set 从 Selected Product Shape 里推导出来。

Feature 是用户可以主动使用，或产品必须显式提供的能力。

推荐表格：

| Feature            | 类型           | 承载的 Requirement      | 对应 JTBD            | 为什么必要                    |
| ------------------ | -------------- | ----------------------- | -------------------- | ----------------------------- |
| Understanding 节点 | Core           | 呈现用户沉淀的理解      | 看见理解是否连成结构 | 没有节点就没有 Graph 主对象   |
| Connection 边      | Core           | 呈现显式关系            | 看见理解是否连成结构 | 没有边就无法看到结构          |
| 节点来源状态       | Core           | 呈现缺少 Context 的理解 | 判断理解是否有根     | 承载 Reflecta 的 Context 价值 |
| 未连接节点状态     | Core           | 呈现孤岛                | 看见哪些理解仍然独立 | 孤岛是边界，不是错误          |
| 顶部轻筛选         | Core / Support | 控制图谱复杂度          | 按范围回看图谱       | 避免全局大网压垮用户          |
| 节点详情浮层       | Core           | 让用户判断节点状态      | 判断理解是否有根     | 第一屏保持简单，点击后看细节  |
| 打开原笔记         | Support        | 从观察回到整理动作      | 回到原笔记继续整理   | Graph 不是沉淀终点            |

注意：不要把价值维度直接写成 Feature。

例如：

- “跨领域共通感”不是 Feature。
- “理解深浅感”不是 Feature。
- “Context 厚度”不是 Feature。

它们应被转译成具体承载：

- 跨领域共通感 -> 跨 cluster 的 Connection 边。
- 理解深浅感 -> 节点来源状态、连接状态、点击详情。
- Context 厚度 -> 来源状态、来源摘要、打开原笔记补充入口。

## 9. Shape Rules

Shape Rule 不是 Feature。

Shape Rule 是为了让选定产品形态不走偏，必须遵守的呈现规则。

判断方法：

- 用户会不会把它当成一个可主动使用的功能？
- 如果不会，它大概率是 Shape Rule。

例子：

| Shape Rule                    | 原因                                                |
| ----------------------------- | --------------------------------------------------- |
| Source 不作为一级节点         | Source 是理解的根，不是独立知识对象                 |
| Domain 不作为常驻左侧管理面板 | 第一版主对象必须少，Domain 只作为节点标签 / cluster |
| 跨领域不是独立功能页          | 用跨 cluster 边表达即可                             |
| 第一屏不做多栏管理后台        | 避免用户同时理解太多对象                            |

Shape Rule 的价值在于控制产品形态，而不是增加能力。

## 10. Support / Later / Not Now

### Support

Support 是让 Core Feature 可用、可信、可理解的能力。

例如：

- 图例。
- 搜索。
- 基础布局稳定性。
- 空状态。

### Later

Later 是价值相关，但当前不需要的能力。

例如：

- 自动聚类。
- 时间演化。
- 局部图谱模式。
- 高级筛选。

### Not Now

Not Now 是当前阶段会扩大边界或破坏产品判断的方向。

例如：

- 数量统计 dashboard。
- 掌握度评分。
- AI 自动建边并入库。
- Graph 内关系管理后台。
- Source 独立节点库。
- 多栏 Topic Map。

Not Now 必须写原因。原因应回到 Value Proposition、JTBD、User Mental Model 或 Shape Selection。

## 11. Validation

Validation 用来验证 Feature Set 是否真的承载了 Value Proposition。

行为指标看用户是否完成关键动作：

- 是否进入该形态。
- 是否使用核心筛选。
- 是否点击主对象。
- 是否进入详情。
- 是否回到原内容继续整理。
- 是否补 Source 或补 Connection。

质性判断看用户是否感受到价值：

- 我一眼知道这是什么。
- 我知道哪些理解连起来了。
- 我知道哪些理解缺来源。
- 我知道哪些理解仍然独立。
- 我知道下一步该整理哪里。

## 合格标准

一份合格的 Feature Set spec 应满足：

1. 能追溯到 Value Proposition，但不把 Value Proposition 直接写成功能。
2. 有明确 JTBD，说明用户为什么需要这个能力。
3. Product Requirements 先于 Product Shape。
4. Product Shape 有选型逻辑，不是突然出现。
5. User Mental Model 说明了为什么用户能理解这个形态。
6. Feature 来自选定形态里的对象和动作。
7. Shape Rule 和 Feature 分开。
8. Not Now 能防止产品走偏。
9. Validation 能验证用户是否真的获得了价值。

## 常见错误

| 错误                            | 问题                         |
| ------------------------------- | ---------------------------- |
| 从 Value Proposition 直接列功能 | 中间缺少 JTBD 和产品承载要求 |
| 一开始就确定产品形态            | 容易过早进入 solution space  |
| 把价值维度写成 Feature          | Feature 会变得抽象、不可验证 |
| 把 Shape Rule 写成 Feature      | 功能边界会膨胀               |
| 第一屏主对象太多                | 用户理解成本会急剧上升       |
| Not Now 只写技术或 AI           | 忽略产品形态层面的走偏风险   |
