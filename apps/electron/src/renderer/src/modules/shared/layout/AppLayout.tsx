import { MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@reflecta/ui/lib/utils";
import { AppNavRail } from "./AppNavRail";
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
 * App shell：rail 与主区常驻同一 flex 结构（不再按 open 分支换结构，避免页面 remount），
 * 收起/展开通过 motion 动画 width。
 *
 * 动画参考（joshuawootonn.com/sidebar-animation-performance，对比 Notion/Linear/Gitlab）：
 * - 缓动用 easeOutQuint 曲线 cubic-bezier(0.165, 0.84, 0.44, 1)，300ms；initial={false} 不播首帧动画
 * - 动画期间 sidebar 内容不能 reflow/挤压：内容层固定为展开宽度（--rail-content-width），
 *   只被 overflow-hidden 裁剪，文字不回绕（Notion 模式）
 * - 拖拽实时改宽（duration 0），松手超过 MIN 持久化，拖到 MIN 以下视为收起
 */

/** 动画默认过渡（MotionConfig 注入；拖拽时用 duration 0 覆盖） */
const RAIL_TRANSITION = {
  type: "tween",
  ease: [0.165, 0.84, 0.44, 1],
  duration: 0.3,
} as const;

function AppMain() {
  return (
    <main className="m-0 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background shadow-sm ring-1 ring-foreground/10">
      <Outlet />
    </main>
  );
}

function AppShell() {
  const { open, setOpen } = useRail();
  const [width, setWidthState] = useState<number>(() => readRailWidth());
  const [dragging, setDragging] = useState(false);
  /** 收起动画播完后内容层才 hidden（避免滑出过程内容瞬间消失） */
  const [railContentHidden, setRailContentHidden] = useState<boolean>(() => !open);
  const shellRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(width);
  /** 最近一次「展开态」宽度：拖拽到 MIN 以下不覆盖，重开时恢复它 */
  const lastOpenWidthRef = useRef(width);

  // open 变化：收起 → 0；展开 → 恢复最近展开宽度（动画由 motion 完成）
  useEffect(() => {
    setWidthState(open ? lastOpenWidthRef.current : 0);
  }, [open]);

  const setWidth = useCallback((next: number) => {
    widthRef.current = next;
    setWidthState(next);
  }, []);

  // ── handle 拖拽（pointer capture 到 handle 自身） ──────────────────────────
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open) return;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [open],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !shellRef.current) return;
      const rect = shellRef.current.getBoundingClientRect();
      const next = Math.min(MAX_RAIL_WIDTH_PX, Math.max(0, event.clientX - rect.left));
      setWidth(next);
    },
    [dragging, setWidth],
  );

  const finishDrag = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    // 拖到 MIN 以下松开 = 收起；否则把当前宽度记为「待恢复宽度」并持久化
    if (widthRef.current < MIN_RAIL_WIDTH_PX) {
      setOpen(false);
    } else {
      lastOpenWidthRef.current = widthRef.current;
      persistRailWidth(widthRef.current);
    }
  }, [dragging, setOpen]);

  return (
    <div ref={shellRef} className="flex min-h-0 flex-1 overflow-hidden">
      {/* 内容层固定为展开宽度（--rail-content-width），动画期间只裁剪不重排；
          收起动画播放完后（onAnimationComplete）才 visibility:hidden ——
          语义上菜单不可见/不可聚焦（e2e toBeHidden 契约），视觉上保留完整滑出。 */}
      <motion.div
        data-testid="app-rail-shell"
        className="h-full shrink-0 overflow-hidden"
        style={
          {
            "--rail-content-width": `${dragging ? width : lastOpenWidthRef.current}px`,
            visibility: open || !railContentHidden ? "visible" : "hidden",
          } as CSSProperties
        }
        initial={false}
        animate={{ width: open ? width : 0 }}
        transition={dragging ? { duration: 0 } : undefined}
        onAnimationComplete={() => setRailContentHidden(!open)}
      >
        <AppNavRail />
      </motion.div>

      {/* 细线拖拽条：w-2 热区叠在 1px 分割线上方 */}
      <div
        className={cn(
          "group relative z-10 h-full w-2 shrink-0 cursor-col-resize -mx-1",
          !open && "pointer-events-none opacity-0",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        data-testid="app-rail-resize-handle"
      >
        <div
          className={cn(
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border",
            dragging ? "bg-ring" : "group-hover:bg-foreground/30",
          )}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1">
        <AppMain />
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="app-window relative flex h-screen flex-col overflow-hidden bg-transparent">
      {/* RailProvider 提升 rail 展开状态（持久化 + ⌘B）；RailMenuProvider 包住 rail 与路由内容，
          模块页面通过 useRailMenu 注入的菜单才能被 rail 的 slot 读到。
          MotionConfig：跟随系统减弱动画偏好。 */}
      <RailProvider>
        <RailMenuProvider>
          <MotionConfig reducedMotion="user" transition={RAIL_TRANSITION}>
            <AppShell />
          </MotionConfig>
        </RailMenuProvider>
      </RailProvider>
    </div>
  );
}
