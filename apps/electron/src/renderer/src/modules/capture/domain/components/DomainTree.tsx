import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import { ChevronDown, ChevronRight, Layers, Plus } from "lucide-react";
import type { DomainTreeNode } from "@shared/domain";
import { cn } from "@renderer/lib/utils";
import { useDomainActions } from "../hooks";
import { useModal } from "@renderer/modules/shared/hooks/use-modal";
import { DomainModalContent } from "./CreateDomainModal";
import { useCaptureStore } from "../../store";
import { useCaptureDomains } from "../../queries";
import { AppChromeMenu } from "@renderer/modules/shared/layout/AppChromeMenu";
import type { CaptureAgentScope } from "../../store";
import { buildDomainParentLookup, buildSiblingDomainReorderItems } from "../reorder";

function getAllKeys(nodes: DomainTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...getAllKeys(node.children)]);
}

function getAncestorKeys(nodes: DomainTreeNode[], targetKey: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetKey) return [];
    const ancestors = getAncestorKeys(node.children, targetKey);
    if (ancestors !== null) return [node.id, ...ancestors];
  }
  return null;
}

function findNodeWithLevel(
  nodes: DomainTreeNode[],
  targetKey: string,
  level = 0,
): { node: DomainTreeNode; level: number } | null {
  for (const node of nodes) {
    if (node.id === targetKey) return { node, level };
    const found = findNodeWithLevel(node.children, targetKey, level + 1);
    if (found) return found;
  }
  return null;
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string")
    return error.message;
  return error instanceof Error ? error.message : "请稍后重试";
}

type DomainNodeActions = {
  onCreateChild: (node: DomainTreeNode) => void;
  onEdit: (node: DomainTreeNode) => void;
  onDelete: (node: DomainTreeNode) => void;
  onChat?: (scope: CaptureAgentScope) => void;
};

function domainTreeButtonClassName(selected: boolean, dragging = false) {
  return cn(
    "w-full min-w-0 cursor-default justify-start p-1.5 text-left font-normal text-foreground/85 hover:bg-foreground/5 hover:text-foreground focus-visible:border-transparent focus-visible:bg-foreground/5 focus-visible:ring-0",
    selected && "bg-foreground/5 text-foreground font-medium hover:bg-foreground/5",
    dragging &&
      "bg-transparent text-foreground/85 hover:bg-transparent hover:text-foreground/85 focus-visible:bg-transparent",
  );
}

function DomainMenuItems({
  node,
  actions,
  Item,
  Separator,
}: {
  node: DomainTreeNode;
  actions: DomainNodeActions;
  Item: typeof ContextMenuItem;
  Separator: typeof ContextMenuSeparator;
}) {
  return (
    <>
      {actions.onChat ? (
        <>
          <Item onClick={() => actions.onChat?.({ type: "domain", id: node.id, title: node.name })}>
            和 AI 聊聊
          </Item>
          <Separator />
        </>
      ) : null}
      <Item onClick={() => actions.onCreateChild(node)}>新建子领域</Item>
      <Item onClick={() => actions.onEdit(node)}>编辑领域</Item>
      <Separator />
      <Item variant="destructive" onClick={() => actions.onDelete(node)}>
        删除
      </Item>
    </>
  );
}

function DomainNode({
  node,
  level = 0,
  selectedDomainId,
  expandedKeys,
  onToggle,
  onSelect,
  actions,
}: {
  node: DomainTreeNode;
  level?: number;
  selectedDomainId: string;
  expandedKeys: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  actions: DomainNodeActions;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const expanded = !!expandedKeys[node.id];
  const hasChildren = node.children.length > 0;
  const selected = selectedDomainId === node.id;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-0")}
      data-testid="capture-domain-sortable-node"
      data-domain-name={node.name}
    >
      <div>
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <Button
                data-testid="capture-domain-node"
                data-domain-name={node.name}
                type="button"
                variant="ghost"
                size="sm"
                className={domainTreeButtonClassName(selected, isDragging)}
                style={{ touchAction: "none" }}
                onClick={() => onSelect(node.id)}
                {...attributes}
                {...listeners}
              >
                <span
                  className="flex min-w-0 flex-1 items-center gap-1"
                  style={{ paddingLeft: `calc(${level} * 0.875rem)` }}
                >
                  {hasChildren ? (
                    <span
                      data-testid="capture-domain-toggle"
                      data-domain-name={node.name}
                      className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(node.id);
                      }}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  ) : (
                    <span className="size-6 shrink-0" />
                  )}
                  <span className="min-w-0 truncate">{node.name}</span>
                </span>
              </Button>
            }
          />
          <ContextMenuContent>
            <DomainMenuItems
              node={node}
              actions={actions}
              Item={ContextMenuItem}
              Separator={ContextMenuSeparator}
            />
          </ContextMenuContent>
        </ContextMenu>
      </div>
      {hasChildren && expanded && (
        <DomainNodeList
          nodes={node.children}
          level={level + 1}
          selectedDomainId={selectedDomainId}
          expandedKeys={expandedKeys}
          onToggle={onToggle}
          onSelect={onSelect}
          actions={actions}
        />
      )}
    </div>
  );
}

function DomainDragPreview({
  node,
  level,
  expandedKeys,
  width,
}: {
  node: DomainTreeNode;
  level: number;
  expandedKeys: Record<string, boolean>;
  width?: number;
}) {
  const expanded = !!expandedKeys[node.id];
  const hasChildren = node.children.length > 0;

  return (
    <div className="pointer-events-none" style={{ width }}>
      <Button
        data-testid="capture-domain-drag-preview-node"
        data-domain-name={node.name}
        type="button"
        variant="ghost"
        size="sm"
        className={domainTreeButtonClassName(false)}
        tabIndex={-1}
      >
        <span
          className="flex min-w-0 flex-1 items-center gap-1"
          style={{ paddingLeft: `calc(${level} * 0.875rem)` }}
        >
          {hasChildren ? (
            <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="size-6 shrink-0" />
          )}
          <span className="min-w-0 truncate">{node.name}</span>
        </span>
      </Button>
      {hasChildren && expanded && (
        <>
          {node.children.map((child) => (
            <DomainDragPreview
              key={child.id}
              node={child}
              level={level + 1}
              expandedKeys={expandedKeys}
            />
          ))}
        </>
      )}
    </div>
  );
}

function DomainNodeList({
  nodes,
  level = 0,
  selectedDomainId,
  expandedKeys,
  onToggle,
  onSelect,
  actions,
}: {
  nodes: DomainTreeNode[];
  level?: number;
  selectedDomainId: string;
  expandedKeys: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  actions: DomainNodeActions;
}) {
  return (
    <SortableContext items={nodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => (
        <DomainNode
          key={node.id}
          node={node}
          level={level}
          selectedDomainId={selectedDomainId}
          expandedKeys={expandedKeys}
          onToggle={onToggle}
          onSelect={onSelect}
          actions={actions}
        />
      ))}
    </SortableContext>
  );
}

function DomainRootButton({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <Button
      data-testid="capture-domain-root"
      type="button"
      size="sm"
      variant="ghost"
      className={domainTreeButtonClassName(selected)}
      onClick={onSelect}
    >
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
        <Layers size={14} />
      </span>
      <span className="min-w-0 truncate">全部领域</span>
    </Button>
  );
}

export function DomainTree({ onChat }: { onChat?: (scope: CaptureAgentScope) => void }) {
  const { domains } = useCaptureDomains();
  const { createDomain, updateDomain, deleteDomain, reorderDomains } = useDomainActions();
  const [activeDrag, setActiveDrag] = useState<{ id: string; width?: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const selectedDomainId = useCaptureStore((state) => state.selectedDomainId);
  const expandedDomainKeys = useCaptureStore((state) => state.expandedDomainIds);
  const selectDomain = useCaptureStore((state) => state.selectDomain);
  const toggleDomainExpanded = useCaptureStore((state) => state.toggleDomainExpanded);
  const reconcileExpandedDomains = useCaptureStore((state) => state.reconcileExpandedDomains);
  const expandDomainAncestors = useCaptureStore((state) => state.expandDomainAncestors);
  const resetAfterDomainDeleted = useCaptureStore((state) => state.resetAfterDomainDeleted);
  const { openModal, closeModal, confirm } = useModal();
  const domainParentById = useMemo(() => buildDomainParentLookup(domains), [domains]);
  const activeDragNode = useMemo(
    () => (activeDrag ? findNodeWithLevel(domains, activeDrag.id) : null),
    [activeDrag, domains],
  );
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const activeParentId = domainParentById.get(String(args.active.id));
      if (activeParentId === undefined) return closestCenter(args);

      const droppableContainers = args.droppableContainers.filter(
        (container) => domainParentById.get(String(container.id)) === activeParentId,
      );
      if (droppableContainers.length === 0) return [];

      return closestCenter({ ...args, droppableContainers });
    },
    [domainParentById],
  );

  useEffect(() => {
    if (!selectedDomainId || selectedDomainId === "all") return;
    const ancestors = getAncestorKeys(domains, selectedDomainId);
    if (!ancestors) return;
    expandDomainAncestors(ancestors);
  }, [domains, selectedDomainId, expandDomainAncestors]);

  useEffect(() => {
    const validKeys = new Set(getAllKeys(domains));
    reconcileExpandedDomains(validKeys);
  }, [domains, reconcileExpandedDomains]);

  const openCreateModal = (initialParentId?: string | null) => {
    openModal(
      <DomainModalContent
        data={{
          initialParentId,
          domains,
          onConfirm: createDomain,
          onClose: closeModal,
        }}
      />,
      { title: "新建领域" },
    );
  };

  const openEditModal = (node: DomainTreeNode) => {
    openModal(
      <DomainModalContent
        data={{
          editDomain: { id: node.id, name: node.name, parentId: node.parentId },
          domains,
          onConfirm: (params: { name: string; parentId: string | null }) =>
            updateDomain(node.id, params),
          onClose: closeModal,
        }}
      />,
      { title: "编辑领域" },
    );
  };

  const onSelect = (id: string) => {
    selectDomain(id);
  };

  const onToggle = (id: string) => {
    toggleDomainExpanded(id);
  };

  const handleDelete = (node: DomainTreeNode) => {
    const deletedDomainIds = new Set([node.id, ...getAllKeys(node.children)]);
    confirm({
      title: "删除领域",
      message: `确定要删除领域 "${node.name}" 吗？此操作不可撤销。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: async () => {
        await deleteDomain(node.id);
        resetAfterDomainDeleted(deletedDomainIds);
      },
    });
  };

  const actions: DomainNodeActions = {
    onCreateChild: (node) => openCreateModal(node.id),
    onEdit: openEditModal,
    onDelete: handleDelete,
    onChat,
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag({
      id: String(event.active.id),
      width: event.active.rect.current.initial?.width,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const overId = event.over?.id;
    if (!overId) return;
    const items = buildSiblingDomainReorderItems(domains, String(event.active.id), String(overId));
    if (items.length === 0) return;
    void reorderDomains(items).catch((error) =>
      toast.error("调整领域顺序失败", { description: errorMessage(error) }),
    );
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="app-drag-region relative pl-5 pt-14 pb-3 pr-2">
        <div className="flex h-8 items-center justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-medium">领域</div>
          <Button
            data-no-drag
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-8"
            aria-label="新建领域"
            onClick={() => openCreateModal()}
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className="space-y-0.5 px-2">
            <DomainRootButton
              selected={selectedDomainId === "all"}
              onSelect={() => onSelect("all")}
            />

            <DomainNodeList
              nodes={domains}
              selectedDomainId={selectedDomainId}
              expandedKeys={expandedDomainKeys}
              onToggle={onToggle}
              onSelect={onSelect}
              actions={actions}
            />

            {domains.length === 0 && (
              <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">
                还没有领域。新建一个领域后，理解会在这里形成长期语境。
              </div>
            )}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragNode ? (
              <DomainDragPreview
                node={activeDragNode.node}
                level={activeDragNode.level}
                expandedKeys={expandedDomainKeys}
                width={activeDrag?.width}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
      <AppChromeMenu />
    </aside>
  );
}
