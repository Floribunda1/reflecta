import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@renderer/components/ui/dialog";

type ModalOptions = {
  title?: string;
  className?: string;
  widthClassName?: string;
};

type ModalState = {
  content: ReactNode;
  options: ModalOptions;
} | null;

type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  acceptLabel?: string;
  rejectLabel?: string;
  danger?: boolean;
  onAccept: () => void | Promise<void>;
};

type ModalContextValue = {
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
  confirm: (options: ConfirmOptions) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);

  const closeModal = useCallback(() => setModal(null), []);

  const openModal = useCallback((content: ReactNode, options: ModalOptions = {}) => {
    setModal({ content, options });
  }, []);

  const confirm = useCallback(
    ({
      title = "确认操作",
      message,
      acceptLabel = "确认",
      rejectLabel = "取消",
      danger,
      onAccept,
    }: ConfirmOptions) => {
      setModal({
        options: { title, widthClassName: "max-w-md" },
        content: (
          <div className="space-y-5">
            <div className="text-sm leading-6 text-muted-foreground">{message}</div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeModal}>
                {rejectLabel}
              </Button>
              <Button
                type="button"
                variant={danger ? "destructive" : "default"}
                size="sm"
                onClick={() => {
                  void Promise.resolve(onAccept()).finally(closeModal);
                }}
              >
                {acceptLabel}
              </Button>
            </div>
          </div>
        ),
      });
    },
    [closeModal],
  );

  const value = useMemo(
    () => ({ openModal, closeModal, confirm }),
    [openModal, closeModal, confirm],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modal && (
        <Dialog open={!!modal} onOpenChange={(isOpen) => !isOpen && closeModal()}>
          <DialogContent
            className={[
              modal.options.widthClassName ?? "max-w-3xl",
              "max-h-[90vh] overflow-y-auto",
              modal.options.className ?? "",
            ].join(" ")}
          >
            {modal.options.title && (
              <DialogHeader>
                <DialogTitle className="font-semibold">{modal.options.title}</DialogTitle>
              </DialogHeader>
            )}
            {modal.content}
          </DialogContent>
        </Dialog>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal must be used within ModalProvider");
  return context;
}
