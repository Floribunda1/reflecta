import { useState } from "react";
import { Button } from "@renderer/components/ui/button";
import { Database, Sparkles, Trash2 } from "lucide-react";
import { AiSection } from "./AiSection";
import { StorageSection } from "./StorageSection";
import { TrashSection } from "./TrashSection";

const MENU_ITEMS = [
  { key: "storage", label: "存储", icon: Database },
  { key: "ai", label: "AI", icon: Sparkles },
  { key: "trash", label: "回收站", icon: Trash2 },
] as const;
type MenuKey = (typeof MENU_ITEMS)[number]["key"];

export function SettingsDialogContent() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("storage");

  return (
    <div className="flex h-[76vh] bg-background">
      <aside className="flex w-44 shrink-0 flex-col border-r border-border px-3 py-4">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={activeMenu === item.key ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveMenu(item.key)}
            >
              <Icon size={14} />
              <span className="font-medium">{item.label}</span>
            </Button>
          );
        })}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
        {activeMenu === "storage" && <StorageSection />}
        {activeMenu === "ai" && <AiSection />}
        {activeMenu === "trash" && <TrashSection />}
      </main>
    </div>
  );
}
