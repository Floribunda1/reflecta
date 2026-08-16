import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * 全局左 rail 的「模块菜单 slot」。
 *
 * 设计：rail 本身不依赖任何业务模块。模块页面（Capture/Agent）通过 useRailMenu
 * 把各自的菜单（领域树 / 对话列表）注入 rail 的菜单区；RailMenuProvider 必须
 * 同时包住 rail 与路由内容（见 AppLayout），否则模块页面读不到 context。
 */

type RailMenuState = { key: string; node: ReactNode } | null;

const RailMenuContext = createContext<{
  menu: RailMenuState;
  setMenu: (key: string, node: ReactNode) => void;
  clearMenu: (key: string) => void;
} | null>(null);

export function RailMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenuState] = useState<RailMenuState>(null);
  const setMenu = useCallback((key: string, node: ReactNode) => {
    setMenuState((current) =>
      current?.key === key && current.node === node ? current : { key, node },
    );
  }, []);
  const clearMenu = useCallback((key: string) => {
    setMenuState((current) => (current?.key === key ? null : current));
  }, []);
  const value = useMemo(() => ({ menu, setMenu, clearMenu }), [menu, setMenu, clearMenu]);
  return <RailMenuContext.Provider value={value}>{children}</RailMenuContext.Provider>;
}

/** 模块页面注册自己的菜单；卸载时只清除自己注册的菜单，避免跨模块误清。
 * 注意：effect 只依赖稳定的 setMenu/clearMenu 引用，不能依赖整个 context 对象——
 * context.value 含 menu 字段，menu 变化会让对象引用变化，导致 set/clear 死循环。 */
export function useRailMenu(key: string, node: ReactNode) {
  const context = useContext(RailMenuContext);
  const setMenu = context?.setMenu;
  const clearMenu = context?.clearMenu;
  useEffect(() => {
    if (!setMenu || !clearMenu) return;
    setMenu(key, node);
    return () => clearMenu(key);
  }, [setMenu, clearMenu, key, node]);
}

/** rail 读取当前模块注入的菜单。 */
export function useRailMenuSlot() {
  const context = useContext(RailMenuContext);
  if (!context) throw new Error("useRailMenuSlot must be used within RailMenuProvider");
  return context.menu;
}
