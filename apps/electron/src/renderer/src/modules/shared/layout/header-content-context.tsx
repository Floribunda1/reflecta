import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * 全局 AppHeader 的「模块内容 slot」。
 *
 * 设计：AppHeader 默认只显示当前模块标题（Capture/Agent/…）。需要更丰富头部的
 * 模块（如 Agent 页要把「线程标题 + 操作」合并进全局 header）通过 useHeaderContent
 * 注入 { title, actions }，AppHeader 渲染为：
 *
 *   [collapse] ┃  title …… actions
 *
 * Provider 必须同时包住 AppHeader 与路由内容（见 AppLayout），模块页面才能写入、
 * AppHeader 才能读到。未注入时回落为模块标题，保证灰色常驻 header 的语义。
 */

export type HeaderContent = { title?: ReactNode; actions?: ReactNode } | null;

const HeaderContentContext = createContext<{
  content: HeaderContent;
  setContent: (content: HeaderContent) => void;
} | null>(null);

export function HeaderContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<HeaderContent>(null);
  const value = useMemo(() => ({ content, setContent }), [content]);
  return <HeaderContentContext.Provider value={value}>{children}</HeaderContentContext.Provider>;
}

/** 模块注入自己的全局 header 内容；卸载时清空（回到模块标题）。 */
export function useHeaderContent(content: HeaderContent) {
  const context = useContext(HeaderContentContext);
  useEffect(() => {
    context?.setContent(content);
    return () => context?.setContent(null);
  }, [context, content]);
}

/** AppHeader 读取当前模块注入的内容。 */
export function useHeaderContentSlot(): HeaderContent {
  const context = useContext(HeaderContentContext);
  return context?.content ?? null;
}
