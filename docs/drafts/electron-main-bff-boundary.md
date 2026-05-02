# Electron Main / Server BFF 实现边界

> 本文档确认 `apps/electron/src/main/`（Electron Main 进程）与 `packages/server`（BFF / Core）之间的职责边界。与 `server-core-bff-architecture.md` 配套阅读。

---

## 一、三层架构总览

```text
┌─────────────────────────────────────────┐
│   apps/electron/src/renderer/src/       │
│   ── 前端 Vue 组件 + Composables       │
│   ── 消费 ipcClient.*                  │
└─────────────────┬───────────────────────┘
                  │ IPC（electron-ipc-decorator）
┌─────────────────▼───────────────────────┐
│   apps/electron/src/main/services/      │
│   ── IPC Facade（本层讨论的范围）        │
│   ── 只转发 + Electron 特有逻辑          │
└─────────────────┬───────────────────────┘
                  │ TypeScript 调用
┌─────────────────▼───────────────────────┐
│   packages/server/bff                   │
│   ── 面向消费的聚合层                    │
│   ── DTO 组装、字段裁剪、分页、搜索高亮   │
└─────────────────┬───────────────────────┘
                  │ TypeScript 调用
┌─────────────────▼───────────────────────┐
│   packages/server/core                  │
│   ── 原始数据能力                        │
│   ── DB 读写、事务、wiki-link、FTS       │
└─────────────────────────────────────────┘
```

**核心原则**：

- Renderer → Main 之间走 **IPC**
- Main → Server 之间走 **直接函数调用**（同进程）
- Main 本身**不实现业务逻辑**，只负责 **Electron 运行时能力 + 契约转发**

---

## 二、Electron Main 的职责清单

Electron Main 进程只做以下三件事：

### 2.1 IPC Facade — 暴露 BFF 契约给 Renderer

```ts
// 正确做法：main/services/ThoughtService.ts
class ThoughtService extends IpcService {
  static readonly groupName = "thought";

  @IpcMethod()
  async query(req: ThoughtQueryRequest): Promise<Page<ThoughtListItem>> {
    // 直接转发给 bff
    return bff.thought.query(req);
  }

  @IpcMethod()
  async getById(id: string): Promise<ThoughtDetail | null> {
    return bff.thought.getById(id);
  }
}
```

**约束**：

- Main 的 IPC 方法签名与 `packages/server/bff` 完全一致
- Main **不修改** BFF 返回的数据结构
- Main **不组装 DTO**，所有聚合逻辑属于 BFF
- Main 的 `types.ts` 最终应该从 `@reflecta/server/bff` 导入，而不是自己定义

### 2.2 Electron 运行时能力 — 只有 Main 能做的事

```text
┌────────────────────────────────────────────────────────┐
│  能力                    │  归属   │  Renderer 能否做？ │
├────────────────────────────────────────────────────────┤
│  系统对话框（pickDirectory） │  Main   │  ❌ 不能          │
│  应用重启（app.restart）      │  Main   │  ❌ 不能          │
│  文件系统读写（asset save）   │  Main   │  ⚠️ 受限（隔离）   │
│  自定义协议（asset://）       │  Main   │  ❌ 不能          │
│  Shell 操作（openPath/showItemInFolder）│ Main │ ❌ 不能 │
│  DB 直接读写               │  Main   │  ❌ 不能          │
│  OpenAI API Key 读取       │  Main   │  ❌ 安全隔离       │
└────────────────────────────────────────────────────────┘
```

**注意**：即使是文件系统相关的能力，也应该由 Main 调用 BFF 或 core 完成，而不是 Main 自己写业务逻辑。

```ts
// 正确做法：asset save
class AssetService extends IpcService {
  @IpcMethod()
  async save(data: ArrayBuffer, filename: string): Promise<SaveAssetResult> {
    // 1. 由 Main 负责文件系统写入（安全隔离）
    const id = await writeFileToDisk(data, filename);
    // 2. 由 core 负责 DB 记录（如果有的话）
    await serverCore.asset.record(id, filename);
    return { id, url: `asset:///${id}` };
  }
}

// 错误做法：Main 自己维护 asset 引用关系、自己做 orphan 扫描逻辑
// 这些应该在 bff/core 里做，Main 只负责触发
```

### 2.3 生命周期与状态管理

- **窗口管理**：创建/销毁/最小化/托盘化 BrowserWindow
- **菜单与快捷键**：应用菜单、全局快捷键注册
- **协议注册**：`asset:///` 自定义协议的 handler
- **配置持久化**：配置文件的读写（可以委托给 core，但文件路径本身由 Main 管理）

---

## 三、Server BFF 的职责清单

BFF 是 Electron Main 的"下游"，负责所有**业务数据契约**。

### 3.1 BFF 必须做的事

| 职责             | 说明                                               | 示例                                  |
| ---------------- | -------------------------------------------------- | ------------------------------------- |
| DTO 组装         | 把 core 的原始 record 组装成 consumer-facing shape | `ThoughtRecord` → `ThoughtDetail`     |
| 字段裁剪         | 列表返回轻量字段，详情返回完整嵌套                 | `ThoughtListItem` vs `ThoughtDetail`  |
| 分页             | 处理 limit/offset，返回 `Page<T>`                  | `query(filter, { limit: 50 })`        |
| 搜索高亮         | 生成 snippet、处理 rank                            | `search.suggest()` 返回 `bodyPreview` |
| `include-*` 语义 | 按需展开嵌套关系                                   | `getById(id)` 默认展开 contexts       |
| 软删除/恢复      | 业务规则判断（不是 core 的硬删）                   | delete 实际是更新 deletedAt           |
| 级联操作         | 删除 category 时 uncategorize 还是 cascade         | `delete(id, { mode })`                |

### 3.2 BFF 不做的事

| 职责           | 为什么不属于 BFF         | 实际归属                       |
| -------------- | ------------------------ | ------------------------------ |
| IPC 通信       | BFF 不知道 IPC 存在      | Electron Main                  |
| 系统对话框     | BFF 不知道 Electron 存在 | Electron Main                  |
| 文件系统写入   | BFF 是纯逻辑层           | Electron Main / core（视架构） |
| 窗口管理       | BFF 不知道 BrowserWindow | Electron Main                  |
| DB Schema 变更 | 属于数据层               | server core                    |
| 原始 SQL 查询  | 属于数据访问层           | server core                    |

---

## 四、边界判定 — "这个功能该放在哪里？"

### 4.1 判定流程

```
开始
  │
  ▼
这个功能是否需要 Electron 运行时能力？
  │
  ├── 是（对话框/文件系统/协议/窗口/重启）
  │   └── 放在 Electron Main
  │
  └── 否
      │
      ▼
  这个功能是否涉及业务数据聚合/裁剪/消费者契约？
      │
      ├── 是（DTO 组装/分页/搜索高亮/级联删除）
      │   └── 放在 Server BFF
      │
      └── 否
          │
          ▼
      这个功能是否是原始数据读写/事务/一致性？
          │
          └── 是
              └── 放在 Server Core
```

### 4.2 实例判定

| 功能                                                          | 归属                      | 理由                               |
| ------------------------------------------------------------- | ------------------------- | ---------------------------------- |
| `thought.query()` — 分页返回 `Page<ThoughtListItem>`          | **BFF**                   | DTO 组装 + 分页 + 字段裁剪         |
| `thought.getById()` — 返回 `ThoughtDetail`（含嵌套 contexts） | **BFF**                   | 按需展开嵌套关系                   |
| `thought.create()` — 创建 thought，返回 `ThoughtDetail`       | **BFF**                   | 写后回显的 DTO 组装                |
| `thought.patch()` — 静默更新 body                             | **BFF**                   | 业务语义（"静默"是 consumer 概念） |
| `search.suggest()` — WikiLink 补全，limit=8                   | **BFF**                   | 搜索高亮 + limit + 返回 shape      |
| `trash.empty()` — 一键清空回收站                              | **BFF**                   | 批量删除的业务规则 + 返回契约      |
| `category.delete(id, { mode })` — 级联或去分类                | **BFF**                   | 业务规则判断                       |
| `asset.save(data, filename)` — 保存文件到磁盘                 | **Main**                  | 需要文件系统写入（安全隔离）       |
| `asset.scanOrphans()` — 扫描无效文件                          | **BFF**（调用 core）      | 业务逻辑判断"无效"（引用计数）     |
| `dialog.pickDirectory()` — 弹出选择目录框                     | **Main**                  | 需要 Electron `dialog` API         |
| `app.restart()` — 重启应用                                    | **Main**                  | 需要 Electron `app` API            |
| `ai.generateSummary()` — AI 摘要                              | **BFF**（调用 core/外部） | 业务组装 prompt + 返回 shape       |
| DB 读写（thoughts.insert/ update/ delete）                    | **Core**                  | 原始数据能力                       |
| Wiki-link 解析与同步                                          | **Core**                  | 数据一致性规则                     |
| FTS 索引构建                                                  | **Core**                  | 原始搜索能力                       |

---

## 五、数据流向示例

### 5.1 用户打开 Capture 页（读取 Thought 列表）

```
Renderer
  │  ipcClient.thought.query({ filter: { categoryId: "all" }, options: { limit: 50 } })
  ▼
Main / ThoughtService.query()
  │  // 纯转发，零业务逻辑
  ▼
BFF / thought.query()
  │  // 1. 解析 filter
  │  // 2. 调用 core.listThoughtRecords(filter, options)
  │  // 3. 组装 ThoughtListItem[]（裁剪 body → bodyPreview，计数 → count）
  │  // 4. 包装 Page<ThoughtListItem>
  ▼
Core / listThoughtRecords()
  │  // 执行 SQL，返回原始 record
  ▼
DB
```

### 5.2 用户编辑 Thought body（静默保存）

```
Renderer
  │  ipcClient.thought.patch(id, { body: "..." })
  ▼
Main / ThoughtService.patch()
  │  // 纯转发
  ▼
BFF / thought.patch()
  │  // 1. 调用 core.updateThoughtRecord(id, { body })
  │  // 2. 组装 ThoughtDetail（保持嵌套不变）
  │  // 3. ⚠️ 不触发 listThoughts 的 cache invalidation（这是 BFF 的契约语义）
  ▼
Core / updateThoughtRecord()
  ▼
DB
```

### 5.3 用户上传图片

```
Renderer
  │  // 从 File 读取 ArrayBuffer
  │  ipcClient.asset.save(arrayBuffer, filename)
  ▼
Main / AssetService.save()
  │  // 1. 文件系统写入（Electron 特有）
  │  const id = await fs.writeFile(path, Buffer.from(arrayBuffer))
  │  // 2. 可选：通知 core 记录 asset 元数据
  │  await serverCore.asset.record(id, filename)
  │  // 3. 返回契约
  │  return { id, url: `asset:///${id}` }
  │
  │  // ⚠️ 注意：如果 core 已经负责 asset 元数据管理，
  │  // 第 2 步应该由 BFF 调用，而不是 Main 直接调用 core。
  │  // 但文件写入本身必须由 Main 执行。
```

### 5.4 用户选择存储目录

```
Renderer
  │  ipcClient.dialog.pickDirectory({ title: "选择存储目录" })
  ▼
Main / DialogService.pickDirectory()
  │  // 1. 调用 Electron dialog.showOpenDialog()
  │  const result = await dialog.showOpenDialog(...)
  │  // 2. 返回契约
  │  return { canceled: result.canceled, path: result.filePaths[0] ?? null }
  │
  │  // ⚠️ 不涉及 BFF/core，这是纯 Electron 运行时能力
```

---

## 六、当前 v2 设计中需要明确的边界

基于 `renderer-api-v2-design.md` 的新 API 设计，逐项确认归属：

### 6.1 Thought 域

| 接口                          | 归属    | 说明                                 |
| ----------------------------- | ------- | ------------------------------------ |
| `thought.query()`             | **BFF** | 分页 + 字段裁剪                      |
| `thought.getById()`           | **BFF** | 嵌套展开                             |
| `thought.create()`            | **BFF** | 写后回显                             |
| `thought.update()`            | **BFF** | 写后回显                             |
| `thought.patch()`             | **BFF** | 静默更新语义（BFF 决定是否通知缓存） |
| `thought.delete()`            | **BFF** | 软删除 + 返回被删除实体              |
| `thought.addConnection()`     | **BFF** | 关系操作的业务规则                   |
| `thought.removeConnection()`  | **BFF** | 关系操作的业务规则                   |

### 6.2 Context 域

| 接口                   | 归属    | 说明               |
| ---------------------- | ------- | ------------------ |
| `context.create()`     | **BFF** | 写后回显           |
| `context.update()`     | **BFF** | 写后回显           |
| `context.delete()`     | **BFF** | 软删除             |
| `context.deleteMany()` | **BFF** | 批量删除的业务规则 |

### 6.3 Category 域

| 接口                    | 归属    | 说明                                         |
| ----------------------- | ------- | -------------------------------------------- |
| `category.list()`       | **BFF** | 返回 `CategoryFlatNode[]`（含 thoughtCount） |
| `category.create()`     | **BFF** | 写后回显                                     |
| `category.update()`     | **BFF** | 写后回显                                     |
| `category.delete()`     | **BFF** | 级联/去分类的业务规则                        |
| `category.deleteMany()` | **BFF** | 批量删除的业务规则                           |
| `category.reorder()`    | **BFF** | 重排后返回完整列表                           |

### 6.4 Search 域

| 接口               | 归属    | 说明                            |
| ------------------ | ------- | ------------------------------- |
| `search.suggest()` | **BFF** | 搜索 + limit + 返回 SuggestItem |
| `search.search()`  | **BFF** | 全文搜索 + snippet + 分页       |

### 6.5 Trash 域

| 接口                               | 归属    | 说明                              |
| ---------------------------------- | ------- | --------------------------------- |
| `trash.list()`                     | **BFF** | 聚合 thoughts + contexts          |
| `trash.restoreThought()`           | **BFF** | 恢复业务规则 + 返回 RestoreResult |
| `trash.restoreContext()`           | **BFF** | 恢复业务规则 + 返回 RestoreResult |
| `trash.deleteThoughtPermanently()` | **BFF** | 永久删除业务规则                  |
| `trash.deleteContextPermanently()` | **BFF** | 永久删除业务规则                  |
| `trash.empty()`                    | **BFF** | 批量清空业务规则                  |

### 6.6 Asset 域

| 接口                   | 归属                 | 说明                                           |
| ---------------------- | -------------------- | ---------------------------------------------- |
| `asset.save()`         | **Main + BFF**       | Main 负责文件写入；BFF 负责 DB 记录 + 返回契约 |
| `asset.scanOrphans()`  | **BFF**（调用 core） | "无效"判断是业务逻辑                           |
| `asset.cleanOrphans()` | **BFF + Main**       | BFF 决定删哪些；Main 执行文件删除              |
| `asset.open()`         | **Main**             | `shell.openPath()`                             |
| `asset.reveal()`       | **Main**             | `shell.showItemInFolder()`                     |

**注意**：`asset.save` 是一个跨边界接口。

- 如果 BFF 负责"保存 asset 的业务逻辑"（如生成 ID、记录到 DB、返回契约），那么 BFF 暴露 `save(data, filename)` 方法，内部调用 Main 的文件写入能力。
- 但当前 IPC 架构下，BFF 无法直接调用 Main。所以有两种方案：
  - **方案 A**：`asset.save` 是 Main 的 IPC 接口，内部调用 BFF 的业务逻辑（推荐，因为文件写入必须在 Main）
  - **方案 B**：`asset.save` 是 BFF 的方法，但 BFF 内部通过某种机制委托 Main 做文件写入（需要额外的跨层调用机制，不推荐）

**结论**：`asset.save` 属于 Main 的 IPC 接口，但业务逻辑（ID 生成、DB 记录）委托给 BFF/core。

### 6.7 Config / Dialog / App 域

| 接口                     | 归属     | 说明                      |
| ------------------------ | -------- | ------------------------- |
| `cfg.getStorage()`       | **BFF**  | 读取配置的业务封装        |
| `cfg.setStorage()`       | **BFF**  | 写入配置 + 返回更新后配置 |
| `cfg.getAiProvider()`    | **BFF**  | 读取配置                  |
| `cfg.setAiProvider()`    | **BFF**  | 写入配置                  |
| `dialog.pickDirectory()` | **Main** | 纯 Electron 运行时能力    |
| `app.restart()`          | **Main** | 纯 Electron 运行时能力    |
| `app.getInfo()`          | **Main** | 纯 Electron 运行时能力    |

### 6.8 AI 域

| 接口                   | 归属    | 说明                     |
| ---------------------- | ------- | ------------------------ |
| `ai.generateSummary()` | **BFF** | prompt 组装 + 返回 shape |

---

## 七、Main 层的 thin/thick 抉择

### 7.1 Thin Main（推荐）

Main 只负责：

1. IPC 契约暴露（`@IpcMethod` 装饰器）
2. Electron 运行时能力（dialog、shell、app、protocol）
3. 安全隔离（文件系统写入必须在 Main）

所有业务逻辑委托给 BFF。

```ts
// Thin Main 示例
class ThoughtService extends IpcService {
  @IpcMethod()
  async query(req: ThoughtQueryRequest) {
    return bff.thought.query(req);
  }
}
```

### 7.2 Thick Main（不推荐）

Main 里包含业务逻辑：

```ts
// ❌ 错误示例
class ThoughtService extends IpcService {
  @IpcMethod()
  async query(req: ThoughtQueryRequest) {
    const records = await db.select().from(thoughts).where(...);
    // Main 自己在组装 DTO！
    return {
      items: records.map(r => ({ ... })),
      total: records.length,
    };
  }
}
```

**为什么错误**：

- DTO 组装逻辑分散在 Main 里，BFF 无法复用
- CLI 和 Electron 的返回结构可能不一致
- 业务规则变更需要改两个地方

---

## 八、关键结论

1. **Electron Main 是 IPC Facade，不是业务层**。所有数据聚合、字段裁剪、分页、搜索高亮都交给 BFF。

2. **Main 只保留三类逻辑**：IPC 暴露、Electron 运行时能力、安全隔离（文件写入）。

3. **BFF 是 CLI 和 Electron 的共享契约层**。两端消费同一套 DTO，不再各自发明。

4. **Core 是中性数据层**。不返回 `ThoughtDTO`、`ThoughtSummaryDTO`，只返回 record / id / raw match。

5. **跨边界接口（如 asset.save）需要明确分工**：Main 负责文件系统操作，BFF 负责业务逻辑和契约。

6. **当前 v2 设计中的 `types.ts` 是过渡方案**。等 `packages/server/bff` 正式输出类型后，`main/services/types.ts` 应替换为从 `@reflecta/server/bff` 导入。
