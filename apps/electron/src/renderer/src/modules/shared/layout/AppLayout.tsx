import { animate } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Outlet } from "react-router-dom";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@reflecta/ui/components/resizable";
import { AppNavRail } from "./AppNavRail";
import { RAIL_RESIZE_HANDLE_CLASS } from "./layout-constants";
import { RailMenuProvider } from "./rail-menu-context";
import {
  MAX_RAIL_WIDTH_PX,
  MIN_RAIL_WIDTH_PX,
  persistRailWidth,
  RailProvider,
  readRailWidth,
  useRail,
} from "./rail-provider";

/**
 * App shell：rail 与主区常驻同一个 ResizablePanelGroup（不再按 open 分支换结构，避免页面 remount）。
 *
 * 尺寸与拖拽全部交给 react-resizable-panels（拖拽 resize / 键盘 a11y 都是它的）：
 * - 不用 RRP 的 collapsible/collapsedSize —— RRPV4 面板一旦塌缩，expand()/resize() 全部失效
 *   （实测 no-op）；改为 panel minSize={0}，收起/展开用 panel.resize(px) 驱动（px 精确，无塌缩态）。
 * - 收起/展开动画：motion 的 animate() 补间宽度（px），onUpdate 逐帧 resize —— RRP 仍是唯一
 *   尺寸来源；动画期间 onResize 不持久化（animatingRef 守卫）。
 * - 内容不挤压：rail 内容层固定为展开宽度（--rail-content-width），动画期间只被裁剪不重排
 *   （Notion 模式）；收起动画播完后 visibility:hidden（滑出完整保留，收到底菜单不可聚焦，
 *   保住 e2e toBeHidden 契约）。
 */

/** 动画缓动：easeOutQuint（joshuawootonn 对比 Notion/Linear/Gitlab 的推荐曲线） */
const RAIL_EASE = [0.165, 0.84, 0.44, 1] as const;
const RAIL_DURATION_S = 0.3;

function AppMain() {
  return (
    <main className="m-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background shadow-sm ring-1 ring-foreground/10">
      <Outlet />
    </main>
  );
}

function AppShell() {
  const { open, setOpen } = useRail();
  const railPanelRef = useRef<PanelImperativeHandle | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const lastOpenWidthRef = useRef(readRailWidth());
  const animatingRef = useRef(false);
  const firstRunRef = useRef(true);
  /** 收起动画播完后内容层才 hidden（避免滑出过程内容瞬间消失） */
  const [contentHidden, setContentHidden] = useState<boolean>(() => !open);

  // open 变化：motion 补间宽度（px）→ panel.resize 逐帧生效
  useEffect(() => {
    const panel = railPanelRef.current;
    if (!panel) return;
    const target = open ? lastOpenWidthRef.current : 0;
    // 首帧直接落位，不播动画（reduced-motion 同样直落）
    if (firstRunRef.current) {
      firstRunRef.current = false;
      panel.resize(target);
      return;
    }
    const from = panel.getSize().inPixels;
    animatingRef.current = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = animate(from, target, {
      type: "tween",
      ease: RAIL_EASE,
      duration: reduceMotion ? 0 : RAIL_DURATION_S,
      onUpdate: (value) => panel.resize(value),
    });
    void controls.finished.then(() => {
      animatingRef.current = false;
      setContentHidden(!openRef.current);
    });
    return () => controls.stop();
  }, [open]);

  // group → store：用户拖拽同步宽度；拖到 MIN 以下视为收起。
  // 动画驱动（resize）触发的 onResize 由 animatingRef 跳过，避免把中间宽度持久化。
  const handleRailResize = useCallback(
    (size: { inPixels: number }, _id: unknown, previous: { inPixels: number } | undefined) => {
      if (!previous || animatingRef.current) return;
      if (size.inPixels < MIN_RAIL_WIDTH_PX) {
        if (previous.inPixels >= MIN_RAIL_WIDTH_PX) setOpen(false);
        return;
      }
      lastOpenWidthRef.current = size.inPixels;
      persistRailWidth(size.inPixels);
    },
    [setOpen],
  );

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="app-shell">
      <ResizablePanel
        id="app-rail"
        panelRef={railPanelRef}
        defaultSize={open ? readRailWidth() : 0}
        minSize={0}
        maxSize={MAX_RAIL_WIDTH_PX}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0"
        style={
          {
            "--rail-content-width": `${lastOpenWidthRef.current}px`,
            visibility: open || !contentHidden ? "visible" : "hidden",
          } as CSSProperties
        }
        onResize={handleRailResize}
      >
        <AppNavRail />
      </ResizablePanel>
      <ResizableHandle id="app-rail-resize-handle" className={RAIL_RESIZE_HANDLE_CLASS} />
      <ResizablePanel id="app-main" minSize="40%" className="min-h-0 min-w-0">
        <AppMain />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function AppLayout() {
  return (
    <div className="app-window relative flex h-screen flex-col overflow-hidden bg-transparent">
      {/* RailProvider 提升 rail 展开状态（持久化 + ⌘B）；RailMenuProvider 包住 rail 与路由内容，
          模块页面通过 useRailMenu 注入的菜单才能被 rail 的 slot 读到。 */}
      <RailProvider>
        <RailMenuProvider>
          <AppShell />
        </RailMenuProvider>
      </RailProvider>
    </div>
  );
}
