import { defineComponent, ref } from "vue";
import { AiSection } from "./AiSection";
import { StorageSection } from "./StorageSection";
import { TrashSection } from "./TrashSection";

const MENU_ITEMS = [
  { key: "storage", label: "存储", icon: "pi pi-database" },
  { key: "ai", label: "AI", icon: "pi pi-sparkles" },
  { key: "trash", label: "回收站", icon: "pi pi-trash" },
] as const;
type MenuKey = (typeof MENU_ITEMS)[number]["key"];

export const SettingsDialogContent = defineComponent({
  name: "SettingsDialogContent",
  setup() {
    const activeMenu = ref<MenuKey>("storage");

    return () => (
      <div class="flex h-[76vh] bg-surface-0">
        <aside class="flex w-44 shrink-0 flex-col border-r border-surface-100 px-3 py-4">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              class={[
                "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors duration-150",
                activeMenu.value === item.key
                  ? "bg-surface-100 text-color"
                  : "text-muted-color hover:bg-surface-50 hover:text-color",
              ]}
              onClick={() => (activeMenu.value = item.key)}
            >
              <i class={[item.icon, "text-xs"]} />
              <span class="font-medium">{item.label}</span>
            </button>
          ))}
        </aside>

        <main class="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          {activeMenu.value === "storage" && <StorageSection />}
          {activeMenu.value === "ai" && <AiSection />}
          {activeMenu.value === "trash" && <TrashSection />}
        </main>
      </div>
    );
  },
});
