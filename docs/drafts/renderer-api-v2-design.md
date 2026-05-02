# Reflecta API v2 类型设计与前端适配方案

> 基于 `renderer-api-design-review.md` 的重构建议，从零设计新的 API 类型契约与前端架构。不参考现有实现，只追求设计本身的简洁性和一致性。

---

## 一、设计原则

1. **单一职责**：一个接口只做一件事，拒绝"万能接口"
2. **写操作统一回显**：所有 `create`/`update`/`delete`/`reorder` 都返回更新后的实体
3. **列表轻量、详情完整**：列表 DTO 只给渲染列表所需的最小数据
4. **批量优先**：任何可能批量操作的场景，API 都提供批量接口
5. **资源边界清晰**：回收站是独立领域，不散落在各服务中
6. **错误即契约**：API 错误携带 `code` + `message` + `details`，前端统一处理

---

## 二、核心类型（@shared/common）

### 2.1 分页

```ts
// shared/common/pagination.ts
export interface PageOptions {
  limit?: number; // default: 50, max: 200
  offset?: number; // default: 0
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CursorPageOptions {
  limit?: number; // default: 50, max: 200
  cursor?: string; // opaque cursor
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

### 2.2 时间戳 mixin

```ts
// shared/common/timestamp.ts
export interface Timestamped {
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### 2.3 API 错误

```ts
// shared/common/error.ts
export interface ApiError {
  code: string; // 机器可读错误码，如 "CATEGORY_NOT_FOUND"
  message: string; // 人类可读描述
  details?: Record<string, unknown>;
}
```

---

## 三、Thought 领域（@shared/thought）

### 3.1 枚举与基础类型

```ts
// shared/thought/type.ts
export type ThoughtType = "idea" | "insight";

export interface ThoughtConnection {
  id: string;
  sourceId: string;
  targetId: string;
}
```

### 3.2 列表项 DTO — 轻量

```ts
// shared/thought/list-item.ts
export interface ThoughtListItem {
  id: string;
  type: ThoughtType;
  title: string | null;
  bodyPreview: string; // 列表渲染只需前 ~200 字
  categoryIds: string[];
  contextCount: number; // 替代完整 contexts[]
  connectionCount: number; // 替代完整 connections[]
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 详情 DTO — 完整嵌套

```ts
// shared/thought/detail.ts
import type { ContextItem } from "../context/item";

export interface ThoughtDetail {
  id: string;
  type: ThoughtType;
  title: string | null;
  body: string;
  categoryIds: string[];
  contexts: ContextItem[]; // 完整嵌套
  connections: ThoughtConnection[]; // outgoing
  referencedBy: ThoughtConnection[]; // incoming
  createdAt: string;
  updatedAt: string;
}
```

### 3.4 查询参数

```ts
// shared/thought/query.ts
export interface ThoughtQueryFilter {
  categoryId?: string;
  categoryIds?: string[]; // 支持多分类，替代前端 N 次请求
  includeDescendants?: boolean; // 与 categoryId 配合生效
  type?: ThoughtType;
}

export interface ThoughtQueryOptions extends PageOptions {
  sortBy?: "created" | "updated";
  order?: "asc" | "desc";
}

export interface ThoughtQueryRequest {
  filter?: ThoughtQueryFilter;
  options?: ThoughtQueryOptions;
}
```

### 3.5 写操作输入

```ts
// shared/thought/input.ts
export interface CreateThoughtInput {
  type: ThoughtType;
  body: string;
  categoryIds?: string[];
}

export interface UpdateThoughtInput {
  type?: ThoughtType;
  title?: string | null;
  body?: string;
  categoryIds?: string[];
}

export interface PatchThoughtInput {
  // 用于静默更新（如 auto-save body），不触发列表刷新
  title?: string | null;
  body?: string;
}
```

---

## 四、Context 领域（@shared/context）

### 4.1 枚举与基础类型

```ts
// shared/context/type.ts
export type SourceType = "experience" | "video" | "book" | "article" | "opinion" | "ai";
```

### 4.2 DTO

```ts
// shared/context/item.ts
export interface ContextItem {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.3 写操作输入

```ts
// shared/context/input.ts
export interface CreateContextInput {
  thoughtId: string;
  sourceType: SourceType;
  sourceName?: string;
  content: string;
}

export interface UpdateContextInput {
  sourceType: SourceType;
  sourceName?: string;
  content: string;
}
```

### 4.4 批量删除

```ts
// shared/context/batch.ts
export interface DeleteContextsRequest {
  ids: string[];
}

export interface DeleteContextsResult {
  deletedIds: string[];
  notFoundIds: string[];
}
```

---

## 五、Category 领域（@shared/category）

### 5.1 DTO

```ts
// shared/category/type.ts
export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// 扁平列表（后端返回原始数据，前端自行建树）
export interface CategoryFlatNode extends Category {
  thoughtCount: number; // 该分类下的 thought 数量
  descendantCount: number; // 包含子分类的总数
}

// 树节点（前端转换后使用，后端不直接返回）
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}
```

### 5.2 写操作输入

```ts
// shared/category/input.ts
export interface CreateCategoryInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  parentId?: string | null;
}

export interface ReorderCategoryItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

export interface ReorderCategoriesInput {
  items: ReorderCategoryItem[];
}
```

### 5.3 删除选项

```ts
// shared/category/delete.ts
export interface DeleteCategoryOptions {
  mode: "uncategorize" | "cascade"; // 默认 uncategorize
}
```

### 5.4 批量删除

```ts
// shared/category/batch.ts
export interface DeleteCategoriesRequest {
  ids: string[];
  mode?: "uncategorize" | "cascade";
}

export interface DeleteCategoriesResult {
  deletedIds: string[];
  uncategorizedIds?: string[]; // mode=uncategorize 时返回被去分类的 thought ids
}
```

---

## 六、Search 领域（@shared/search）

### 6.1 搜索建议（WikiLink 补全）

```ts
// shared/search/suggest.ts
export interface SuggestItem {
  id: string;
  title: string | null;
  bodyPreview: string; // ~100 字预览
}

export interface SuggestOptions {
  limit?: number; // default: 8
}
```

### 6.2 全局搜索

```ts
// shared/search/result.ts
export interface SearchThoughtResult {
  id: string;
  type: ThoughtType;
  title: string | null;
  bodySnippet: string; // 高亮片段（HTML）
  categoryIds: string[];
  updatedAt: string;
}

export interface SearchContextResult {
  id: string;
  thoughtId: string;
  sourceType: SourceType;
  sourceName: string | null;
  snippet: string; // 高亮片段（HTML）
}

export interface SearchRequest {
  query: string;
  options?: PageOptions; // 分页，默认 limit=20
}

export interface SearchResult {
  thoughts: SearchThoughtResult[];
  contexts: SearchContextResult[];
  totalThoughts: number;
  totalContexts: number;
}
```

---

## 七、Trash 领域（@shared/trash）

统一回收站。Thought 和 Context 的回收站操作全部集中于此。

```ts
// shared/trash/type.ts

export interface TrashedThought {
  id: string;
  type: ThoughtType;
  title: string | null;
  bodyPreview: string;
  deletedAt: string;
}

export interface TrashedContext {
  id: string;
  thoughtId: string;
  thoughtTitle: string | null;
  sourceType: SourceType;
  sourceName: string | null;
  contentPreview: string;
  deletedAt: string;
}

export interface TrashContents {
  thoughts: TrashedThought[];
  contexts: TrashedContext[];
}

// 写操作返回被恢复的实体，方便前端乐观更新
export interface RestoreResult {
  thought?: ThoughtListItem; // restoreThought 时返回
  context?: ContextItem; // restoreContext 时返回
}

export interface BulkDeleteResult {
  deletedThoughtIds: string[];
  deletedContextIds: string[];
  notFoundIds: string[];
}
```

---

## 八、Asset 领域（@shared/asset）

```ts
// shared/asset/type.ts
export interface AssetInfo {
  id: string; // 文件名 / 存储 ID
  filename: string; // 原始文件名
  size: number;
  mimeType?: string;
}

export interface OrphanAssetInfo {
  id: string;
  filename: string;
  size: number;
}

export interface SaveAssetResult {
  id: string;
  url: string; // asset:///id
}
```

**注意**：`saveAsset` 的输入从 `base64: string` 改为 `data: ArrayBuffer`，减少 33% 传输开销。

---

## 九、Config / Dialog / App 领域

将原来的 `config.*` 拆分为三个独立域。

### 9.1 Config（纯配置）

```ts
// shared/config/type.ts
export interface StorageConfig {
  path: string;
  isCustom: boolean;
}

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}
```

### 9.2 Dialog（系统对话框）

```ts
// shared/dialog/type.ts
export interface PickDirectoryOptions {
  title?: string;
  defaultPath?: string;
}

export interface PickDirectoryResult {
  canceled: boolean;
  path: string | null;
}
```

### 9.3 App（应用生命周期）

```ts
// shared/app/type.ts
export interface AppInfo {
  version: string;
}
```

---

## 十、AI 领域（@shared/ai）

```ts
// shared/ai/type.ts
export interface GenerateSummaryRequest {
  content: string;
  contexts?: Array<{
    sourceType: SourceType;
    sourceName: string | null;
    content: string;
  }>;
}

export interface GenerateSummaryResult {
  summary: string;
}
```

---

## 十一、IPC Service 接口定义（前端调用契约）

这是前端通过 `ipcClient` 可调用的完整接口定义。

```ts
// 假设 electron-ipc-decorator 生成如下 proxy 结构

interface ThoughtService {
  query(req: ThoughtQueryRequest): Promise<Page<ThoughtListItem>>;
  getById(id: string): Promise<ThoughtDetail | null>;
  create(input: CreateThoughtInput): Promise<ThoughtDetail>;
  update(id: string, input: UpdateThoughtInput): Promise<ThoughtDetail>;
  patch(id: string, input: PatchThoughtInput): Promise<ThoughtDetail>;
  delete(id: string): Promise<ThoughtListItem>; // 返回被删除的实体（含 deletedAt）
  addConnection(sourceId: string, targetId: string): Promise<ThoughtConnection>;
  removeConnection(sourceId: string, targetId: string): Promise<void>;
}

interface ContextService {
  create(input: CreateContextInput): Promise<ContextItem>;
  update(id: string, input: UpdateContextInput): Promise<ContextItem>;
  delete(id: string): Promise<ContextItem>; // 返回被删除的实体（含 deletedAt）
  deleteMany(req: DeleteContextsRequest): Promise<DeleteContextsResult>;
}

interface CategoryService {
  list(): Promise<CategoryFlatNode[]>; // 扁平数组，前端建树
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, input: UpdateCategoryInput): Promise<Category>;
  delete(id: string, options?: DeleteCategoryOptions): Promise<Category>; // 返回被删除的分类
  deleteMany(req: DeleteCategoriesRequest): Promise<DeleteCategoriesResult>;
  reorder(input: ReorderCategoriesInput): Promise<CategoryFlatNode[]>; // 返回重排后的完整列表
}

interface SearchService {
  suggest(query: string, options?: SuggestOptions): Promise<SuggestItem[]>;
  search(req: SearchRequest): Promise<SearchResult>;
}

interface TrashService {
  list(): Promise<TrashContents>;
  restoreThought(id: string): Promise<RestoreResult>;
  restoreContext(id: string): Promise<RestoreResult>;
  deleteThoughtPermanently(id: string): Promise<TrashedThought>;
  deleteContextPermanently(id: string): Promise<TrashedContext>;
  empty(): Promise<BulkDeleteResult>;
}

interface AssetService {
  save(data: ArrayBuffer, filename: string): Promise<SaveAssetResult>;
  scanOrphans(): Promise<OrphanAssetInfo[]>;
  cleanOrphans(ids: string[]): Promise<number>; // 返回实际删除数量
  open(id: string): Promise<void>;
  reveal(id: string): Promise<void>;
}

interface CfgService {
  getStorage(): Promise<StorageConfig>;
  setStorage(path: string): Promise<StorageConfig>; // 返回更新后的配置
  getAiProvider(): Promise<AiProviderConfig>;
  setAiProvider(config: AiProviderConfig): Promise<AiProviderConfig>;
}

interface DialogService {
  pickDirectory(options?: PickDirectoryOptions): Promise<PickDirectoryResult>;
}

interface AppService {
  restart(): Promise<void>;
  getInfo(): Promise<AppInfo>;
}

interface AiService {
  generateSummary(req: GenerateSummaryRequest): Promise<GenerateSummaryResult>;
}
```

---

## 十二、前端适配方案

### 12.1 目录结构

```
src/renderer/src/
  apis/                 # 新增：API 抽象层
    thoughtApi.ts
    contextApi.ts
    categoryApi.ts
    searchApi.ts
    trashApi.ts
    assetApi.ts
    cfgApi.ts
    dialogApi.ts
    appApi.ts
    aiApi.ts
    index.ts            # 统一导出
  composables/          # 新增/改造：业务级 Query/Mutation Hooks
    useThoughtQuery.ts
    useThoughtList.ts
    useThoughtMutations.ts
    useCategoryTree.ts
    useOptimisticMutation.ts   # 统一封装
  utils/
    ipc.ts              # 改造：增加全局错误处理
    queryKeys.ts        # 新增：Query Key 工厂
```

### 12.2 IPC 层改造（增加全局错误处理）

```ts
// utils/ipc.ts
import { createIpcProxy } from "electron-ipc-decorator/client";
import { useToast } from "primevue/usetoast"; // 或全局 toast 实例

function createClient() {
  const raw = createIpcProxy<IpcServices>(window.ipcRenderer)!;

  // 包装一层：统一错误处理
  return new Proxy(raw, {
    get(target, serviceKey) {
      const service = target[serviceKey as string];
      return new Proxy(service, {
        get(svc, methodKey) {
          const method = svc[methodKey as string];
          return async (...args: unknown[]) => {
            try {
              return await method(...args);
            } catch (err: any) {
              // 全局错误提示
              const toast = useToast(); // 实际实现中可能需要全局 toast 实例
              toast.add({
                severity: "error",
                summary: `${String(serviceKey)}.${String(methodKey)} 失败`,
                detail: err.message || "未知错误",
                life: 4000,
              });
              throw err; // 继续抛出，让调用方决定是否处理
            }
          };
        },
      });
    },
  });
}

export const ipcClient = createClient();
```

### 12.3 Query Key 工厂（避免魔法字符串）

```ts
// utils/queryKeys.ts
export const queryKeys = {
  category: {
    all: ["category"] as const,
    list: () => [...queryKeys.category.all, "list"] as const,
  },
  thought: {
    all: ["thought"] as const,
    list: (filter?: object) => [...queryKeys.thought.all, "list", filter] as const,
    detail: (id: string) => [...queryKeys.thought.all, "detail", id] as const,
  },
  context: {
    all: ["context"] as const,
    byThought: (thoughtId: string) => [...queryKeys.context.all, "byThought", thoughtId] as const,
  },
  search: {
    all: ["search"] as const,
    suggest: (query: string) => [...queryKeys.search.all, "suggest", query] as const,
    result: (query: string) => [...queryKeys.search.all, "result", query] as const,
  },
  trash: {
    all: ["trash"] as const,
    list: () => [...queryKeys.trash.all, "list"] as const,
  },
  asset: {
    all: ["asset"] as const,
    orphans: () => [...queryKeys.asset.all, "orphans"] as const,
  },
  cfg: {
    all: ["cfg"] as const,
    storage: () => [...queryKeys.cfg.all, "storage"] as const,
    ai: () => [...queryKeys.cfg.all, "ai"] as const,
  },
};
```

### 12.4 统一乐观更新 Hook

```ts
// composables/useOptimisticMutation.ts
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { QueryKey } from "@tanstack/vue-query";

interface UseOptimisticMutationOptions<TData, TError, TVariables> {
  mutationFn: (vars: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  updater?: (old: TData | undefined, vars: TVariables) => TData | undefined;
  invalidateKeys?: QueryKey[];
  onError?: (error: TError, vars: TVariables, context: unknown) => void;
}

export function useOptimisticMutation<TData, TError, TVariables>(
  options: UseOptimisticMutationOptions<TData, TError, TVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData<TData>(options.queryKey);
      if (options.updater && previous !== undefined) {
        queryClient.setQueryData<TData>(options.queryKey, (old) => options.updater!(old, vars));
      }
      return { previous };
    },
    onError: (err, vars, context) => {
      const ctx = context as { previous: TData | undefined };
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(options.queryKey, ctx.previous);
      }
      options.onError?.(err, vars, context);
    },
    onSettled: () => {
      // 静默刷新相关缓存，不阻塞 UI
      if (options.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    },
  });
}
```

### 12.5 Thought API 封装示例

```ts
// apis/thoughtApi.ts
import { ipcClient } from "@renderer/utils/ipc";
import type {
  ThoughtQueryRequest,
  ThoughtListItem,
  ThoughtDetail,
  CreateThoughtInput,
  UpdateThoughtInput,
  PatchThoughtInput,
  Page,
} from "@shared/...";

export const thoughtApi = {
  query: (req: ThoughtQueryRequest) => ipcClient.thought.query(req),
  getById: (id: string) => ipcClient.thought.getById(id),
  create: (input: CreateThoughtInput) => ipcClient.thought.create(input),
  update: (id: string, input: UpdateThoughtInput) => ipcClient.thought.update(id, input),
  patch: (id: string, input: PatchThoughtInput) => ipcClient.thought.patch(id, input),
  delete: (id: string) => ipcClient.thought.delete(id),
  addConnection: (sourceId: string, targetId: string) =>
    ipcClient.thought.addConnection(sourceId, targetId),
  removeConnection: (sourceId: string, targetId: string) =>
    ipcClient.thought.removeConnection(sourceId, targetId),
};
```

### 12.6 Thought List Hook（改造示例）

```ts
// composables/useThoughtList.ts
import { computed } from "vue";
import type { Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { thoughtApi } from "@renderer/apis/thoughtApi";
import { queryKeys } from "@renderer/utils/queryKeys";
import type { ThoughtType } from "@shared/thought/type";

export function useThoughtList(options: {
  categoryId: Ref<string | undefined>;
  categoryIds: Ref<string[]>; // 支持多分类
  includeDescendants: Ref<boolean>;
  type: Ref<ThoughtType | undefined>;
  searchQuery: Ref<string | undefined>;
  sortBy: Ref<"created" | "updated">;
}) {
  const queryKey = computed(() =>
    queryKeys.thought.list({
      categoryId: options.categoryId.value,
      categoryIds: options.categoryIds.value,
      includeDescendants: options.includeDescendants.value,
      type: options.type.value,
      searchQuery: options.searchQuery.value,
      sortBy: options.sortBy.value,
    }),
  );

  return useQuery({
    queryKey,
    queryFn: () =>
      thoughtApi.query({
        filter: {
          categoryId: options.categoryId.value,
          categoryIds: options.categoryIds.value,
          includeDescendants: options.includeDescendants.value,
          type: options.type.value,
        },
        options: {
          sortBy: options.sortBy.value,
          limit: 50,
        },
      }),
  });
}
```

### 12.7 组件修改清单

#### ThoughtDetail（详情页）

| 修改项                   | 当前                                            | 改为                                                                     |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ |
| 获取详情                 | `ipcClient.thought.getThoughtById(id)`          | `thoughtApi.getById(id)`                                                 |
| 更新 body                | `updateThought({ body })` → invalidate 三个 key | `thoughtApi.patch(id, { body })` → 只更新 detail key，不 invalidate list |
| 更新 title/type/category | `updateThought({ ... })`                        | `thoughtApi.update(id, { ... })` → 乐观更新 detail + list                |
| 连接展示                 | `connections[]` / `referencedBy[]`              | 直接使用 `ThoughtDetail.connections` / `referencedBy`                    |

#### ThoughtList（列表页）

| 修改项       | 当前                                                        | 改为                                                     |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| 数据来源     | `ThoughtSummaryDTO[]`                                       | `Page<ThoughtListItem>`，使用 `items` 和 `total`         |
| 展示字段     | `contexts.length` / `connections.length`                    | `contextCount` / `connectionCount`（直接读取，无需计算） |
| 排序         | 前端 `sort()`                                               | 后端 `sortBy` + `order`                                  |
| 删除 Thought | `thoughtApi.delete(id)` + 手动设置 selectedThoughtId = null | `thoughtApi.delete(id)` 返回被删除实体，前端乐观移除     |

#### WikiLink 补全（md-editor）

| 修改项   | 当前                                    | 改为                                             |
| -------- | --------------------------------------- | ------------------------------------------------ |
| 接口     | `thought.listThoughts({ searchQuery })` | `searchApi.suggest(query, { limit: 8 })`         |
| Debounce | 无                                      | 150ms debounce                                   |
| Fallback | catch 后请求全部                        | 不再 fallback，直接返回空数组                    |
| 返回类型 | `ThoughtSummaryDTO[]`                   | `SuggestItem[]`（只含 id + title + bodyPreview） |

#### GlobalSearch（全局搜索）

| 修改项   | 当前                                         | 改为                                                  |
| -------- | -------------------------------------------- | ----------------------------------------------------- |
| 接口     | `search.search(query)` 无 limit              | `searchApi.search({ query, options: { limit: 20 } })` |
| 返回类型 | `SearchResult`（含 `thoughts` + `contexts`） | 相同，但默认最多 20 条                                |
| 加载更多 | 无                                           | 可扩展 `offset` 或 "加载更多"                         |

#### CategoryTree（分类树）

| 修改项   | 当前                                 | 改为                                                                                |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| 获取数据 | `category.listCategories()`          | `categoryApi.list()` 返回 `CategoryFlatNode[]`                                      |
| 建树逻辑 | `useCategoryData` 内部 `buildTree()` | 复用相同的 `buildTree()`，但输入从 `CategoryWithCounts[]` 改为 `CategoryFlatNode[]` |
| 删除分类 | `deleteCategory(id, deleteThoughts)` | `categoryApi.delete(id, { mode: "uncategorize" })` 或 `mode: "cascade"`             |
| 重排     | `reorderCategories(items)`           | `categoryApi.reorder({ items })` 返回新的 `CategoryFlatNode[]`，直接替换缓存        |

#### TrashSection（回收站）

| 修改项   | 当前                                                            | 改为                                                          |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| 获取数据 | `trash.listTrashedThoughts()` + `context.listTrashedContexts()` | `trashApi.list()` 返回 `{ thoughts, contexts }`               |
| 恢复     | `trash.restoreThought(id)` / `context.restoreContext(id)`       | `trashApi.restoreThought(id)` / `trashApi.restoreContext(id)` |
| 清空     | `Promise.all([...thoughts.map(...), ...contexts.map(...)])`     | `trashApi.empty()` 一键清空                                   |

#### StorageSection（存储设置）

| 修改项   | 当前                           | 改为                        |
| -------- | ------------------------------ | --------------------------- |
| 获取路径 | `config.getConfig()`           | `cfgApi.getStorage()`       |
| 设置路径 | `config.setStoragePath(path)`  | `cfgApi.setStorage(path)`   |
| 选择目录 | `config.openDirectoryPicker()` | `dialogApi.pickDirectory()` |
| 重启     | `config.restartApp()`          | `appApi.restart()`          |

#### AiSection（AI 设置）

| 修改项   | 当前                         | 改为                           |
| -------- | ---------------------------- | ------------------------------ |
| 获取配置 | `config.getAiConfig()`       | `cfgApi.getAiProvider()`       |
| 保存配置 | `config.setAiConfig(config)` | `cfgApi.setAiProvider(config)` |

#### Asset / 图片上传

| 修改项   | 当前                                | 改为                                   |
| -------- | ----------------------------------- | -------------------------------------- |
| 传输格式 | Base64 string                       | `ArrayBuffer`                          |
| 接口     | `asset.saveAsset(base64, filename)` | `assetApi.save(arrayBuffer, filename)` |
| 返回值   | `string` (id)                       | `{ id, url }`（可直接用于 markdown）   |

---

## 十三、Query Key 映射关系（新旧对比）

| 旧 Query Key                        | 新 Query Key                      | 说明                         |
| ----------------------------------- | --------------------------------- | ---------------------------- |
| `["category.listCategories"]`       | `queryKeys.category.list()`       | 扁平数组，前端建树           |
| `["thought.listThoughts", ...]`     | `queryKeys.thought.list(filter)`  | 返回 `Page<ThoughtListItem>` |
| `["thought.getThoughtById", id]`    | `queryKeys.thought.detail(id)`    | 返回 `ThoughtDetail`         |
| `["contemplate.listThoughts", ...]` | `queryKeys.thought.list(filter)`  | 统一使用同一个 hook          |
| `["search", query]`                 | `queryKeys.search.result(query)`  | 返回 `SearchResult`          |
| —                                   | `queryKeys.search.suggest(query)` | 新增，用于 WikiLink 补全     |
| —                                   | `queryKeys.trash.list()`          | 新增，统一回收站             |
| —                                   | `queryKeys.asset.orphans()`       | 新增                         |
| —                                   | `queryKeys.cfg.storage()`         | 新增                         |
| —                                   | `queryKeys.cfg.ai()`              | 新增                         |

---

## 十四、向后兼容策略

如果现有数据库和主进程逻辑无法一次性全改，可以采用渐进式迁移：

1. **Phase 1**：新增 `apis/` 层，内部兼容调用旧 `ipcClient`，但对外暴露新接口形状
2. **Phase 2**：逐个替换组件，从叶子节点开始（如 `md-editor` 的 suggest）
3. **Phase 3**：后端新增 `thought.query` / `search.suggest` 等新接口，前端切过去
4. **Phase 4**：后端下线旧接口，前端删除兼容代码

---

## 十五、设计验证 Checklist

用以下场景验证新 API 是否足够简洁：

- [ ] 用户打开 Capture 页 → `thoughtApi.query({ filter: { categoryId: "all" }, options: { limit: 50 } })` 一次请求获取列表
- [ ] 用户编辑 Thought body → `thoughtApi.patch(id, { body })` 只更新 detail，不闪烁列表
- [ ] 用户输入 `[[` → `searchApi.suggest(query, { limit: 8 })` debounce 150ms
- [ ] 用户清空回收站 → `trashApi.empty()` 一次 IPC
- [ ] 用户拖拽分类 → `categoryApi.reorder({ items })` 返回新列表，直接替换缓存
- [ ] 用户上传图片 → `assetApi.save(arrayBuffer, filename)` 返回 `{ id, url }`
- [ ] 用户搜索 → `searchApi.search({ query, options: { limit: 20 } })` 分页可控

---

## 附录：完整类型索引

| 文件                          | 导出类型                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `shared/common/pagination.ts` | `Page`, `PageOptions`, `CursorPage`, `CursorPageOptions`                                      |
| `shared/common/timestamp.ts`  | `Timestamped`                                                                                 |
| `shared/common/error.ts`      | `ApiError`                                                                                    |
| `shared/thought/type.ts`      | `ThoughtType`, `ThoughtConnection`                                                            |
| `shared/thought/list-item.ts` | `ThoughtListItem`                                                                             |
| `shared/thought/detail.ts`    | `ThoughtDetail`                                                                               |
| `shared/thought/query.ts`     | `ThoughtQueryFilter`, `ThoughtQueryOptions`, `ThoughtQueryRequest`                            |
| `shared/thought/input.ts`     | `CreateThoughtInput`, `UpdateThoughtInput`, `PatchThoughtInput`                               |
| `shared/context/type.ts`      | `SourceType`                                                                                  |
| `shared/context/item.ts`      | `ContextItem`                                                                                 |
| `shared/context/input.ts`     | `CreateContextInput`, `UpdateContextInput`                                                    |
| `shared/context/batch.ts`     | `DeleteContextsRequest`, `DeleteContextsResult`                                               |
| `shared/category/type.ts`     | `Category`, `CategoryFlatNode`, `CategoryTreeNode`                                            |
| `shared/category/input.ts`    | `CreateCategoryInput`, `UpdateCategoryInput`, `ReorderCategoryItem`, `ReorderCategoriesInput` |
| `shared/category/delete.ts`   | `DeleteCategoryOptions`                                                                       |
| `shared/category/batch.ts`    | `DeleteCategoriesRequest`, `DeleteCategoriesResult`                                           |
| `shared/search/suggest.ts`    | `SuggestItem`, `SuggestOptions`                                                               |
| `shared/search/result.ts`     | `SearchThoughtResult`, `SearchContextResult`, `SearchRequest`, `SearchResult`                 |
| `shared/trash/type.ts`        | `TrashedThought`, `TrashedContext`, `TrashContents`, `RestoreResult`, `BulkDeleteResult`      |
| `shared/asset/type.ts`        | `AssetInfo`, `OrphanAssetInfo`, `SaveAssetResult`                                             |
| `shared/config/type.ts`       | `StorageConfig`, `AiProviderConfig`                                                           |
| `shared/dialog/type.ts`       | `PickDirectoryOptions`, `PickDirectoryResult`                                                 |
| `shared/app/type.ts`          | `AppInfo`                                                                                     |
| `shared/ai/type.ts`           | `GenerateSummaryRequest`, `GenerateSummaryResult`                                             |
