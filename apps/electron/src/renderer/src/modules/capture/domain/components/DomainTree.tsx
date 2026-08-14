import { Plus } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { DomainTree as DomainTreeView, type DomainTreeAction } from "@reflecta/ui/capture";
import { Button } from "@reflecta/ui/components/button";
import { ScrollArea } from "@reflecta/ui/components/scroll-area";
import { useModal } from "@reflecta/ui/overlays";
import type { DomainTreeNode } from "@shared/domain";
import { AppChromeMenu } from "@renderer/modules/shared/layout/AppChromeMenu";
import { SidebarToggleButton } from "@renderer/modules/shared/layout/SidebarToggleButton";
import { useCaptureDomains } from "../../queries";
import { useCaptureStore, type CaptureAgentScope } from "../../store";
import { useDomainActions } from "../hooks";
import { buildSiblingDomainReorderItems } from "../reorder";
import { DomainModalContent } from "./CreateDomainModal";

function getAllIds(nodes: readonly DomainTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...getAllIds(node.children)]);
}

function getAncestorIds(nodes: readonly DomainTreeNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [];
    const ancestors = getAncestorIds(node.children, targetId);
    if (ancestors) return [node.id, ...ancestors];
  }
  return null;
}

function findDomain(nodes: readonly DomainTreeNode[], targetId: string): DomainTreeNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    const found = findDomain(node.children, targetId);
    if (found) return found;
  }
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

export function DomainTree({
  onChat,
  onCollapse,
}: {
  onChat?: (scope: CaptureAgentScope) => void;
  onCollapse: () => void;
}) {
  const { domains } = useCaptureDomains();
  const { createDomain, updateDomain, deleteDomain, reorderDomains } = useDomainActions();
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const expandedDomainIds = useCaptureStore((state) => state.expandedDomainIds);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const toggleDomainExpanded = useCaptureStore((state) => state.toggleDomainExpanded);
  const reconcileExpandedDomains = useCaptureStore((state) => state.reconcileExpandedDomains);
  const expandDomainAncestors = useCaptureStore((state) => state.expandDomainAncestors);
  const resetAfterDomainDeleted = useCaptureStore((state) => state.resetAfterDomainDeleted);
  const { openModal, closeModal, confirm } = useModal();

  useEffect(() => {
    if (!selectedDomainId || selectedDomainId === "all") return;
    const ancestors = getAncestorIds(domains, selectedDomainId);
    if (ancestors) expandDomainAncestors(ancestors);
  }, [domains, selectedDomainId, expandDomainAncestors]);

  useEffect(() => {
    reconcileExpandedDomains(new Set(getAllIds(domains)));
  }, [domains, reconcileExpandedDomains]);

  const openCreateModal = (initialParentId?: string | null) => {
    openModal(
      <DomainModalContent
        data={{
          initialParentId,
          domains,
          onConfirm: async (params) => {
            await createDomain(params);
            if (params.parentId) expandDomainAncestors([params.parentId]);
          },
          onClose: closeModal,
        }}
      />,
      { title: "新建领域" },
    );
  };

  const openEditModal = (domain: DomainTreeNode) => {
    openModal(
      <DomainModalContent
        data={{
          editDomain: { id: domain.id, name: domain.name, parentId: domain.parentId },
          domains,
          onConfirm: async (params) => {
            await updateDomain(domain.id, params);
            if (params.parentId) expandDomainAncestors([params.parentId]);
          },
          onClose: closeModal,
        }}
      />,
      { title: "编辑领域" },
    );
  };

  const handleDelete = (domain: DomainTreeNode) => {
    const deletedIds = new Set([domain.id, ...getAllIds(domain.children)]);
    confirm({
      title: "删除领域",
      message: `确定要删除领域 "${domain.name}" 吗？此操作不可撤销。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteDomain(domain.id);
        resetAfterDomainDeleted(deletedIds);
      },
    });
  };

  const handleAction = (action: DomainTreeAction) => {
    const domain = findDomain(domains, action.node.id);
    if (!domain) return;

    if (action.type === "chat") {
      onChat?.({ type: "domain", id: domain.id, title: domain.name });
    } else if (action.type === "create-child") {
      openCreateModal(domain.id);
    } else if (action.type === "edit") {
      openEditModal(domain);
    } else {
      handleDelete(domain);
    }
  };

  const handleReorder = (activeId: string, overId: string) => {
    const items = buildSiblingDomainReorderItems(domains, activeId, overId);
    if (!items.length) return;
    void reorderDomains(items).catch((error) =>
      toast.error("调整领域顺序失败", { description: errorMessage(error) }),
    );
  };

  return (
    <aside
      data-testid="capture-domain-sidebar"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
    >
      <div className="app-drag-region relative pl-5 pt-14 pb-3 pr-2">
        <SidebarToggleButton
          expanded
          label="收起 Domain Tree"
          testId="capture-sidebar-collapse-button"
          className="absolute top-2.5 right-2"
          onClick={onCollapse}
        />
        <div className="flex h-8 items-center justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-medium">领域</div>
          <Button
            data-no-drag
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="新建领域"
            onClick={() => openCreateModal()}
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <DomainTreeView
          className="px-2"
          nodes={domains}
          selectedId={selectedDomainId === "all" ? null : selectedDomainId}
          expandedIds={Object.keys(expandedDomainIds).filter((id) => expandedDomainIds[id])}
          canChat={Boolean(onChat)}
          onSelect={(id) => selectDomain(id ?? "all")}
          onToggle={toggleDomainExpanded}
          onAction={handleAction}
          onReorder={handleReorder}
        />
      </ScrollArea>
      <AppChromeMenu />
    </aside>
  );
}
