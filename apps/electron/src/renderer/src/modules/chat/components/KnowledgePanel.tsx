import { defineComponent } from "vue";
import Button from "primevue/button";
import { useChatPageContext } from "../context";
import type { KnowledgePanelMode } from "../state/types";
import { BrowsePanel } from "./panel/BrowsePanel";
import { GraphPanel } from "./panel/GraphPanel";
import { ReferencesPanel } from "./panel/ReferencesPanel";
import { SearchPanel } from "./panel/SearchPanel";

const MODES: Array<{ mode: KnowledgePanelMode; label: string; icon: string }> = [
  { mode: "browse", label: "浏览", icon: "pi pi-folder" },
  { mode: "search", label: "搜索", icon: "pi pi-search" },
  { mode: "references", label: "引用", icon: "pi pi-at" },
  { mode: "graph", label: "图谱", icon: "pi pi-share-alt" },
];

export const KnowledgePanel = defineComponent({
  name: "KnowledgePanel",
  setup() {
    const ctx = useChatPageContext()!;

    return () => (
      <aside class="flex h-full w-[360px] shrink-0 flex-col border-l border-surface-200 bg-surface-0">
        <div class="flex items-center gap-1 border-b border-surface-200 px-2 py-2">
          {MODES.map(({ mode, label, icon }) => (
            <Button
              key={mode}
              label={label}
              icon={icon}
              size="small"
              text={ctx.panelMode.value !== mode}
              severity={ctx.panelMode.value === mode ? "primary" : "secondary"}
              onClick={() => {
                ctx.panelMode.value = mode;
              }}
            />
          ))}
        </div>

        <div class="min-h-0 flex-1 overflow-hidden">
          {ctx.panelMode.value === "browse" && <BrowsePanel />}
          {ctx.panelMode.value === "search" && <SearchPanel />}
          {ctx.panelMode.value === "references" && <ReferencesPanel />}
          {ctx.panelMode.value === "graph" && <GraphPanel />}
        </div>
      </aside>
    );
  },
});
