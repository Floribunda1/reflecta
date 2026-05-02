# Reflecta Server Core / BFF Architecture Draft

> 这份文档用于确认 `packages/server` 的双层结构，以及它与 CLI / Electron API 设计的关系。

---

## 1. Summary

`packages/server` 只拆成两层：

1. `core`
2. `bff`

目标不是引入更多架构名词，而是把“真实数据能力”和“面向消费端的返回结构”分开。

这两层都保留在 `packages/server` 内部，不新增独立 package。

依赖方向固定为：

```text
apps/cli
apps/electron
    ↓
packages/server/bff
    ↓
packages/server/core
```

约束：

- `core` 不关心 CLI 或 Electron
- `bff` 不依赖任何 `apps/*`
- `apps/*` 不自行组装复杂 DTO，统一消费 `bff`

---

## 2. Layer Responsibilities

### 2.1 Core

`core` 只负责系统里的真实数据和基础能力。

包括：

- DB schema / migration / db access
- thought / context / category / reference 的原始读写
- wiki link 解析与同步
- FTS 原始查询能力
- 事务、一致性、删除/恢复等基础规则

`core` 回答的问题是：

- 系统里有什么数据
- 数据之间是什么关系
- 数据应该怎么被创建、更新、删除、恢复

`core` 不负责：

- CLI 输出长什么样
- Electron IPC 返回长什么样
- 搜索结果是否需要 `snippet`
- `include-*` 时该展开哪些字段

### 2.2 BFF

`bff` 负责把 `core` 的数据组装成 consumer-friendly 的返回结构。

第一版同时服务：

- CLI
- Electron

`bff` 负责：

- 聚合返回结构
- 字段裁剪
- `include-*` 语义
- 搜索结果 shape
- `snippet`
- 分页输出契约
- summary / detail / inspect / graph 的返回层次

`bff` 回答的问题是：

- 这次应该返回给 consumer 什么 shape
- 哪些字段默认轻量
- 哪些字段按需展开

---

## 3. Current Problem

当前 `packages/server` 已经混合了 `core` 和 `bff` 职责。

典型表现：

- `ThoughtService` 不只是读写 thought，也在直接组装 `ThoughtDTO`
- `SearchService` 不只是执行搜索，也直接返回 consumer-facing 的聚合结构
- `packages/server/src/types.ts` 同时放领域类型和 DTO 类型
- Electron IPC 和 CLI 都在直接消费这套混合返回结构

这会导致三个问题：

1. server 内部返回和 consumer 契约耦合
2. CLI 文档容易被迫参考 server 内部 shape
3. Electron 和 CLI 很难共享统一但明确的 consumer-facing 语义

---

## 4. Target Structure

建议目录：

```text
packages/server/src
├── core
│   ├── db-access / repositories
│   ├── thought
│   ├── context
│   ├── category
│   ├── reference
│   ├── search
│   └── wiki-links
├── bff
│   ├── thought
│   ├── context
│   ├── category
│   ├── graph
│   ├── search
│   ├── snapshot
│   └── types
├── db
└── index.ts
```

约定：

- `core` 输出中性结果，不使用 `ThoughtDTO` / `ThoughtSummaryDTO` 这类 consumer 命名
- `bff` 定义所有对外返回类型
- `index.ts` 只 re-export 稳定入口，避免 app 侧直接钻内部目录

---

## 5. API Design Boundary

### 5.1 Core API

`core` API 应该偏中性、偏原始能力。

例如：

- `getThoughtRecord(id)`
- `listThoughtRecords(filter)`
- `getThoughtReferenceIds(id)`
- `searchThoughtMatches(query, options)`
- `searchContextMatches(query, options)`

这些接口可以返回：

- record
- id list
- raw match
- relation row

但不直接返回：

- `ThoughtDetail`
- `SearchAllResult`
- `CategoryInspectResult`

### 5.2 BFF API

`bff` API 直接面向 consumer 契约。

例如：

- `getThoughtDetail(id, options)`
- `listThoughtSummaries(filter, options)`
- `searchThoughts(query, options)`
- `searchContexts(query, options)`
- `searchAll(query, options)`
- `inspectCategory(id, options)`
- `getGraphNeighborhood(id, options)`
- `getProjectSnapshot(options)`

这些接口直接返回 CLI / Electron 可消费的 shape。

---

## 6. Shared Consumer Contract

第一版 `bff` 同时服务 CLI 和 Electron，所以两端共享同一套 consumer-facing 语义。

重点约束：

- Thought 关系字段统一为：
  - `references`
  - `referencedBys`
  - `referenceCount`
  - `referencedByCount`
- 图谱边仍保留：
  - `ReferenceEdge { from, to }`
- 搜索返回保留：
  - `snippet`
  - `rank`
- `search` 负责定位
- `get` / `inspect` / `graph` 负责理解

这意味着：

- CLI 文档描述的是 `bff` 契约，不是 `core` 返回
- Electron IPC 也应该直接暴露同一套 `bff` 契约，而不是再单独发明另一套 DTO

---

## 7. CLI API Design Position

CLI API 文档应当明确定位为：

> Reflecta BFF for CLI

而不是：

> server 内部 API 映射

因此：

- [apps/cli/COMMANDS-DRAFT.md](<projectRoot>/apps/cli/COMMANDS-DRAFT.md) 描述 CLI 所消费的 `bff` 输出契约
- `apps/cli/api-design/draft.md` 如果继续保留，应逐步改写成命令设计与工作流说明，而不是 server 实体返回定义

CLI 文档需要坚持两点：

1. 不参考 server 内部 DTO
2. 只围绕 agent 读取、判断、写入这条工作流定义输出

---

## 8. Migration Plan

### Phase 1

先在文档层确认边界：

- `core` 做什么
- `bff` 做什么
- CLI 文档描述哪一层
- Electron 应该消费哪一层

### Phase 2

重构 `packages/server` 类型：

- 把领域类型和 DTO 类型分开
- 停止在 `core` 中使用 consumer-facing DTO 命名

### Phase 3

重构服务职责：

- `ThoughtService`、`SearchService` 等拆成 core 能力和 bff 组装
- `apps/cli` 与 `apps/electron` 改为依赖 `bff`

### Phase 4

统一文档与出口：

- 更新 CLI API 草案
- 更新 Electron 调用约定
- 调整 `@reflecta/server` 对外导出路径

---

## 9. Acceptance Criteria

当以下条件满足时，说明这套分层成立：

- `core` 不再 import 或返回 consumer-facing DTO
- `bff` 不依赖任何 `apps/*`
- CLI 与 Electron 都通过 `bff` 获取聚合结果
- CLI 文档不再把 server 内部结构当作输出契约
- thought 关系命名在所有 consumer-facing 文档中统一为 `references` / `referencedBys`

---

## 10. Open Defaults

本草案先固定以下默认：

- 只采用两层：`core` 和 `bff`
- 不新增独立 `bff package`
- `bff` 第一版同时覆盖 CLI 和 Electron
- `ReferenceEdge { from, to }` 保留为图层基础结构
- CLI consumer 契约以 `apps/cli/COMMANDS-DRAFT.md` 为当前主草案
