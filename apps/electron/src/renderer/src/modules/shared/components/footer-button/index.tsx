import type { ComponentProps } from "react";
import { Button } from "@renderer/components/ui/button";

type FooterButtonProps = {
  okProps?: ComponentProps<typeof Button>;
  cancelProps?: ComponentProps<typeof Button>;
};

export function FooterButton({ okProps, cancelProps }: FooterButtonProps) {
  return (
    <div className="flex w-full justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        {...cancelProps}
        className={["border-border text-muted-foreground", cancelProps?.className ?? ""].join(" ")}
      >
        {cancelProps?.children ?? "取消"}
      </Button>
      <Button
        variant="default"
        size="sm"
        {...okProps}
        className={["bg-primary text-white", okProps?.className ?? ""].join(" ")}
      >
        {okProps?.children ?? "确定"}
      </Button>
    </div>
  );
}
