import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "#components/sheet";
import { cn } from "#lib/utils";

export type DrawerOptions = {
  header?: ReactNode;
  title?: ReactNode;
  className?: string;
  widthClassName?: string;
  onClose?: () => void;
};

type DrawerContextValue = {
  openDrawer: (options: DrawerOptions, content: ReactNode) => void;
  closeDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<{ options: DrawerOptions; content: ReactNode } | null>(null);
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);
  const openFrameRef = useRef<number | null>(null);

  const closeDrawer = useCallback(() => {
    if (openFrameRef.current !== null) {
      cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
    setDrawer((current) => {
      if (current && !closingRef.current) {
        current.options.onClose?.();
        closingRef.current = true;
      }
      return current;
    });
    setOpen(false);
  }, []);

  const openDrawer = useCallback((options: DrawerOptions, content: ReactNode) => {
    // DESIGN: 先挂载内容、下一帧再 setOpen(true)——让 Sheet 内容挂载到 DOM 后再
    // 播放入场动画（直接 setOpen 会在内容未就绪时开动画，导致入场闪烁/不播放）。
    if (openFrameRef.current !== null) cancelAnimationFrame(openFrameRef.current);
    closingRef.current = false;
    setOpen(false);
    setDrawer({ options, content });
    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = null;
      setOpen(true);
    });
  }, []);

  const value = useMemo(() => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      {drawer && (
        <Sheet
          open={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) closeDrawer();
          }}
          onOpenChangeComplete={(isOpen) => {
            if (!isOpen && closingRef.current) {
              setDrawer(null);
              closingRef.current = false;
            }
          }}
        >
          <SheetContent
            className={cn(
              drawer.options.widthClassName ?? "max-w-xl",
              drawer.options.className ?? "",
            )}
          >
            {(drawer.options.header ?? drawer.options.title) && (
              <SheetHeader>
                <SheetTitle>{drawer.options.header ?? drawer.options.title}</SheetTitle>
              </SheetHeader>
            )}
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{drawer.content}</div>
          </SheetContent>
        </Sheet>
      )}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error("useDrawer must be used within DrawerProvider");
  return context;
}
