import { PanelLeft, PanelLeftDashed } from "lucide-react";
import { Button } from "@reflecta/ui/components/button";
import { cn } from "@reflecta/ui/lib/utils";

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
  const Icon = expanded ? PanelLeft : PanelLeftDashed;

  return (
    <Button
      data-no-drag
      data-testid={testId}
      type="button"
      size="icon-sm"
      variant="ghost"
      className={cn(className)}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={16} />
    </Button>
  );
}
