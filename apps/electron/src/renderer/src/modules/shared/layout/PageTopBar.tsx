import type { ReactNode } from "react";
import { cn } from "@reflecta/ui/lib/utils";
import { SIDEBAR_COLLAPSED_OFFSET_CLASS } from "./layout-constants";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useRail } from "./rail-provider";

/**
 * 页面自管顶栏。不属于 AppLayout。
 * 侧栏展开时汉堡在 rail 顶栏；收起后红绿灯落到内容区，这里补展开按钮和左侧避让。
 */
export function PageTopBar({
  children,
  actions,
  testId,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  testId?: string;
}) {
  const { open, toggle } = useRail();

  return (
    <header
      data-testid={testId}
      className={cn(
        "app-drag-region flex h-12 shrink-0 items-center gap-2 border-b",
        open ? "px-4" : `${SIDEBAR_COLLAPSED_OFFSET_CLASS} pr-4`,
      )}
    >
      {!open ? (
        <div data-no-drag>
          <SidebarToggleButton
            expanded={false}
            label="展开导航栏"
            testId="app-nav-rail-collapse-button"
            onClick={toggle}
          />
        </div>
      ) : null}
      <div className="app-drag-region flex min-w-0 flex-1 items-center gap-2">
        <div data-no-drag className="flex min-w-0 items-center gap-2">
          {children}
        </div>
      </div>
      {actions ? (
        <div data-no-drag className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
