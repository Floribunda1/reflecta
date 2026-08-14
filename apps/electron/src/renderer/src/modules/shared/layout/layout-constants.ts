/**
 * 布局尺寸常量 —— 侧栏宽度 / 内容偏移（单一来源）
 *
 * 背景：capture 侧栏、chat 侧栏与聚焦模式共用一组「宽度 / 偏移」魔法数，
 * 曾散落在 6 个文件（audit T4），现收敛于此。
 *
 * 注意：必须使用完整 tailwind 类名字符串（而非「数值 + 模板拼接」），
 * 否则 tailwind v4 的源码扫描无法生成对应 utility。
 */

/** 侧栏展开宽度（capture 领域侧栏） */
export const SIDEBAR_WIDTH_CLASS = "w-62";
/** capture 侧栏 grid 列 —— 展开 / 收起 */
export const SIDEBAR_GRID_COLS_OPEN = "grid-cols-[248px_minmax(0,1fr)]";
export const SIDEBAR_GRID_COLS_CLOSED = "grid-cols-[0px_minmax(0,1fr)]";

/** 侧栏收起态内容偏移 —— header 左侧内边距（chat / knowledge-wander） */
export const SIDEBAR_COLLAPSED_OFFSET_CLASS = "pl-21.5";
/** 侧栏收起态展开按钮定位（chat） */
export const SIDEBAR_COLLAPSED_BUTTON_CLASS = "left-21.5";

/** 聚焦模式内容偏移（understanding 列表 / 详情） */
export const FOCUS_MODE_OFFSET_CLASS = "pl-[75px]";

/**
 * ResizableHandle 基础定制（无把手）：细分割线 + 拖拽态高亮。
 * 与 shadcn 默认 handle（bg-border after:w-1）同族，用于替换默认拖拽条。
 */
export const RESIZE_HANDLE_CLASS =
  "cursor-col-resize bg-border after:w-4 hover:bg-border data-[resize-handle-active]:bg-ring";

/** withHandle 把手内部 div 的尺寸/颜色定制（配合 RESIZE_HANDLE_CLASS） */
export const RESIZE_HANDLE_GRIP_CHILD_CLASS = "[&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border";

/** 细线把手：透明 hit area（w-3）+ after 细线，用于 dock 侧窄分隔 */
export const RESIZE_HANDLE_SLIM_CLASS =
  "w-3 cursor-col-resize bg-transparent after:w-px after:bg-border hover:after:bg-border data-[resize-handle-active]:after:bg-ring [&>div]:h-10 [&>div]:w-0.5 [&>div]:bg-border";
