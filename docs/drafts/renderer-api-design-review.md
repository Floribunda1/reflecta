# Renderer 前端 API 设计 Review

> 基于 `apps/electron/src/main/services/` 和 `apps/electron/src/renderer/src/` 的完整分析，从 **DX（开发者体验）**、**Performance（性能）**、**UX（用户体验）** 三个维度给出评价和重构建议。

---

## 一、当前 API 总览

```
category.*        → list, create, update, delete, reorder
thought.*         → list, getById, create, update, delete, restore, permanentlyDelete,
                    addConnection, removeConnection, resolveWikiLinkTarget
context.*         → listByThought, create, update, delete, restore, permanentlyDelete,
                    listTrashed
search.*          → searchThoughts, searchContexts, search
ai.*              → generateSummary
config.*          → getConfig, setStoragePath, openDirectoryPicker, restartApp,
                    getAiConfig, setAiConfig
asset.*           → saveAsset, scanOrphanAssets, cleanOrphanAssets, openAsset, revealAsset
trash.*           → listTrashedThoughts, restoreThought, permanentlyDeleteThought
```

---

## 二、DX（开发者体验）Review

### 2.1 评分：6/10

**好的地方：**

- `electron-ipc-decorator` 提供了类型安全的 IPC 调用，告别字符串 channel
- `@shared/*` + `@reflecta/server` 保证前后端类型同源
- 命名基本直观，`list`/`get`/`create`/`update`/`delete` 语义清晰

**问题：**

### DX-1. 资源边界混乱 — "回收站到底在哪？"

```ts
// Thought 的回收站操作分散在两个 service
ipcClient.trash.listTrashedThoughts();
ipcClient.trash.restoreThought(id);
ipcClient.trash.permanentlyDeleteThought(id);
// BUT ThoughtService 里也有（但前端从未调用）：
ipcClient.thought.restoreThought(id);
ipcClient.thought.permanentlyDeleteThought(id);

// Context 的回收站全在 ContextService
ipcClient.context.listTrashedContexts();
ipcClient.context.restoreContext(id);
ipcClient.context.permanentlyDeleteContext(id);
```

**DX 痛点**：开发者需要记住两套规则。同样是回收站，Thought 走 `trash.*`，Context 走 `context.*`。这是认知负担。

**建议**：统一 Trash 域。

```ts
// 统一 Trash 服务（推荐）
trash.listThoughts(); // 替代 trash.listTrashedThoughts
trash.listContexts(); // 替代 context.listTrashedContexts
trash.restoreThought(id);
trash.restoreContext(id); // 从 context 迁移过来
trash.deleteThoughtPermanently(id);
trash.deleteContextPermanently(id);
trash.empty(); // 新增：一键清空

// 从 ThoughtService / ContextService 中移除 restore / permanentlyDelete
```

### DX-2. 查询接口过载 — `listThoughts` 是"万能接口"

```ts
// 当前 filter 承载的职责：
interface ListThoughtsFilter {
  categoryId?: string;
  includeDescendants?: boolean;
  type?: ThoughtType;
  searchQuery?: string; // 全文搜索
}
```

这个接口同时被用于：

1. **分类列表页** — 按分类 + 类型展示
2. **WikiLink 补全** — 用户输入 `[[` 后的实时建议
3. **全局搜索** — 但全局搜索实际走了 `search.search()`

**DX 痛点**：

- 不同场景的优化方向不同（列表要分页、搜索要高亮、补全要限制数量），硬塞进一个接口导致后端实现妥协
- 新增查询维度时 filter 会不断膨胀

**建议**：按场景拆分。

```ts
// 1. 列表查询（分类页、图谱页）
thoughts.query({
  categoryId?: string;
  categoryIds?: string[];        // 支持多分类，替代前端 N 次请求
  includeDescendants?: boolean;
  type?: ThoughtType;
  sortBy?: 'created' | 'updated';
  order?: 'asc' | 'desc';
  limit?: number;                // 分页
  offset?: number;
}): Promise<{ items: ThoughtListItem[]; total: number }>

// 2. 搜索建议（WikiLink 补全）
search.suggest(query: string, options?: { limit?: number })
  : Promise<SuggestItem[]>

// 3. 移除 thought.listThoughts 的 searchQuery 参数
```

### DX-3. 返回类型不一致

| 操作    | Thought      | Context      | Category   |
| ------- | ------------ | ------------ | ---------- |
| Create  | `ThoughtDTO` | `ContextDTO` | `Category` |
| Update  | `ThoughtDTO` | `ContextDTO` | `Category` |
| Delete  | `void`       | `void`       | `void`     |
| Reorder | —            | —            | `void`     |

**DX 痛点**：写前端 mutation 时，有的可以乐观更新（拿到返回值），有的不能。开发者必须逐个查类型定义。

**建议**：写操作统一返回更新后的实体。

```ts
// 统一契约：CUD 都返回操作后的完整实体
create → Entity
update → Entity
delete → { id: string; deletedAt: string }   // 软删除返回带标记的实体
reorder → Category[]   // 返回重排后的完整树
```

### DX-4. 写接口缺少批量操作

```ts
// 当前回收站清空，前端自己循环：
await Promise.all([
  ...thoughts.map((t) => ipcClient.trash.permanentlyDeleteThought(t.id)),
  ...contexts.map((c) => ipcClient.context.permanentlyDeleteContext(c.id)),
]);
// 100 条 = 100 次 IPC 往返
```

**建议**：

```ts
trash.empty()                           // 一键清空
trash.deleteThoughtsPermanently(ids[])  // 批量永久删除
contexts.deleteMany(ids[])              // 批量删除
categories.deleteMany(ids[])            // 批量删除
```

### DX-5. ConfigService 职责混杂

```ts
// 当前 ConfigService 混了三种东西：
config.getConfig(); // 纯配置读取
config.setStoragePath(path); // 配置写入
config.getAiConfig(); // 配置读取
config.setAiConfig(config); // 配置写入
config.openDirectoryPicker(); // 对话框/UI 能力
config.restartApp(); // 应用生命周期
```

**建议**：拆分为三个域。

```ts
// 纯配置
cfg.getStorage() -> { path, isCustom }
cfg.setStorage(path)
cfg.getAiProvider() -> AiProviderConfig
cfg.setAiProvider(config)

// 对话框
dialog.pickDirectory() -> string | null

// 应用生命周期
app.restart()
```

### DX-6. SearchService 接口冗余

```ts
search.searchThoughts(query, options?)   // 前端未使用
search.searchContexts(query, options?)   // 前端未使用
search.search(query, options?)           // 前端唯一使用的
```

`search.search` 已经返回 `{ thoughts: [], contexts: [] }`，前两个方法增加了维护负担。

**建议**：移除未使用的 `searchThoughts` / `searchContexts`。

### DX-7. DTO 命名和粒度问题

```ts
// ThoughtSummaryDTO 里包含了完整嵌套：
interface ThoughtSummaryDTO {
  id;
  type;
  title;
  body;
  categoryIds;
  contexts: ContextDTO[]; // 完整嵌套
  connections: ConnectionDTO[]; // 完整嵌套
  referencedBy: ConnectionDTO[]; // 完整嵌套
  createdAt;
  updatedAt;
}
```

**DX 痛点**：

- "Summary" 语义是"摘要"，但实际返回了完整嵌套数据
- 列表页只需要 `contextCount` 和 `connectionCount`
- `ThoughtDTO` 和 `ThoughtSummaryDTO` 字段 90% 重叠，维护时要改两处

**建议**：

```ts
// 列表项 — 轻量
interface ThoughtListItem {
  id: string;
  type: ThoughtType;
  title: string | null;
  bodyPreview: string; // 列表只需要前 200 字
  categoryIds: string[];
  contextCount: number;
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

// 详情 — 完整嵌套
interface ThoughtDetail {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contexts: ContextDTO[];
  connections: ThoughtConnection[];
  referencedBy: ThoughtConnection[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 三、Performance Review

### 3.1 评分：6.5/10

**好的地方：**

- 分类树在前端缓存
- G6 图表数据结构对比避免不必要的重渲染
- 多分类并行请求

### PERF-1. 列表查询返回过重数据

`ThoughtSummaryDTO` 在列表中返回完整的 `contexts` 和 `connections` 数组。

以 100 条 thought、每条 5 个 context、5 个 connection 计算：

- 额外传输：100 x (5 + 5) = 1000 个嵌套对象
- 前端渲染 ThoughtCard 时只用了 `contexts.length` 和 `connections.length`

**建议**：列表接口返回 count，详情接口再拉完整嵌套（见 DX-7）。

### PERF-2. 无分页/限制

```ts
thought.listThoughts(filter?)  // 没有 limit，可能一次性返回全表
search.search(query)           // 没有 limit，全文搜索可能返回上千条
```

**建议**：所有列表类接口都加上 `limit` + `offset`。

```ts
interface QueryOptions {
  limit?: number;   // default: 50, max: 200
  offset?: number;  // default: 0
}

thoughts.query(filter, options?) -> { items: ThoughtListItem[]; total: number }
search.search(query, options?) -> { thoughts: []; contexts: []; total: number }
```

### PERF-3. 多分类查询是 N 次 IPC

```ts
// useThoughtsQuery.ts
const batches = await Promise.all(
  catIds.map(id => ipcClient.thought.listThoughts({ categoryId: id, ... }))
);
// 5 个分类 = 5 次 IPC + 5 次 SQL + 前端合并去重
```

**建议**：后端直接支持多分类 ID 查询。

```ts
thoughts.query({ categoryIds: ["a", "b", "c"], includeDescendants: true });
// 后端一次 SQL 用 IN 查询，天然去重
```

### PERF-4. WikiLink 补全没有 debounce + 全量 fallback

```ts
// md-editor/index.tsx
result = await ipcClient.thought.listThoughts(query ? { searchQuery: query } : undefined);
// catch 后又请求一次全部
result = await ipcClient.thought.listThoughts();
```

- 无 debounce：快速输入发多次请求
- catch 后 fallback 到全量：如果数据库大，雪上加霜

**建议**：

- 前端 debounce 150ms
- 后端提供 `search.suggest(query, limit = 8)`，只返回 id + title + bodyPreview
- 后端失败时前端不应 fallback 到全量查询

### PERF-5. Base64 传输文件

```ts
asset.saveAsset(base64: string, filename: string) -> string
```

Base64 比原始二进制大 33%，且需要编解码。

**建议**：Electron IPC 支持 ArrayBuffer 传输。

```ts
asset.saveAsset(data: ArrayBuffer, filename: string) -> string
```

### PERF-6. `updateThought` 导致读写放大

```ts
await updateThought(id, { body });
// 1. 一次 updateThought IPC（写）
// 2. 乐观更新 setQueryData（本地）
// 3. invalidateQueries 触发：
//    - getThoughtById 重新请求（读）
//    - listThoughts 重新请求（读）
//    - contemplate.listThoughts 重新请求（读）
```

用户编辑 body 时，每次 debounce 保存触发 1 写 + 3 读。

**建议**：

- body 更新不 invalidate `listThoughts`（如果列表不依赖 body snippet 排序）
- 或者列表排序字段独立，不依赖 `updatedAt`
- 引入 `thoughts.patch(id, partial)` 语义，明确哪些是"静默更新"

---

## 四、UX（用户体验）Review

### 4.1 评分：7/10

**好的地方：**

- 乐观更新让用户感知流畅
- WikiLink 自动补全 + Cmd+Click 跳转是完整的双向链接体验
- 分类树拖拽重排直观

### UX-1. 写后同步策略不统一

同一个应用里，不同模块用了三种刷新策略：

```ts
// A. 乐观更新 + 延迟失效（thought-detail）
setQueryData(...) + invalidateQueries(...)

// B. 立即失效 + 重新拉取（context CRUD）
invalidateQueries(...) + await refetch()

// C. 手动刷新（category）
await refresh()
```

**UX 影响**：

- 编辑 Context 后，用户可能看到旧数据闪烁
- 编辑 Thought body 后，列表可能闪烁

**建议**：统一为两层策略。

```ts
// 简单字段（title, categoryIds, type）-> 纯乐观更新
// 复杂字段（body）-> 乐观更新 + 静默后台同步（不触发列表闪烁）
// 删除/创建 -> invalidate + 乐观移除/插入
```

### UX-2. AI 生成摘要失败零反馈

```ts
try {
  const summary = await ipcClient.ai.generateSummary(...)
} catch (e: any) {
  console.error("生成摘要失败", e);  // 用户看不到
}
```

**建议**：IPC 层统一封装错误处理。

```ts
const ipcClient = createIpcProxy<IpcServices>(window.ipcRenderer, {
  onError: (error, service, method) => {
    toast.add({ severity: "error", summary: `${service}.${method} 失败`, detail: error.message });
  },
});
```

### UX-3. 存储路径修改需手动重启

```ts
await ipcClient.config.setStoragePath(picked);
// 显示 banner，让用户自己点"重启"
```

**建议**：提供一键"保存并重启"。

```ts
await cfg.setStorage(path);
confirm.require({
  message: "存储路径已更改，需要重启生效。立即重启？",
  accept: () => app.restart(),
});
```

### UX-4. 搜索无结果上限

```ts
search.search(query); // 没有 limit
```

用户搜索常用词可能返回几百上千条，前端一次性渲染卡顿。

**建议**：默认 `limit: 20`，支持"加载更多"。

### UX-5. 分类删除的级联行为不明确

```ts
deleteCategory(id, (deleteThoughts = false));
```

第二个参数是 boolean，调用时 `deleteCategory(id, true)` 可读性差。

**建议**：用 options 对象或拆分方法。

```ts
deleteCategory(id, { mode: "uncategorize" | "cascade" });
// 或
deleteCategory(id); // 默认 uncategorize
deleteCategoryWithThoughts(id); // 级联删除
```

---

## 五、重构建议汇总（按优先级）

### P0 — 立即修复

| 问题           | 当前                   | 建议                   |
| -------------- | ---------------------- | ---------------------- |
| 返回类型不一致 | create/delete 类型混乱 | 统一返回更新后实体     |
| 查询接口过载   | listThoughts 万能接口  | 拆分为 query + suggest |
| Base64 传输    | saveAsset(base64)      | 改为 ArrayBuffer       |
| 搜索无上限     | search() 无 limit      | 默认 limit=20          |

### P1 — 近期重构

| 问题            | 当前                                     | 建议                     |
| --------------- | ---------------------------------------- | ------------------------ |
| 回收站边界混乱  | Thought 在 trash._，Context 在 context._ | 统一 trash.\*            |
| Config 混杂     | 混了配置/对话框/生命周期                 | 拆为 cfg / dialog / app  |
| 批量操作缺失    | 前端循环 N+1                             | 后端支持批量/empty       |
| DTO 粒度        | Summary 返回完整嵌套                     | 列表用 count，详情用嵌套 |
| 多分类 N 次请求 | categoryIds 逐个请求                     | 后端支持 categoryIds[]   |

### P2 — 长期优化

| 问题         | 当前            | 建议                      |
| ------------ | --------------- | ------------------------- |
| 写后同步策略 | 三种策略混用    | 统一 mutation 封装        |
| 分页         | 无分页          | 所有列表接口加分页        |
| 增量更新     | 每次传整棵树    | 考虑增量同步              |
| 实时同步     | 全靠 invalidate | 考虑 events/subscriptions |
