import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "#components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#components/dialog";

export type ModalOptions = {
  title?: string;
  className?: string;
  widthClassName?: string;
};

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  acceptLabel?: string;
  rejectLabel?: string;
  danger?: boolean;
  onAccept: () => void | Promise<void>;
};

type ModalState = {
  content: ReactNode;
  options: ModalOptions;
};

type ModalContextValue = {
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
  confirm: (options: ConfirmOptions) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalState[]>([]);
  const closeModal = useCallback(() => setModals((current) => current.slice(0, -1)), []);
  const openModal = useCallback((content: ReactNode, options: ModalOptions = {}) => {
    // DESIGN: openModal 是「主内容浮层」——排他替换当前 modal（Settings 对话框、
    // 编辑弹窗场景）；confirm 则是叠加确认（push 到现有 modal 之上）。两个 API
    // 行为不同是有意的：主内容不叠加，确认浮在主内容之上。
    setModals([{ content, options }]);
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
      setModals((current) => [
        ...current,
        {
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
                  onClick={() => void Promise.resolve(onAccept()).finally(closeModal)}
                >
                  {acceptLabel}
                </Button>
              </div>
            </div>
          ),
        },
      ]);
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
      {modals.map((modal, index) => (
        <Dialog key={index} open onOpenChange={(isOpen) => !isOpen && closeModal()}>
          <DialogContent
            className={[
              modal.options.widthClassName ?? "max-w-3xl",
              "max-h-[90vh] overflow-y-auto",
              modal.options.className ?? "",
            ].join(" ")}
          >
            {modal.options.title && (
              <DialogHeader>
                <DialogTitle>{modal.options.title}</DialogTitle>
              </DialogHeader>
            )}
            {modal.content}
          </DialogContent>
        </Dialog>
      ))}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useModal must be used within ModalProvider");
  return context;
}
