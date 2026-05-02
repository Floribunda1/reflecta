# Renderer 前端 API 与类型汇总

> 本文档基于 `apps/electron/src/renderer/` 目录下的前端源码整理，涵盖所有通过 IPC 调用的后端 API，以及前端使用的类型定义（包含 `@shared/*` 包类型和本地定义的类型）。

---

## 一、IPC 通信机制

前端通过 `electron-ipc-decorator` 的客户端代理调用主进程服务：

```ts
// src/utils/ipc.ts
import { createIpcProxy } from "electron-ipc-decorator/client";
export const ipcClient = createIpcProxy<IpcServices>(window.ipcRenderer)!;
```

所有 API 均通过 `ipcClient.<service>.<method>()` 的形式调用。

---

## 二、API 按服务分类

### 2.1 Category 服务 (`ipcClient.category`)

| 方法                                  | 参数                                                         | 返回值                 | 使用位置               |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------- | ---------------------- |
| `listCategories()`                    | —                                                            | `CategoryWithCounts[]` | `use-category.ts`      |
| `createCategory(input)`               | `{ name: string; parentId: string \| null }`                 | —                      | `category/context.tsx` |
| `updateCategory(id, input)`           | `id: string`, `{ name?: string; parentId?: string \| null }` | —                      | `category/context.tsx` |
| `deleteCategory(id, deleteThoughts?)` | `id: string`, `deleteThoughts?: boolean`                     | —                      | `category/context.tsx` |
| `reorderCategories(items)`            | `ReorderCategoryItem[]`                                      | —                      | `category/context.tsx` |

### 2.2 Thought 服务 (`ipcClient.thought`)

| 方法                            | 参数                                                                                               | 返回值                      | 使用位置                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `listThoughts(filter?)`         | `filter?: { categoryId?, includeDescendants?: boolean, type?: ThoughtType, searchQuery?: string }` | `ThoughtSummaryDTO[]`       | 多处（见下文）                                                   |
| `getThoughtById(id)`            | `id: string`                                                                                       | `ThoughtDTO`                | `capture/index.tsx`, `thought-detail/context.tsx`                |
| `createThought(input)`          | `{ type: ThoughtType; body: string; categoryIds?: string[] }`                                      | `ThoughtDTO`                | `thought-list/context.tsx`, `contemplate/filter-panel/index.tsx` |
| `updateThought(id, input)`      | `id: string`, `{ type?, title?, body?, categoryIds? }`                                             | `ThoughtDTO`                | `thought-detail/context.tsx`                                     |
| `deleteThought(id)`             | `id: string`                                                                                       | —                           | `thought-list/context.tsx`, `ThoughtDetail.tsx`                  |

**`listThoughts` 使用位置汇总：**

- `modules/capture/thought-list/context.tsx` — 按分类、类型、搜索词筛选
- `modules/contemplate/graph/useThoughtsQuery.ts` — 按分类获取图谱数据（支持多分类并行）
- `modules/shared/components/md-editor/index.tsx` — WikiLink 自动补全时搜索
- `modules/shared/biz-components/GlobalSearch.tsx` — 全局搜索（通过 `search.search` 间接使用）

### 2.3 Context 服务 (`ipcClient.context`)

| 方法                           | 参数                                                 | 返回值                | 使用位置                     |
| ------------------------------ | ---------------------------------------------------- | --------------------- | ---------------------------- |
| `createContext(input)`         | `{ thoughtId, sourceType, sourceName?, content }`    | —                     | `thought-detail/context.tsx` |
| `updateContext(id, input)`     | `id: string`, `{ sourceType, sourceName?, content }` | —                     | `thought-detail/context.tsx` |
| `deleteContext(id)`            | `id: string`                                         | —                     | `thought-detail/context.tsx` |
| `listTrashedContexts()`        | —                                                    | `TrashedContextDTO[]` | `settings/TrashSection.tsx`  |
| `restoreContext(id)`           | `id: string`                                         | —                     | `settings/TrashSection.tsx`  |
| `permanentlyDeleteContext(id)` | `id: string`                                         | —                     | `settings/TrashSection.tsx`  |

### 2.4 Search 服务 (`ipcClient.search`)

| 方法            | 参数            | 返回值                                                            | 使用位置           |
| --------------- | --------------- | ----------------------------------------------------------------- | ------------------ |
| `search(query)` | `query: string` | `{ thoughts: ThoughtSummaryDTO[]; contexts: FtsContextResult[] }` | `GlobalSearch.tsx` |

### 2.5 AI 服务 (`ipcClient.ai`)

| 方法                                 | 参数                                        | 返回值   | 使用位置            |
| ------------------------------------ | ------------------------------------------- | -------- | ------------------- |
| `generateSummary(content, contexts)` | `content: string`, `contexts: ContextDTO[]` | `string` | `ThoughtDetail.tsx` |

### 2.6 Config 服务 (`ipcClient.config`)

| 方法                    | 参数                         | 返回值                                               | 使用位置                      |
| ----------------------- | ---------------------------- | ---------------------------------------------------- | ----------------------------- |
| `getConfig()`           | —                            | `{ storagePath: string; isCustomPath: boolean }`     | `settings/StorageSection.tsx` |
| `getAiConfig()`         | —                            | `{ apiKey: string; baseUrl: string; model: string }` | `settings/AiSection.tsx`      |
| `setAiConfig(config)`   | `{ apiKey, baseUrl, model }` | —                                                    | `settings/AiSection.tsx`      |
| `setStoragePath(path)`  | `path: string`               | —                                                    | `settings/StorageSection.tsx` |
| `openDirectoryPicker()` | —                            | `string \| null`                                     | `settings/StorageSection.tsx` |
| `restartApp()`          | —                            | —                                                    | `settings/StorageSection.tsx` |

### 2.7 Asset 服务 (`ipcClient.asset`)

| 方法                           | 参数                                 | 返回值              | 使用位置                      |
| ------------------------------ | ------------------------------------ | ------------------- | ----------------------------- |
| `saveAsset(base64, filename)`  | `base64: string`, `filename: string` | `string` (asset id) | `md-editor/index.tsx`         |
| `scanOrphanAssets()`           | —                                    | `OrphanAssetInfo[]` | `settings/StorageSection.tsx` |
| `cleanOrphanAssets(filenames)` | `filenames: string[]`                | —                   | `settings/StorageSection.tsx` |
| `openAsset(filename)`          | `filename: string`                   | —                   | `settings/StorageSection.tsx` |
| `revealAsset(filename)`        | `filename: string`                   | —                   | `settings/StorageSection.tsx` |

### 2.8 Trash 服务 (`ipcClient.trash`)

| 方法                           | 参数         | 返回值                | 使用位置                    |
| ------------------------------ | ------------ | --------------------- | --------------------------- |
| `listTrashedThoughts()`        | —            | `TrashedThoughtDTO[]` | `settings/TrashSection.tsx` |
| `restoreThought(id)`           | `id: string` | —                     | `settings/TrashSection.tsx` |
| `permanentlyDeleteThought(id)` | `id: string` | —                     | `settings/TrashSection.tsx` |

---

## 三、外部类型定义 (`@shared/*`)

### 3.1 `@shared/thought`

```ts
type ThoughtType = "idea" | "insight";

interface ThoughtSummaryDTO {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contexts: ContextDTO[];
  connections: ConnectionDTO[]; // 所有关联当前 thought 的连接
  referencedBy: ConnectionDTO[]; // 被引用
  createdAt: string;
  updatedAt: string;
}

interface ThoughtDTO {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contexts: ContextDTO[];
  connections: ConnectionDTO[];
  referencedBy: ConnectionDTO[];
  createdAt: string;
  updatedAt: string;
}

interface CreateThoughtInput {
  type: ThoughtType;
  body: string;
  categoryIds?: string[];
}
```

### 3.2 `@shared/context`

```ts
type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";

interface ContextDTO {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateContextInput {
  thoughtId: string;
  sourceType: SourceType;
  sourceName?: string;
  content: string;
}

interface UpdateContextInput {
  sourceType: SourceType;
  sourceName?: string;
  content: string;
}
```

### 3.3 `@shared/category`

```ts
interface CategoryWithCounts {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

interface CategoryTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
}

interface ReorderCategoryItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
}
```

### 3.4 `@shared/search`

```ts
interface FtsContextResult {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  snippet: string; // 高亮片段（HTML）
}
```

### 3.5 `@shared/trash`

```ts
interface TrashedThoughtDTO {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  deletedAt: string;
}

interface TrashedContextDTO {
  id: string;
  thoughtTitle: string | null;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  deletedAt: string;
}
```

### 3.6 `@shared/asset`

```ts
interface OrphanAssetInfo {
  filename: string;
  size: number;
}
```

---

## 四、前端本地类型与工具

### 4.1 数据查询 Hook 相关

```ts
// modules/capture/thought-list/context.tsx
export type FilterMode = "all" | "idea" | "insight";
export type SortMode = "created" | "updated";
```

### 4.2 图谱数据类型

```ts
// modules/contemplate/graph/data.ts
export interface G6NodeData {
  id: string;
  data: {
    thoughtType: string;
    title: string;
    body: string;
    inDegree: number;
  };
  style: {
    size: number;
    fill: string;
    stroke: string;
    labelText: string;
    x?: number;
    y?: number;
  };
}

export interface G6EdgeData {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface G6Data {
  nodes: G6NodeData[];
  edges: G6EdgeData[];
}
```

### 4.3 节点浮动提示

```ts
// modules/contemplate/graph/NodePopover.tsx
export interface NodePopoverData {
  title: string;
  body: string;
}
```

### 4.4 WikiLink 工具类型

```ts
// modules/shared/components/wiki-links.ts
export type ThoughtWikiLink = {
  title: string;
  id: string;
};
```

### 4.5 分类树选择器

```ts
// modules/shared/biz-components/CategoryTreeSelect.tsx
export interface TreeSelectNode {
  key: string;
  label: string;
  pathLabel: string;
  children?: TreeSelectNode[];
}
```

### 4.6 Context 来源元数据

```ts
// modules/capture/thought-detail/context/types.ts
export const SOURCE_META: Record<SourceType, { label: string; icon: string }>;
export const SOURCE_PLACEHOLDER: Record<SourceType, string>;
export const SOURCE_TYPES: SourceType[];
```

---

## 五、前端状态管理（Vue Query）

前端大量使用 `@tanstack/vue-query` 管理服务端状态，主要 Query Key 约定如下：

| Query Key                               | 说明                          | 刷新操作                             |
| --------------------------------------- | ----------------------------- | ------------------------------------ |
| `["category.listCategories"]`           | 分类树数据                    | 增删改分类后 `refetch`               |
| `["thought.listThoughts", ...]`         | Thought 列表                  | 增删改后 `invalidateQueries`         |
| `["thought.getThoughtById", thoughtId]` | Thought 详情                  | 更新后乐观更新 + `invalidateQueries` |
| `["contemplate.listThoughts", ...]`     | 关联图谱数据                  | 增删改后 `invalidateQueries`         |
| `["search", query]`                     | 全局搜索（有 `enabled` 条件） | —                                    |

---

## 六、按模块调用关系速查

| 模块                                | 调用的 API 服务                                                                                                                                                             | 使用的关键类型                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `capture/category`                  | `category.*`                                                                                                                                                                | `CategoryTreeNode`, `ReorderCategoryItem`, `CategoryWithCounts`                                            |
| `capture/thought-list`              | `thought.listThoughts`, `thought.createThought`, `thought.deleteThought`                                                                                                    | `ThoughtSummaryDTO`, `ThoughtType`, `CreateThoughtInput`                                                   |
| `capture/thought-detail`            | `thought.getThoughtById`, `thought.updateThought`, `thought.deleteThought`, `context.createContext`, `context.updateContext`, `context.deleteContext`, `ai.generateSummary` | `ThoughtDTO`, `ThoughtSummaryDTO`, `ThoughtType`, `ContextDTO`, `CreateContextInput`, `UpdateContextInput` |
| `capture/thought-detail/context`    | —（通过父 context 调用）                                                                                                                                                    | `ContextDTO`, `SourceType`                                                                                 |
| `capture/thought-detail/connection` | —（纯展示）                                                                                                                                                                 | `ThoughtSummaryDTO`, `ThoughtType`                                                                         |
| `contemplate/graph`                 | `thought.listThoughts`                                                                                                                                                      | `ThoughtSummaryDTO`, `G6Data`, `G6NodeData`, `G6EdgeData`                                                  |
| `contemplate/filter-panel`          | `thought.createThought`                                                                                                                                                     | `ThoughtType`                                                                                              |
| `settings/StorageSection`           | `config.*`, `asset.*`                                                                                                                                                       | `OrphanAssetInfo`                                                                                          |
| `settings/AiSection`                | `config.getAiConfig`, `config.setAiConfig`                                                                                                                                  | —                                                                                                          |
| `settings/TrashSection`             | `trash.*`, `context.listTrashedContexts`, `context.restoreContext`, `context.permanentlyDeleteContext`                                                                      | `TrashedThoughtDTO`, `TrashedContextDTO`                                                                   |
| `shared/md-editor`                  | `thought.getThoughtById`, `thought.listThoughts`, `asset.saveAsset`                                                                                                         | `ThoughtSummaryDTO`                                                                                        |
| `shared/md-preview`                 | `thought.getThoughtById`                                                                                                                                                    | —                                                                                                          |
| `shared/GlobalSearch`               | `search.search`                                                                                                                                                             | `ThoughtSummaryDTO`, `ThoughtType`, `FtsContextResult`                                                     |
| `shared/CategoryTreeSelect`         | —（通过 `useCategoryData`）                                                                                                                                                 | `CategoryTreeNode`                                                                                         |
| `shared/use-category`               | `category.listCategories`                                                                                                                                                   | `CategoryTreeNode`, `CategoryWithCounts`                                                                   |
