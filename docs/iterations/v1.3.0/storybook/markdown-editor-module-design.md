# v1.3.0 Markdown Editor Module Design

> 状态：Planned
>
> 对应主计划：[Module 2：Markdown Editor](./ui-package-storybook-migration-plan.md)
>
> 组织逻辑：本文采用**递进型主线**，按“现有 implementation → App I/O 拆分 → public interface → Adapter → Storybook 验收”展开。原因是 Milkdown 本身已经是深 UI Module，迁移难点仅在于上传和 Wiki suggestion 被硬编码为 IPC；横向能力按 Editor、Readonly Preview、Simple Preview、codec/helper 做 MECE 分类。

## 1. 结论

Milkdown 应迁入 `packages/ui`，并成为独立于 Chat Markdown 的 Editor Module：

```text
@reflecta/ui/editor
  MarkdownEditor
  MarkdownPreview
  SimpleMarkdownPreview
  MarkdownEditorSuggestion
  normalizeMarkdown
  markdownEquals
  Wiki Link codec helpers
```

职责区别：

| Module          | 输入                     | 核心职责                         |
| --------------- | ------------------------ | -------------------------------- |
| Markdown Editor | 可编辑 Markdown document | 内容生产、上传、suggestion、保存 |
| Chat Markdown   | assistant Markdown text  | 流式消息展示、entity ref、搜索   |

两者共享 design tokens，但不共享 renderer implementation。

## 2. 当前资产处理

### 2.1 迁入 package

| 当前资产                             | 目标                      | 可见性           |
| ------------------------------------ | ------------------------- | ---------------- |
| `editor/index.tsx`                   | `MarkdownEditor`          | public           |
| `editor/milkdown-editor.ts`          | Editor implementation     | package internal |
| `editor/milkdown-extensions.ts`      | Editor extensions         | package internal |
| suggestion plugin/view/types         | suggestion implementation | package internal |
| `editor/markdown-normalize.ts`       | normalize/equality helper | public           |
| `preview/MarkdownPreview`            | `MarkdownPreview`         | public           |
| `preview/SimpleMarkdownPreview`      | `SimpleMarkdownPreview`   | public           |
| `preview/getMarkdownPreviewText`     | compact preview helper    | public           |
| `wiki-links.ts`                      | Wiki Link codec           | public           |
| `milkdown-theme.scss` 与全部 partial | Editor theme              | package internal |
| `medium-zoom`                        | Editor package dependency | package internal |

### 2.2 留在 Electron

| 当前职责                                   | 新位置               |
| ------------------------------------------ | -------------------- |
| `ipcClient.asset.saveAsset`                | asset upload Adapter |
| Understanding list query                   | suggestion Adapter   |
| DTO → suggestion label/preview             | suggestion Adapter   |
| 保存 Understanding/Context                 | Capture workflow     |
| autosave、dirty compare 的 workflow        | Capture workflow     |
| Wiki Link 点击后的 route/drawer navigation | Electron callback    |

### 2.3 删除或收缩

- 删除默认创建 IPC suggestion source 的行为；
- 删除 Editor 内部拼接 `asset:///` protocol 的行为；
- 删除 `initialContent + content` 双输入；
- low-level Milkdown `Editor` instance 不进入 package public interface；
- plugin key、ProseMirror state 和 schema 不进入 public interface。

## 3. Public Interface

### 3.1 Suggestion

```ts
export type MarkdownEditorSuggestion = {
  id: string;
  label: string;
  preview?: string;
  markdown: string;
};

export type MarkdownEditorSuggestionSource = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly MarkdownEditorSuggestion[]>;
```

`markdown` 是最终插入文本；UI 不理解 Understanding DTO。

### 3.2 Asset upload

```ts
export type MarkdownAssetUploadResult = {
  url: string;
  alt?: string;
};

export type MarkdownAssetUploader = (
  file: File,
  signal: AbortSignal,
) => Promise<MarkdownAssetUploadResult>;
```

Uploader 返回可直接写入 Markdown 的最终 URL。Electron Adapter 可以返回 `asset:///filename`，Story 返回 blob/data URL；package 不知道 IPC 或 asset protocol。

### 3.3 Editor props

```ts
export type MarkdownEditorProps = {
  documentId?: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  height?: number | string;
  maxHeight?: number | string;
  onChange?: (markdown: string) => void;
  onBlur?: () => void;
  uploadAsset?: MarkdownAssetUploader;
  getSuggestions?: MarkdownEditorSuggestionSource;
  onWikiLinkOpen?: (id: string) => void;
};

export function MarkdownEditor(props: MarkdownEditorProps): React.ReactNode;
```

Interface 规则：

- `value` 是唯一内容输入；
- `documentId` 改变表示切换 document，替代模糊的 `contentKey`；
- `onChange` 只在规范化后的 Markdown 实际变化时触发；
- `readOnly` 时禁用 suggestion、upload 和编辑 command；
- 未提供 `uploadAsset` 时忽略文件 drop/paste，不创建无效节点；
- 未提供 `getSuggestions` 时 Wiki Link 输入仍可编辑，只是不弹 suggestion；
- callback 更新不重建 Milkdown instance；
- `documentId` 不变时外部 `value` 更新通过 replace action 同步。

### 3.4 Preview props

```ts
export type MarkdownPreviewProps = {
  value: string;
  className?: string;
  zoomImages?: boolean;
  onWikiLinkOpen?: (id: string) => void;
};

export function MarkdownPreview(props: MarkdownPreviewProps): React.ReactNode;

export type SimpleMarkdownPreviewProps = {
  value: string;
  lineClamp?: number;
  className?: string;
};

export function SimpleMarkdownPreview(props: SimpleMarkdownPreviewProps): React.ReactNode;
```

`MarkdownPreview` 复用 readonly Editor implementation；`SimpleMarkdownPreview` 只生成纯文本摘要，不启动 Milkdown。

## 4. Public Helper

```ts
export function normalizeMarkdown(markdown: string): string;
export function markdownEquals(left: string, right: string): boolean;

export type UnderstandingWikiLink = {
  title: string;
  id: string;
};

export function formatUnderstandingWikiLink(link: UnderstandingWikiLink): string;
export function parseUnderstandingWikiLink(raw: string): UnderstandingWikiLink | null;
export function normalizeUnderstandingWikiLinkBody(body: string): string;
export function findUnderstandingWikiLinkAtOffset(
  text: string,
  offset: number,
): UnderstandingWikiLink | null;
```

只公开已有生产消费者需要的 helper；ProseMirror range 和 HTML renderer 若没有 package 外消费者则保持 internal。

## 5. Electron Adapter

```ts
const uploadAsset: MarkdownAssetUploader = async (file) => {
  const filename = await ipcClient.asset.saveAsset(await file.arrayBuffer(), file.name);
  return { url: `asset:///${filename}`, alt: file.name };
};

const getSuggestions: MarkdownEditorSuggestionSource = async (query, signal) => {
  const records = await ipcClient.understanding.listUnderstandings(
    query.trim() ? { searchQuery: query.trim() } : undefined,
  );
  if (signal.aborted) return [];
  return records.slice(0, 8).map(toMarkdownEditorSuggestion);
};
```

Adapter 保留：

- IPC 调用；
- DTO fallback title；
- query limit；
- App-specific error logging。

UI Module 只处理 loading、empty、keyboard navigation 和 selection visual。

## 6. Internal Implementation

```text
MarkdownEditor
└── MilkdownProvider
    └── MarkdownEditorSurface
        ├── create editor
        ├── controlled value sync
        ├── upload port
        ├── suggestion port
        └── Wiki Link click

MarkdownPreview
├── readonly MarkdownEditorSurface
└── image zoom lifecycle

SimpleMarkdownPreview
└── pure text projection
```

内部 state 不暴露：

- Milkdown instance；
- MutationObserver；
- zoom instance；
- suggestion plugin state；
- ProseMirror selection。

## 7. Storybook 矩阵

### 7.1 Editor

- empty + placeholder；
- controlled content；
- document switch；
- heading/list/table/code/link/image/video；
- Wiki Link；
- suggestion loading/empty/results/error；
- keyboard select/cancel；
- image upload success/failure；
- readonly；
- auto height + max height；
- dark/light theme。

### 7.2 Preview

- full document；
- image zoom enabled/disabled；
- Wiki Link click；
- long code/table；
- empty document。

### 7.3 Simple Preview

- one line；
- multi-line clamp；
- Markdown syntax removal；
- Wiki Link label；
- image/link alt text。

## 8. 测试归属

package tests：

- Markdown normalization/equality；
- Wiki Link codec；
- controlled value sync；
- upload result creates final URL node；
- suggestion keyboard behavior；
- readonly blocks mutation；
- preview zoom lifecycle cleanup。

Electron tests：

- IPC upload Adapter；
- Understanding DTO → suggestion mapping；
- Capture autosave and document switch。

## 9. Renderer 替换

- `UnderstandingDetail` 从 `@reflecta/ui/editor` 导入 Editor/Preview；
- `UnderstandingRow` 使用 `SimpleMarkdownPreview`；
- Capture store 从 `@reflecta/ui/editor` 导入 `markdownEquals`；
- Renderer 创建 asset/suggestion Adapter；
- 删除旧 `modules/shared/components/markdown-editor`；
- `medium-zoom` 依赖从 Electron 移到 UI package。

## 10. Module 出口

- Editor 可在 Storybook 中完全运行，不需要 IPC；
- production 上传与 suggestion 行为通过 Adapter 注入；
- App 切换 document 时内容不会串写；
- readonly Preview 与 Editor 使用同一 Milkdown theme；
- public interface 不暴露 Milkdown/ProseMirror 类型。
