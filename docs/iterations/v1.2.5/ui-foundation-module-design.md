# v1.2.5 UI Foundation Module Design

> 状态：Planned
>
> 对应主计划：[Module 1：设计基础与 shadcn Primitives](./ui-package-storybook-migration-plan.md#6-module-1设计基础与-shadcn-primitives)
>
> 组织逻辑：本文采用**递进型主线**，按“现有资产 → ownership 决策 → package interface → Renderer 替换 → 验收”展开。原因是 Foundation 是其他 UI Module 的前置依赖，必须先确认哪些样式和 primitive 真正属于 UI，再设计 export；横向组件清单按表单输入、Overlay/导航、内容/布局做 MECE 分类。

## 1. 结论

Foundation Module 一次性接管现有 56 个 shadcn primitive、Theme Provider、`cn`、`Sidebar` 的 `useIsMobile` 内部依赖，以及平台无关的 Reflecta design tokens 和基础样式。

它不重新设计 shadcn，不创建第二层 wrapper。现有 primitive 的 props、variants、slots、data attributes 和行为保持不变，只调整 ownership、package-local import 和消费路径。

公开 interface：

```text
@reflecta/ui/styles.css
@reflecta/ui/theme
@reflecta/ui/utils
@reflecta/ui/primitives/*
```

调用示例：

```tsx
import { Button } from "@reflecta/ui/primitives/button";
import { Dialog, DialogContent } from "@reflecta/ui/primitives/dialog";
import { ThemeProvider } from "@reflecta/ui/theme";
import { cn } from "@reflecta/ui/utils";
import "@reflecta/ui/styles.css";
```

不提供 `@reflecta/ui/primitives` 总 barrel。每个 primitive 继续按文件独立导入，保持调用点上下文和按需依赖清晰。

## 2. 当前资产清单

### 2.1 表单与直接操作

以下 19 个文件全部迁移，公开 export 保持现状：

| 现有文件            | 主要公开组件或 helper                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `button.tsx`        | `Button`、`buttonVariants`                                                               |
| `button-group.tsx`  | `ButtonGroup`、`ButtonGroupSeparator`、`ButtonGroupText`、`buttonGroupVariants`          |
| `toggle.tsx`        | `Toggle`、`toggleVariants`                                                               |
| `toggle-group.tsx`  | `ToggleGroup`、`ToggleGroupItem`                                                         |
| `checkbox.tsx`      | `Checkbox`                                                                               |
| `radio-group.tsx`   | `RadioGroup`、`RadioGroupItem`                                                           |
| `switch.tsx`        | `Switch`                                                                                 |
| `slider.tsx`        | `Slider`                                                                                 |
| `input.tsx`         | `Input`                                                                                  |
| `textarea.tsx`      | `Textarea`                                                                               |
| `input-group.tsx`   | `InputGroup`、`InputGroupAddon`、`InputGroupButton`、`InputGroupText`、输入与文本域组件  |
| `input-otp.tsx`     | `InputOTP`、`InputOTPGroup`、`InputOTPSlot`、`InputOTPSeparator`                         |
| `native-select.tsx` | `NativeSelect`、`NativeSelectOptGroup`、`NativeSelectOption`                             |
| `select.tsx`        | `Select` 及其 Trigger、Value、Content、Group、Item、Label、Separator、Scroll buttons     |
| `combobox.tsx`      | `Combobox` 及其 Input、Content、List、Item、Group、Chips、Trigger、Value                 |
| `calendar.tsx`      | `Calendar`、`CalendarDayButton`                                                          |
| `form.tsx`          | `Form`、`FormField`、`FormItem`、`FormLabel`、`FormControl`、描述、错误与 `useFormField` |
| `field.tsx`         | `Field`、Label、Description、Error、Group、Legend、Separator、Set、Content、Title        |
| `label.tsx`         | `Label`                                                                                  |

### 2.2 Overlay、折叠与导航

以下 14 个文件全部迁移：

| 现有文件              | 主要公开组件或 helper                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `accordion.tsx`       | `Accordion`、`AccordionItem`、`AccordionTrigger`、`AccordionContent`                       |
| `collapsible.tsx`     | `Collapsible`、`CollapsibleTrigger`、`CollapsibleContent`                                  |
| `dialog.tsx`          | `Dialog` 及其 Trigger、Close、Portal、Overlay、Content、Header、Footer、Title、Description |
| `alert-dialog.tsx`    | `AlertDialog` 全套结构组件                                                                 |
| `drawer.tsx`          | `Drawer` 全套结构组件                                                                      |
| `sheet.tsx`           | `Sheet` 全套结构组件                                                                       |
| `popover.tsx`         | `Popover`、Trigger、Content、Header、Title、Description                                    |
| `hover-card.tsx`      | `HoverCard`、Trigger、Content                                                              |
| `tooltip.tsx`         | `TooltipProvider`、`Tooltip`、Trigger、Content                                             |
| `dropdown-menu.tsx`   | Dropdown Menu 全套 Item、Group、Radio、Checkbox、Submenu 和 Portal                         |
| `context-menu.tsx`    | Context Menu 全套 Item、Group、Radio、Checkbox、Submenu 和 Portal                          |
| `menubar.tsx`         | Menubar 全套 Menu、Item、Group、Radio、Checkbox 和 Submenu                                 |
| `navigation-menu.tsx` | Navigation Menu 全套结构组件与 `navigationMenuTriggerStyle`                                |
| `command.tsx`         | `Command`、Dialog、Input、List、Empty、Group、Item、Shortcut、Separator                    |

### 2.3 内容、反馈与布局

以下 23 个文件全部迁移：

| 现有文件           | 主要公开组件或 helper                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| `aspect-ratio.tsx` | `AspectRatio`                                                                         |
| `card.tsx`         | `Card`、Header、Footer、Title、Action、Description、Content                           |
| `item.tsx`         | `Item`、Media、Content、Actions、Group、Separator、Title、Description、Header、Footer |
| `empty.tsx`        | `Empty`、Header、Title、Description、Content、Media                                   |
| `alert.tsx`        | `Alert`、`AlertTitle`、`AlertDescription`、`AlertAction`                              |
| `avatar.tsx`       | `Avatar`、Image、Fallback、Group、GroupCount、Badge                                   |
| `badge.tsx`        | `Badge`、`badgeVariants`                                                              |
| `breadcrumb.tsx`   | Breadcrumb 全套结构组件                                                               |
| `pagination.tsx`   | Pagination 全套结构组件                                                               |
| `progress.tsx`     | `Progress`、Track、Indicator、Label、Value                                            |
| `separator.tsx`    | `Separator`                                                                           |
| `skeleton.tsx`     | `Skeleton`                                                                            |
| `spinner.tsx`      | `Spinner`                                                                             |
| `table.tsx`        | `Table`、Header、Body、Footer、Head、Row、Cell、Caption                               |
| `tabs.tsx`         | `Tabs`、List、Trigger、Content、`tabsListVariants`                                    |
| `scroll-area.tsx`  | `ScrollArea`、`ScrollBar`                                                             |
| `resizable.tsx`    | `ResizablePanelGroup`、`ResizablePanel`、`ResizableHandle`                            |
| `carousel.tsx`     | `Carousel`、Content、Item、Previous、Next、`useCarousel`、`CarouselApi`               |
| `sidebar.tsx`      | Sidebar Provider、结构、Group、Menu、Rail、Trigger、`useSidebar` 等完整集合           |
| `chart.tsx`        | Chart Container、Tooltip、Legend、Style、`ChartConfig`                                |
| `kbd.tsx`          | `Kbd`、`KbdGroup`                                                                     |
| `direction.tsx`    | `DirectionProvider`、`useDirection`                                                   |
| `sonner.tsx`       | `Toaster`                                                                             |

### 2.4 非 primitive 资产

| 现有资产                        | 决策         | 原因                                                   |
| ------------------------------- | ------------ | ------------------------------------------------------ |
| `components/theme-provider.tsx` | 迁移         | Storybook 与 Renderer 必须共享同一主题 implementation  |
| `lib/utils.ts` 的 `cn`          | 迁移并公开   | 15 个非 primitive Renderer 文件直接使用                |
| `hooks/use-mobile.ts`           | 迁移但不公开 | 只有 `Sidebar` 使用，是 primitive 的内部实现           |
| `lib/badge-colors.ts`           | 删除         | 当前没有调用方，不把未使用 helper 搬进新 package       |
| `apps/electron/components.json` | 替换         | shadcn 的 ownership 改为 `packages/ui/components.json` |

## 3. 样式 Ownership

### 3.1 迁移到 `@reflecta/ui/styles.css`

- Tailwind v4、`tw-animate-css`、`shadcn/tailwind.css`；
- Inter font import；
- `dark` custom variant；
- light/dark CSS variables；
- Tailwind `@theme inline` token mapping；
- `border-border`、`outline-ring`、background、foreground 等 base layer；
- `html` 的主题 color scheme；
- 通用字体渲染和 monospace family；
- 通用 scrollbar。

### 3.2 留在 Electron `style.css`

- `body`、`#root` 的 `100vh` 和 `overflow: hidden`；
- 透明 Electron window background；
- `.app-window`、`.app-drag-region`、`[data-app-drag]`、`[data-no-drag]`；
- 只服务 Electron App Shell 的布局；
- Milkdown Preview 使用的 `medium-zoom` overlay/image style；
- Module 2 完成前暂存的 chat-find 样式。

Electron 入口固定为：

```css
@import "@reflecta/ui/styles.css";

/* Electron-only App Shell rules follow. */
```

UI package 不能通过 `styles.css` 假设宿主一定有 `#root`，也不能把宿主页面锁定为 `100vh` 或 `overflow: hidden`。

## 4. Package Interface

### 4.1 `package.json` exports

目标形态：

```json
{
  "name": "@reflecta/ui",
  "private": true,
  "type": "module",
  "sideEffects": ["**/*.css", "**/*.scss"],
  "exports": {
    "./styles.css": "./src/styles/index.css",
    "./theme": "./src/theme-provider.tsx",
    "./utils": "./src/utils.ts",
    "./primitives/*": "./src/primitives/*.tsx"
  }
}
```

`exports` 中不暴露 `internal`、Story、Storybook config 或 `useIsMobile`。

### 4.2 Theme Interface

```ts
import type { ComponentProps } from "react";
import type { ThemeProvider as NextThemesProvider } from "next-themes";

export type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider(props: ThemeProviderProps): React.ReactNode;
```

稳定行为：

- 默认 `attribute="class"`；
- 默认 `defaultTheme="system"`；
- 默认启用 system theme；
- 允许 Storybook 使用 `forcedTheme="light" | "dark"`；
- 不读取 Electron 设置或 IPC。

### 4.3 Utility Interface

```ts
import type { ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string;
```

不新增 `styles()`、`cx()` 或 wrapper。现有 `clsx + tailwind-merge` implementation 原样迁移。

### 4.4 Primitive Interface

每个 primitive 的 interface 继续由原文件 export 决定，例如：

```ts
import { Button, buttonVariants } from "@reflecta/ui/primitives/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@reflecta/ui/primitives/collapsible";
```

迁移期间禁止：

- 改名或合并现有 primitive；
- 增加 Reflecta 业务 props；
- 新建与 shadcn 重复的 Select、Dialog、Drawer、Menu 等组件；
- 为 Storybook增加仅测试使用的 props；
- 改动 variants、size、default class 或 DOM structure。

## 5. 内部依赖与 Dependency Ownership

`@reflecta/ui` 声明它直接 import 的 runtime dependencies，包括：

- `@base-ui/react`、`radix-ui`；
- `class-variance-authority`、`clsx`、`tailwind-merge`；
- `lucide-react`；
- `cmdk`、`vaul`、`sonner`、`next-themes`；
- `embla-carousel-react`、`input-otp`；
- `react-day-picker`、`react-hook-form`；
- `react-resizable-panels`、`recharts`。

React 与 React DOM 使用 peer dependencies，Storybook 和类型包使用 dev dependencies。

迁移后，`apps/electron/package.json` 只保留它仍直接 import 的 dependency。不能因为 workspace hoist 能解析就省略 `@reflecta/ui` 的直接依赖声明。

## 6. Renderer Adapter 与替换映射

### 6.1 Import 映射

```text
@renderer/components/ui/button
  -> @reflecta/ui/primitives/button

@renderer/components/ui/*
  -> @reflecta/ui/primitives/*

@renderer/components/theme-provider
  -> @reflecta/ui/theme

@renderer/lib/utils
  -> @reflecta/ui/utils
```

### 6.2 迁移顺序

1. 先迁移 `utils`、Theme Provider、`useIsMobile`；
2. 按 primitive 内部依赖图迁移文件；
3. 修正 primitive package-local import；
4. Storybook 验证 styles；
5. 批量替换 Renderer imports；
6. 删除 Electron 原文件；
7. 清理 Electron dependency declarations。

不建立临时 `@renderer/components/ui/* -> @reflecta/ui/*` re-export。迁移提交内直接替换调用方，避免两套合法入口长期存在。

## 7. Storybook 与验证矩阵

不为 56 个文件逐一创建 exhaustive story，按能力面覆盖：

| Story Group | 代表组件                                    | 必查状态                                     |
| ----------- | ------------------------------------------- | -------------------------------------------- |
| Actions     | Button、Toggle、Checkbox、Switch            | default、hover、focus、disabled、destructive |
| Inputs      | Input、Textarea、Select、Combobox、Calendar | empty、filled、invalid、disabled、keyboard   |
| Overlay     | Dialog、Drawer、Popover、Tooltip、Menu      | open/close、focus trap、escape、dark         |
| Feedback    | Alert、Badge、Progress、Skeleton、Spinner   | semantic variants、loading                   |
| Content     | Card、Item、Table、Tabs、Accordion          | dense content、long text、narrow width       |
| Layout      | Sidebar、Resizable、ScrollArea、Carousel    | desktop/mobile viewport、overflow            |
| Theme       | tokens、font、radius、chart colors          | light、dark、system                          |

自动验证：

- package typecheck；
- Storybook static build；
- Renderer web typecheck；
- 现有 Renderer component tests；
- production build；
- `rg '@renderer|@shared|ipcClient|electron' packages/ui/src` 无结果；
- `rg '@renderer/components/ui|@renderer/components/theme-provider' apps/electron/src/renderer/src` 无结果。

## 8. Module 出口

- 56 个 primitive 只有 `packages/ui` 一份 implementation；
- primitive public props 与迁移前一致；
- Theme Provider 和 design tokens 在 Storybook/Renderer 中一致；
- `Sidebar` 不再反向依赖 Electron hook；
- `cn` 有唯一公开入口；
- Electron `style.css` 只包含 App Shell 规则；
- `badge-colors.ts` 等未使用资产没有被迁移；
- Module 2 可以只依赖 `@reflecta/ui` 开始实现 Chat Markdown。
