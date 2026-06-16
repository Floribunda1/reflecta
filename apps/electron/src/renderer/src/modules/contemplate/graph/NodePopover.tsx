import { useEffect, useRef } from "react";
import { computePosition, offset, flip, shift } from "@floating-ui/dom";
import type { VirtualElement } from "@floating-ui/dom";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";

export interface NodePopoverData {
  title: string;
  body: string;
  contextCount: number;
  connectionCount: number;
  hasContext: boolean;
  isIsolated: boolean;
}

export function NodePopover({ data, x, y }: { data: NodePopoverData; x: number; y: number }) {
  const floatingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = floatingRef.current;
    if (!el) return;
    const reference: VirtualElement = {
      getBoundingClientRect() {
        return DOMRect.fromRect({ x, y, width: 0, height: 0 });
      },
    };
    void computePosition(reference, el, {
      placement: "right-start",
      strategy: "fixed",
      middleware: [offset(16), flip(), shift({ padding: 8 })],
    }).then((pos) => {
      el.style.position = "fixed";
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
    });
  }, [x, y]);

  return (
    <div
      ref={floatingRef}
      className="pointer-events-none z-50 w-96 rounded-xl border border-border bg-popover p-4 shadow-xl"
    >
      {data.title && <div className="mb-2 text-sm font-semibold text-foreground">{data.title}</div>}
      <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        <span className="rounded-sm bg-muted px-1.5 py-0.5">{data.contextCount} Context</span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5">
          {data.isIsolated ? "未连接" : `${data.connectionCount} 连接`}
        </span>
      </div>
      {data.body && <SimpleMarkdownPreview content={data.body} lineClamp={5} />}
    </div>
  );
}
