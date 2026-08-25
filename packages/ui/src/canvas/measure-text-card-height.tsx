import { createRoot, type Root } from "react-dom/client";
import { MarkdownPreview } from "../editor/markdown-preview";

/**
 * offscreen 文本卡高测量：复刻 text 卡正文容器（固定宽 + p-2 + MarkdownPreview），
 * 塞进隐藏 host 让浏览器用真实 CSS 布局，读实际内容高。
 *
 * 返回「正文内容 + padding」的总高（不含卡片边框；节点高需另加边框）。
 * 依赖真实字体渲染，调用方应等 `document.fonts.ready` 后再量。
 */
export const TEXT_CARD_WIDTH = 220;
const CARD_BORDER = 2;

export async function measureTextCardContentHeight(markdown: string): Promise<number> {
  await setupHostFonts();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;";
  host.style.width = `${TEXT_CARD_WIDTH - CARD_BORDER}px`;
  const body = document.createElement("div");
  body.className = "nowheel min-h-0 p-2"; // 复刻 CanvasTextCard 正文容器（无滚动条）
  host.appendChild(body);
  document.body.appendChild(host);
  let root: Root | undefined;
  try {
    root = createRoot(body);
    root.render(<MarkdownPreview value={markdown} zoomImages={false} />);
    await nextFrame();
    await document.fonts.ready;
    await nextFrame();
    return (body.scrollHeight ?? TEXT_CARD_WIDTH) + CARD_BORDER;
  } finally {
    root?.unmount();
    host.remove();
  }
}

function setupHostFonts(): Promise<unknown> {
  return document.fonts?.ready ?? Promise.resolve();
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
