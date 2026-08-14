import type { ComponentProps } from "react";
import { cn } from "@reflecta/ui/lib/utils";

/**
 * 面板头部栏 —— 应用级面板 header 的统一骨架。
 *
 * capture / knowledge-wander / agent-thread-panel 三处面板共用
 * `flex h-14 shrink-0 items-center border-b` 结构；px/gap/背景/拖拽区
 * 等差异由使用处 className 补充（audit 结构层抽取）。
 */
export function PanelHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header className={cn("flex h-12 shrink-0 items-center border-b px-5", className)} {...props} />
  );
}
