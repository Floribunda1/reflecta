import { useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { cn } from "@renderer/lib/utils";
import { Database, Search, Sparkles, Trash2 } from "lucide-react";
import { AiSection } from "./AiSection";
import { RetrievalSection } from "./RetrievalSection";
import { StorageSection } from "./StorageSection";
import { TrashSection } from "./TrashSection";

const MENU_ITEMS = [
  { key: "storage", label: "存储", icon: Database },
  { key: "ai", label: "AI", icon: Sparkles },
  { key: "retrieval", label: "语义检索", icon: Search },
  { key: "trash", label: "回收站", icon: Trash2 },
] as const;
type MenuKey = (typeof MENU_ITEMS)[number]["key"];

export function SettingsDialogContent() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("storage");

  return (
    <div className="-mx-6 -mb-6 flex h-[80vh] overflow-hidden border-t border-border/70">
      <aside className="flex w-44 shrink-0 flex-col border-r border-border/70 bg-muted/20 p-3">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeMenu === item.key;
          return (
            <Button
              key={item.key}
              data-testid={`settings-menu-${item.key}`}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "h-8 w-full justify-start gap-2 px-2 text-muted-foreground",
                active && "bg-muted text-foreground",
              )}
              onClick={() => setActiveMenu(item.key)}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </aside>

      {activeMenu === "ai" ? (
        <main className="h-full min-h-0 min-w-0 flex-1 px-6 py-5">
          <AiSection />
        </main>
      ) : (
        <ScrollArea className="min-w-0 flex-1">
          <main className="mx-auto w-full px-6 py-5">
            {activeMenu === "storage" && <StorageSection />}
            {activeMenu === "retrieval" && <RetrievalSection />}
            {activeMenu === "trash" && <TrashSection />}
          </main>
        </ScrollArea>
      )}
    </div>
  );
}
