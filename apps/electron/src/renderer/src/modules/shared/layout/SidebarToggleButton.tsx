import { ChevronLeft, PanelLeft } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";

export function SidebarToggleButton({
  expanded,
  label,
  testId,
  className,
  onClick,
}: {
  expanded: boolean;
  label: string;
  testId: string;
  className?: string;
  onClick: () => void;
}) {
  const Icon = expanded ? ChevronLeft : PanelLeft;

  return (
    <Button
      data-no-drag
      data-testid={testId}
      type="button"
      size="icon-sm"
      variant="ghost"
      className={cn("size-8 hover:bg-foreground/5 hover:text-foreground", className)}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={16} />
    </Button>
  );
}
