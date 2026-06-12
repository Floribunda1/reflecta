import type { MouseEventHandler, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

type Placement = "bottom end" | "bottom start" | "bottom" | "top end" | "top start" | "top";

function getPlacement(placement?: Placement): {
  side: "bottom" | "top";
  align: "start" | "center" | "end";
} {
  if (!placement) return { side: "bottom", align: "center" };
  const [side, align] = placement.split(" ");
  return {
    side: side === "top" ? "top" : "bottom",
    align: align === "start" || align === "end" ? align : "center",
  };
}

function Root({ children }: { children: ReactNode }) {
  return <DropdownMenu>{children}</DropdownMenu>;
}

function Trigger({
  children,
  className,
  isDisabled,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  isDisabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        disabled={isDisabled}
        onClick={onClick}
      >
        {children}
      </button>
    </DropdownMenuTrigger>
  );
}

function Popover({ children, placement }: { children: ReactNode; placement?: Placement }) {
  const { side, align } = getPlacement(placement);
  return (
    <DropdownMenuContent side={side} align={align}>
      {children}
    </DropdownMenuContent>
  );
}

function Menu({ children }: { children: ReactNode; "aria-label"?: string }) {
  return <>{children}</>;
}

function Item({
  children,
  onAction,
  variant,
}: {
  id?: string;
  children: ReactNode;
  onAction?: () => void;
  variant?: "danger";
}) {
  return (
    <DropdownMenuItem
      variant={variant === "danger" ? "destructive" : "default"}
      onSelect={onAction}
    >
      {children}
    </DropdownMenuItem>
  );
}

export const Dropdown = Object.assign(Root, {
  Trigger,
  Popover,
  Menu,
  Item,
});
