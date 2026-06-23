# v1.1.0 领域语言统一计划

> 日期：2026-06-23
>
> 状态：Draft
>
> 目标：统一 Reflecta 的核心产品名词，让文档、数据模型、Agent、前端 UI、测试用例最终使用同一套上下文，而不是在某一层做术语映射。

## 1. 为什么要做

现在项目里的核心名词已经混在一起：

```txt
Understanding / Understanding / 理解
Context / Source / 来源 / 上下文
Domain / Domain / 领域 / 分类
Connection / graph / reference / relation
```

这个问题不是文案问题。它会直接影响产品心智：

- 用户到底是在管理 Understanding，还是在沉淀 Understanding？
- Context 是来源字段，还是围绕一个 Understanding 的完整上下文？
- Domain 是分类目录，还是用户长期回看的 Domain？
- Agent 创建的是数据对象，还是提交一个用户可确认的理解候选？

v1.1.0 这一版的目标不是“少改代码”，而是把最终产品呈现成一套统一语言。

## 2. 目标领域语言

### Understanding / 理解

Understanding 是 Reflecta 的中心对象。

它表示用户在某个问题、经验、材料或对话之后形成的个人理解，可以是判断、表达、边界、经验、心智模型片段。

它不是：

- 随手想法。
- 外部资料摘录。
- AI 自动总结。
- 已经被系统判定正确的知识。

它可以还不完整，但必须代表用户当前愿意保留、回看、继续深化的理解。

### Context / 上下文

Context 是围绕某个 Understanding 的具象上下文。

它不只是来源。它可以承担多种关系：

- 形成：最初让这个 Understanding 长出来的经历、材料、对话或观察。
- 支撑：后来让这个 Understanding 更稳的经历。
- 应用：用户后来用这个 Understanding 做判断或行动的场景。
- 挑战：让这个 Understanding 出现边界、例外或冲突的场景。
- 修正：促使用户改写、变窄或深化这个 Understanding 的场景。

所以 `Source` 不能作为一等概念。`medium/title` 这种命名会把 Context 降级成 citation metadata。

更准确的数据语言应该是：

```txt
Context
  - medium: experience | video | book | article | opinion | ai | other
  - title
  - content
```

这里 `medium` 可以表达材料或经历类型，但它不是 Context 本身。

### Connection / 理解关系

Connection 是两个 Understanding 之间被用户显式意识到的关系。

它不是系统自动推断出来的 graph edge。AI 可以建议关系，但不能把建议直接写成用户的理解网络。

Connection 应该回答：

```txt
这两个 Understanding 为什么对用户来说有关？
```

### Domain / 领域

Domain 是用户长期回看一组 Understanding 的领域语境。

它不是普通文件夹，也不是标签集合。它表示用户正在理解的主题空间，例如：

- 交易心理
- AI / Agent
- 产品设计
- 行为设计

当前代码里的 `Domain` 更像实现名。v1.1.0 的最终产品语言应收敛到 `Domain`。

## 3. 不再使用的概念边界

### 不把 Understanding 当产品名

`Understanding` 太轻，容易让用户理解成灵感、念头、碎片想法。

产品层统一使用 `Understanding / 理解`。

如果迁移过程中保留 `understandings` 表或 `UnderstandingDTO`，只能是短期中间态。退出条件必须是公共模型、Agent、UI、测试中不再暴露 Understanding 作为产品名。

### 不把 Source 当 Context

`Source` 只能描述 Context 的某些元信息，例如 medium、title、外部材料名。

产品层不能出现：

```txt
sourceContext
sourceEvidence
sourceStatus
```

这些名字会把 Context 拉回“来源证据”，和这次修正后的模型冲突。

### 不把 Domain 当用户语言

`Domain` 是信息管理味道，适合作为旧实现名，不适合作为最终产品语言。

产品层统一使用 `Domain / 领域`。

### 区分三种 context

项目里会同时存在三类 context，必须明确命名：

- `Context`：产品对象，表示 Understanding 的具象上下文。
- `model context`：模型上下文窗口，属于 AI runtime 技术概念。
- `React context`：前端技术概念。

不要用 `context` 单词泛指任何东西。技术文档必须写完整限定词。

## 4. 当前影响面

一次粗扫命中约 182 个文件，里面包含 React context、model context window 等 false positive。实际需要迁移的区域至少有 12 个。

| 区域                                                      | 当前影响                                                                        | 目标                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `CONTEXT.md`                                              | 缺少核心产品 glossary                                                           | 补上 Understanding / Context / Connection / Domain |
| `docs/references/product/value-proposition.md`            | 混用 Understanding、Context 来源、领域等表达                                    | 改成统一产品语言                                   |
| `docs/iterations/v1.1.0/*`                                | 已有计划使用 Understanding、Understanding、source evidence、Domain、Domain 混杂 | 全部改成统一术语                                   |
| `packages/skills/skills/cli-usage`                        | skill reference 仍把 Context 说成背景、来源、证据或补充材料                     | 改成 Understanding + Context lifecycle             |
| `packages/server/src/domains/understanding`               | domain module 以 Understanding 命名                                             | 迁到 Understanding domain                          |
| `packages/server/src/domains/context`                     | 字段是 `medium/title`                                                           | 改成 `medium/title/content`                        |
| `packages/server/src/domains/domain`                      | domain module 以 Domain 命名                                                    | 迁到 Domain domain                                 |
| `packages/server/src/domains/graph/search/snapshot/trash` | 搜索、图、概览和回收站都引用旧实体名                                            | 跟随核心模型迁移                                   |
| `apps/electron/src/preload/typings`                       | IPC 类型暴露 Understanding/Domain/ContextRef                                    | 改成 Understanding/Domain/SelectedReference        |
| `apps/electron/src/main/services/agent`                   | Pi tools/prompt 暴露 Understanding、Domain、source evidence                     | 改成 propose/read/find Understanding + Context     |
| `apps/electron/src/renderer/src/modules/capture`          | UI 已经部分用“理解/领域”，但代码和 Context UI 仍混用 Source                     | UI、状态、组件统一                                 |
| `apps/electron/src/renderer/src/modules/chat`             | Agent context refs、tool display、proposal card 旧名混杂                        | 统一到产品语言                                     |
| `apps/electron/e2e/agent`                                 | feature/spec 里仍有旧工具名和旧对象名                                           | 改成用户语言的测试路径                             |

## 5. 目标数据模型

目标不是在 UI 上把 `Understanding` 显示成“理解”，而是让公共模型本身变成产品语言。

```ts
type Understanding = {
  id: string;
  title?: string;
  body: string;
  domainIds: string[];
  createdAt: string;
  updatedAt: string;
};

type Context = {
  id: string;
  understandingId: string;
  medium: "experience" | "video" | "book" | "article" | "opinion" | "ai" | "other";
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type Connection = {
  id: string;
  sourceUnderstandingId: string;
  targetUnderstandingId: string;
  reason?: string;
};

type Domain = {
  id: string;
  name: string;
  parentId?: string | null;
};
```

实现可以分 phase，但最终不能留下长期双模型：

```txt
UnderstandingDTO -> UnderstandingDTO mapper
DomainDTO -> DomainDTO mapper
medium/title -> context medium/title mapper
```

这些只能作为迁移过程中的临时结构，不能作为 v1.1.0 退出状态。

## 6. 渐进式迁移计划

每个 phase 都按一个产品概念闭环推进，不按文件夹横切。

### Phase 1：建立领域语言契约

目标：所有后续开发有唯一词典。

改动：

- 更新 `CONTEXT.md`，新增四个核心术语：Understanding、Context、Connection、Domain。
- 更新 `docs/references/product/value-proposition.md`，把 Understanding/来源/Domain 的表达修正为统一语言。
- 更新 `packages/skills/skills/cli-usage/references/reflecta-concepts.md`。
- 更新 v1.1.0 已有 plan，去掉 `sourceEvidence/sourceContext/retrieve_understanding/thought_capture` 这类混乱命名。

测试：

- 文档 contract check：产品文档不再把 Context 定义成单纯来源字段。
- 文档 contract check：v1.1.0 文档不再出现 `sourceEvidence/sourceContext/sourceStatus`。

退出条件：

- 任何人先读 glossary，都能知道四个一等概念是什么。
- 文档里不再一会儿 Understanding，一会儿 Understanding。

### Phase 2：把 Understanding 迁成 Understanding

目标：用户和公共模型都只看到 Understanding。

改动：

- `understandings` 表迁移为 `understandings`。
- `understanding_connections` 迁移为 `understanding_connections`。
- `understanding_domains` 迁移为 `understanding_domains`。
- `packages/server/src/domains/understanding` 迁移到 `understanding`。
- `UnderstandingDTO/CreateUnderstandingInput/UpdateUnderstandingInput` 迁移为 `UnderstandingDTO/CreateUnderstandingInput/UpdateUnderstandingInput`。
- preload typings、IPC、renderer queries、capture UI 同步迁移。
- markdown/wiki link 从 `[[understanding:...]]` 迁到 `[[understanding:...]]`，并明确是否需要一次性迁移旧 body。

测试：

- migration test：旧 `understandings` 数据迁移后完整保留。
- domain test：创建、更新、删除 Understanding。
- renderer test：列表、详情、删除确认都显示“理解”。
- e2e：用户创建一条理解，刷新后仍能看到。

退出条件：

- 公共类型、IPC、UI、测试中不再暴露 `Understanding`。
- `Understanding` 只允许出现在旧 migration 文件或迁移说明里。

### Phase 3：把 Context 从 Source 语义里解出来

目标：Context 成为 Understanding 的完整上下文，而不是来源证据。

改动：

- `contexts.medium` 迁移为 `contexts.medium`。
- `contexts.title` 迁移为 `contexts.title`。
- Context create/update UI 支持选择 medium。
- Capture 详情页把“来源”改成“上下文”。
- Agent proposal card 不再说 source status，而是展示 proposed Context。

测试：

- migration test：旧 Context 的 medium/title 迁成 medium/title。
- e2e：用户给一个 Understanding 添加 Context，刷新后 medium/title/content 保留。

退出条件：

- 产品 UI 不再把 Context 叫“来源”。
- 代码里不再有 `sourceContext/sourceEvidence/sourceStatus`。
- `ContextMedium` 类型被替换为 Context medium。

### Phase 4：把 Category 迁成 Domain

目标：用户回看的是领域，不是分类目录。

改动：

- `categories` 表迁移为 `domains`。
- `packages/server/src/domains/category` 迁移到 `domain`。
- `CategoryDTO/CreateCategoryInput` 迁移为 `DomainDTO/CreateDomainInput`。
- capture sidebar、select、tree、empty state 统一使用“领域”。
- Agent tools 从 `category_*` 改成 `domain_*`。

测试：

- migration test：多层 Category tree 迁成 Domain tree。
- renderer test：领域树创建、编辑、删除、移动。
- e2e：用户在某个领域下创建 Understanding，并能切换领域回看。

退出条件：

- 公共类型、Agent tools、UI、feature 中不再暴露 `Category`。
- `Category` 只允许出现在旧 migration 或迁移说明里。

### Phase 5：重做 Agent 工具语言

目标：Agent 操作的是产品概念，不是旧数据库对象。

工具目标：

```txt
find_understandings
read_understanding
propose_understanding
add_context
update_context
inspect_domain
```

规则：

- `find_understandings` 返回 Understanding candidates，并把命中的 Context 放在 `matchedContexts` 里。
- 不使用 `sourceEvidence`。
- `propose_understanding` 只提交候选，不直接写入。
- 如果 proposal 包含 Context，必须说明 Context 的 title、medium 和 content。
- Connection 只能作为候选建议，不能自动写入。

测试：

- tool contract：tool names 不再包含 `thought_*`、`category_*`。
- tool contract：tool payload 不再包含 `sourceEvidence/sourceContext/sourceStatus`。
- real AI e2e：用户要求查找相关理解，Agent 调用新 tool 并完成回复。
- real AI e2e：用户要求记录一条带上下文的理解，出现 proposal，确认后数据写入。

退出条件：

- Pi system prompt、tools、tool display、proposal card 全部使用统一语言。
- Agent 不再以 knowledge base CRUD 的方式描述自己。

### Phase 6：清理测试、文档和旧名

目标：仓库里看不到两套产品语言。

改动：

- 更新所有 v1.1.0 文档。
- 更新 feature 文件和 e2e 文案。
- 更新 CLI skill references。
- 删除临时 mapper、旧 aliases、旧 test fixture。
- 增加 `rg` 验收脚本。

验收搜索：

```bash
rg "Thought|thought_|Category|category_|sourceEvidence|sourceContext|sourceStatus|SourceType" \
  docs apps/electron/src packages/server/src packages/skills apps/electron/e2e/agent
```

允许命中：

- migration 文件。
- changelog / 迁移说明。
- 第三方或技术上下文里不可避免的 `React Context`、`model context window`。

退出条件：

- 产品、Agent、UI、公共模型、feature test 都只讲 Understanding / Context / Connection / Domain。
- 没有长期命名映射层。

## 7. TDD 与自动化原则

这个任务不能靠手工全局替换。

每个 phase 的顺序：

1. 先写 glossary / contract test，锁定不允许回退的旧词。
2. 写 migration test，证明旧数据能进入新模型。
3. 写 domain unit test，覆盖新模型行为。
4. 写 UI/component test，覆盖用户看到的新词。
5. 写 e2e，覆盖真实用户路径。
6. 再做重命名和清理。

不测试：

- 内部函数是否被调用。
- 某一层 mapper 是否存在。

必须测试：

- 用户路径是否只出现统一语言。
- 旧数据迁移后语义是否保留。
- Agent 是否用统一语言提交 proposal。
- reload 后 Understanding、Context、Domain 关系仍然存在。

## 8. 风险

### 风险 1：改名范围大

这是一次产品语言迁移，不是普通 refactor。影响 DB、server、IPC、renderer、Agent、docs、tests。

解决方式：按概念逐个闭环，不同时改四个名词。

### 风险 2：技术 context 混淆

`Context` 同时是产品对象、AI 上下文、React 技术概念。

解决方式：

- 产品对象写 `Context`。
- AI runtime 写 `model context`。
- React 写 `React context`。
- Agent 选中的引用不要再叫 `AgentContextRef`，改成 `SelectedReference` 或 `AgentReference`。

## 9. 最终验收

最终状态应该是：

```txt
用户看到：理解 / 上下文 / 连接 / 领域
Agent 说：理解 / 上下文 / 连接 / 领域
公共类型：Understanding / Context / Connection / Domain
后端模块：understanding / context / connection / domain
测试用例：按用户语言描述路径
```

不是：

```txt
UI 叫理解，但代码叫 Understanding
UI 叫领域，但 Agent tool 叫 domain
Context 页面叫上下文，但字段叫 source
Agent 搜索返回 source evidence
```

这版完成后，Reflecta 的核心心智模型应该能用一句话落到产品和代码里：

```txt
用户在某个 Domain 里沉淀 Understanding；
每个 Understanding 周围有 Context；
Understanding 之间由用户显式建立 Connection。
```
