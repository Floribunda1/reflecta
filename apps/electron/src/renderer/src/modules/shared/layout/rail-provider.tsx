import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useKeyPress } from "ahooks";

/**
 * 全局左 rail 的展开状态（对齐 shadcn dashboard-01 的 SidebarProvider）。
 *
 * 设计：collapse 状态不再属于 AppNavRail 单个组件，而是提升到 Provider——
 * rail 顶栏 / 各页 PageTopBar 的 trigger、⌘/Ctrl+B 快捷键都能读写，
 * 并通过 `state`（expanded/collapsed）暴露给 tailwind 的 data-state 选择器。
 *
 * 语义采用 dashboard-01 安装态的 `offcanvas`：收起时整栏宽度归 0（内容全宽），
 * 展开时汉堡在 rail 顶栏（与红绿灯同行）；收起后由各页 PageTopBar 提供恢复入口。
 * 状态持久化到 localStorage（Electron 桌面应用；shadcn 用 cookie，思路一致）。
 */

const RAIL_STORAGE_KEY = "reflecta.rail.open";

type RailState = "expanded" | "collapsed";

type RailContextValue = {
  /** rail 是否展开（默认 true）。 */
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** 供 data-state 暴露给 CSS 的枚举态。 */
  state: RailState;
};

const RailContext = createContext<RailContextValue | null>(null);

function readStoredOpen(): boolean | null {
  try {
    const raw = localStorage.getItem(RAIL_STORAGE_KEY);
    if (raw === null) return null;
    return raw === "true";
  } catch {
    return null;
  }
}

export function RailProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState<boolean>(() => readStoredOpen() ?? true);

  // 状态变更持久化（Electron 桌面全局唯一，写入一次即可，无竞态风险）。
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_STORAGE_KEY, String(open));
    } catch {
      // 存储不可用时静默降级为非持久状态。
    }
  }, [open]);

  const setOpen = useCallback((next: boolean) => setOpenState(next), []);
  const toggle = useCallback(() => setOpenState((current) => !current), []);

  // ⌘/Ctrl + B 切换 rail（对齐 shadcn Sidebar 快捷方式；meta=Mac ⌘，ctrl=Windows/Linux）。
  useKeyPress(["meta.b", "ctrl.b"], () => toggle(), { exactMatch: true });

  const value = useMemo<RailContextValue>(
    () => ({ open, setOpen, toggle, state: open ? "expanded" : "collapsed" }),
    [open, setOpen, toggle],
  );

  return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

export function useRail(): RailContextValue {
  const context = useContext(RailContext);
  if (!context) throw new Error("useRail must be used within RailProvider.");
  return context;
}
