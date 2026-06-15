import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@renderer/components/ui/sheet";
import { cn } from "@renderer/lib/utils";

type DrawerProps = {
  header?: ReactNode;
  title?: ReactNode;
  className?: string;
  widthClassName?: string;
  onClose?: () => void;
};

type DrawerContextValue = {
  openDrawer: (props: DrawerProps, children: ReactNode) => void;
  closeDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerContextProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<{ props: DrawerProps; children: ReactNode } | null>(null);
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
        current.props.onClose?.();
        closingRef.current = true;
      }
      return current;
    });
    setOpen(false);
  }, []);

  const openDrawer = useCallback((props: DrawerProps, content: ReactNode) => {
    if (openFrameRef.current !== null) {
      cancelAnimationFrame(openFrameRef.current);
    }

    closingRef.current = false;
    setOpen(false);
    setDrawer({ props, children: content });
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
            className={cn(drawer.props.widthClassName ?? "max-w-xl", drawer.props.className ?? "")}
          >
            {(drawer.props.header ?? drawer.props.title) && (
              <SheetHeader>
                <SheetTitle className="text-lg font-semibold">
                  {drawer.props.header ?? drawer.props.title}
                </SheetTitle>
              </SheetHeader>
            )}
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">{drawer.children}</div>
          </SheetContent>
        </Sheet>
      )}
    </DrawerContext.Provider>
  );
}

export const useSharedDrawer = () => {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useSharedDrawer must be used within DrawerContextProvider");
  return ctx;
};
