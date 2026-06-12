import { Button } from "@renderer/components/ui/button";
import { ButtonGroup } from "@renderer/components/ui/button-group";
import { AtSign, Folder, GitBranch, Search } from "lucide-react";
import { useChatPageContext } from "../context";
import type { KnowledgePanelMode } from "../state/types";
import { BrowsePanel } from "./panel/BrowsePanel";
import { GraphPanel } from "./panel/GraphPanel";
import { ReferencesPanel } from "./panel/ReferencesPanel";
import { SearchPanel } from "./panel/SearchPanel";

const MODES: Array<{ mode: KnowledgePanelMode; label: string; Icon: typeof Folder }> = [
  { mode: "browse", label: "浏览", Icon: Folder },
  { mode: "search", label: "搜索", Icon: Search },
  { mode: "references", label: "引用", Icon: AtSign },
  { mode: "graph", label: "图谱", Icon: GitBranch },
];

export function KnowledgePanel() {
  const ctx = useChatPageContext();

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        <ButtonGroup>
          {MODES.map(({ mode, label, Icon }) => (
            <Button
              key={mode}
              type="button"
              variant={ctx.panelMode === mode ? "default" : "secondary"}
              onClick={() => ctx.setPanelMode(mode)}
            >
              <Icon size={14} />
              {label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {ctx.panelMode === "browse" && <BrowsePanel />}
        {ctx.panelMode === "search" && <SearchPanel />}
        {ctx.panelMode === "references" && <ReferencesPanel />}
        {ctx.panelMode === "graph" && <GraphPanel />}
      </div>
    </aside>
  );
}
