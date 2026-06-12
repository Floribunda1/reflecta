import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@renderer/components/ui/sheet";

type DrawerProps = {
  header?: ReactNode;
  title?: ReactNode;
  className?: string;
  widthClassName?: string;
};

type DrawerContextValue = {
  openDrawer: (props: DrawerProps, children: ReactNode) => void;
  closeDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerContextProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<{ props: DrawerProps; children: ReactNode } | null>(null);

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const openDrawer = useCallback((props: DrawerProps, content: ReactNode) => {
    setDrawer({ props, children: content });
  }, []);

  const value = useMemo(() => ({ openDrawer, closeDrawer }), [openDrawer, closeDrawer]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      {drawer && (
        <Sheet open={!!drawer} onOpenChange={(isOpen) => !isOpen && closeDrawer()}>
          <SheetContent
            className={[
              drawer.props.widthClassName ?? "max-w-xl",
              drawer.props.className ?? "",
            ].join(" ")}
          >
            {(drawer.props.header ?? drawer.props.title) && (
              <SheetHeader>
                <SheetTitle>{drawer.props.header ?? drawer.props.title}</SheetTitle>
              </SheetHeader>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{drawer.children}</div>
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
