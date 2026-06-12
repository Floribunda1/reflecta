import { ReactNode, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

export interface PanelConfig {
  id: string;
  defaultSize: number;
  minSize?: number;
  collapsedSize?: number;
}

export type ResizablePanelsHandle = {
  togglePanel: (index: number, collapsed: boolean) => void;
};

type ResizablePanelsProps = {
  panels: PanelConfig[];
  gutterSize?: number;
  children?: ReactNode;
  slots?: Record<string, ReactNode>;
};

export const ResizablePanels = forwardRef<ResizablePanelsHandle, ResizablePanelsProps>(
  ({ panels, gutterSize = 4, slots = {} }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [sizes, setSizes] = useState<number[]>(() => panels.map((p) => p.defaultSize));
    const [collapsedStates, setCollapsedStates] = useState<boolean[]>(() =>
      panels.map(() => false),
    );
    const savedSizes = useRef<Map<number, number>>(new Map());

    useEffect(() => {
      setSizes(panels.map((p) => p.defaultSize));
      setCollapsedStates(panels.map(() => false));
    }, [panels]);

    const togglePanel = (index: number, collapsed: boolean) => {
      setCollapsedStates((current) => {
        if (current[index] === collapsed) return current;
        const nextCollapsed = [...current];
        nextCollapsed[index] = collapsed;
        setSizes((currentSizes) => {
          const nextSizes = [...currentSizes];
          const containerWidth = containerRef.current?.clientWidth || 1000;
          const collapsedPx = panels[index].collapsedSize || 32;
          const collapsedPercent = (collapsedPx / containerWidth) * 100;
          if (collapsed) {
            savedSizes.current.set(index, currentSizes[index]);
            nextSizes[index] = collapsedPercent;
          } else {
            nextSizes[index] = savedSizes.current.get(index) ?? panels[index].defaultSize;
            savedSizes.current.delete(index);
          }
          return nextSizes;
        });
        return nextCollapsed;
      });
    };

    useImperativeHandle(ref, () => ({ togglePanel }), [panels]);

    const startResize = (event: React.MouseEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      const startX = event.pageX;
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const panelEls = container.querySelectorAll<HTMLElement>(".resizable-panel");
      const startWidths = Array.from(panelEls).map((el) => el.offsetWidth);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.pageX - startX;
        const leftMin = panels[index].minSize || 120;
        const rightMin = panels[index + 1].minSize || 120;
        const newLeft = startWidths[index] + dx;
        const newRight = startWidths[index + 1] - dx;
        if (newLeft < leftMin || newRight < rightMin) return;
        setSizes((current) => {
          const next = [...current];
          next[index] = (newLeft / containerWidth) * 100;
          if (index + 1 < panels.length - 1) next[index + 1] = (newRight / containerWidth) * 100;
          return next;
        });
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const elements: ReactNode[] = [];
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const collapsed = collapsedStates[i];
      const isLast = i === panels.length - 1;
      const style: React.CSSProperties = {};
      if (collapsed) {
        style.flex = `0 0 ${panel.collapsedSize || 32}px`;
      } else if (isLast) {
        style.flex = "1 1 auto";
        style.minWidth = `${panel.minSize || 120}px`;
      } else {
        style.flex = `0 0 ${sizes[i]}%`;
        style.minWidth = `${panel.minSize || 120}px`;
      }

      elements.push(
        <div
          key={panel.id}
          className={[
            "resizable-panel flex h-full flex-col overflow-hidden bg-background",
            collapsed ? "items-center border-r border-border" : "",
          ].join(" ")}
          style={style}
        >
          {slots[panel.id]}
        </div>,
      );

      if (!isLast && !collapsed && !collapsedStates[i + 1]) {
        elements.push(
          <div
            key={`gutter-${i}`}
            className="resizable-gutter h-full shrink-0 cursor-col-resize bg-border transition-colors hover:bg-muted-foreground"
            style={{ width: `${gutterSize}px` }}
            onMouseDown={(event) => startResize(event, i)}
          />,
        );
      }
    }

    return (
      <div ref={containerRef} className="flex h-full w-full select-none">
        {elements}
      </div>
    );
  },
);

ResizablePanels.displayName = "ResizablePanels";
