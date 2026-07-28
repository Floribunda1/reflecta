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
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/context-menu";
import { cn } from "../lib/utils";

export type DomainTreeNodeView = {
  id: string;
  name: string;
  children: readonly DomainTreeNodeView[];
};

export type DomainTreeAction = {
  type: "chat" | "create-child" | "edit" | "delete";
  node: DomainTreeNodeView;
};

export type DomainTreeProps = {
  nodes: readonly DomainTreeNodeView[];
  selectedId: string | null;
  expandedIds: readonly string[];
  canChat?: boolean;
  className?: string;
  emptyText?: string;
  onSelect: (id: string | null) => void;
  onToggle: (id: string) => void;
  onAction: (action: DomainTreeAction) => void;
  onReorder?: (activeId: string, overId: string) => void;
};

function parentLookup(
  nodes: readonly DomainTreeNodeView[],
  parentId: string | null = null,
  result = new Map<string, string | null>(),
) {
  for (const node of nodes) {
    result.set(node.id, parentId);
    parentLookup(node.children, node.id, result);
  }
  return result;
}

function findNode(
  nodes: readonly DomainTreeNodeView[],
  targetId: string,
  level = 0,
): { node: DomainTreeNodeView; level: number } | null {
  for (const node of nodes) {
    if (node.id === targetId) return { node, level };
    const found = findNode(node.children, targetId, level + 1);
    if (found) return found;
  }
  return null;
}

function buttonClassName(selected: boolean, dragging = false) {
  return cn(
    "w-full min-w-0 cursor-default justify-start p-1.5 text-left font-normal text-foreground/85 hover:bg-foreground/5 hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-foreground/85 aria-expanded:hover:bg-foreground/5 aria-expanded:hover:text-foreground focus-visible:border-transparent focus-visible:bg-foreground/5 focus-visible:ring-0",
    selected &&
      "bg-foreground/5 font-medium text-foreground hover:bg-foreground/5 aria-expanded:bg-foreground/5 aria-expanded:text-foreground",
    dragging &&
      "bg-transparent text-foreground/85 hover:bg-transparent hover:text-foreground/85 focus-visible:bg-transparent",
  );
}

function NodeMenu({
  node,
  canChat,
  onAction,
}: {
  node: DomainTreeNodeView;
  canChat: boolean;
  onAction: (action: DomainTreeAction) => void;
}) {
  return (
    <>
      {canChat ? (
        <>
          <ContextMenuItem onClick={() => onAction({ type: "chat", node })}>
            和 AI 聊聊
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      ) : null}
      <ContextMenuItem onClick={() => onAction({ type: "create-child", node })}>
        新建子领域
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onAction({ type: "edit", node })}>编辑领域</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => onAction({ type: "delete", node })}>
        删除
      </ContextMenuItem>
    </>
  );
}

type NodeProps = {
  node: DomainTreeNodeView;
  level: number;
  selectedId: string | null;
  expandedIds: ReadonlySet<string>;
  canChat: boolean;
  reorderable: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAction: (action: DomainTreeAction) => void;
};

function DomainNode({
  node,
  level,
  selectedId,
  expandedIds,
  canChat,
  reorderable,
  onSelect,
  onToggle,
  onAction,
}: NodeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !reorderable,
  });
  const expanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const selected = selectedId === node.id;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-0")}
      data-testid="capture-domain-sortable-node"
      data-domain-name={node.name}
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <Button
              data-testid="capture-domain-node"
              data-domain-name={node.name}
              type="button"
              variant="ghost"
              size="sm"
              className={buttonClassName(selected, isDragging)}
              style={{ touchAction: reorderable ? "none" : undefined }}
              aria-expanded={hasChildren ? expanded : undefined}
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
          <NodeMenu node={node} canChat={canChat} onAction={onAction} />
        </ContextMenuContent>
      </ContextMenu>
      {hasChildren && expanded ? (
        <DomainNodeList
          nodes={node.children}
          level={level + 1}
          selectedId={selectedId}
          expandedIds={expandedIds}
          canChat={canChat}
          reorderable={reorderable}
          onSelect={onSelect}
          onToggle={onToggle}
          onAction={onAction}
        />
      ) : null}
    </div>
  );
}

function DomainNodeList({
  nodes,
  level,
  selectedId,
  expandedIds,
  canChat,
  reorderable,
  onSelect,
  onToggle,
  onAction,
}: Omit<NodeProps, "node"> & { nodes: readonly DomainTreeNodeView[] }) {
  return (
    <SortableContext items={nodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => (
        <DomainNode
          key={node.id}
          node={node}
          level={level}
          selectedId={selectedId}
          expandedIds={expandedIds}
          canChat={canChat}
          reorderable={reorderable}
          onSelect={onSelect}
          onToggle={onToggle}
          onAction={onAction}
        />
      ))}
    </SortableContext>
  );
}

function DragPreview({
  node,
  level,
  expandedIds,
  width,
}: {
  node: DomainTreeNodeView;
  level: number;
  expandedIds: ReadonlySet<string>;
  width?: number;
}) {
  const expanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="pointer-events-none" style={{ width }}>
      <Button
        data-testid="capture-domain-drag-preview-node"
        data-domain-name={node.name}
        type="button"
        variant="ghost"
        size="sm"
        className={buttonClassName(false)}
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
      {hasChildren && expanded
        ? node.children.map((child) => (
            <DragPreview key={child.id} node={child} level={level + 1} expandedIds={expandedIds} />
          ))
        : null}
    </div>
  );
}

export function DomainTree({
  nodes,
  selectedId,
  expandedIds: expandedIdsProp,
  canChat = false,
  className,
  emptyText = "还没有领域。新建一个领域后，理解会在这里形成长期语境。",
  onSelect,
  onToggle,
  onAction,
  onReorder,
}: DomainTreeProps) {
  const [activeDrag, setActiveDrag] = useState<{ id: string; width?: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const expandedIds = useMemo(() => new Set(expandedIdsProp), [expandedIdsProp]);
  const parentById = useMemo(() => parentLookup(nodes), [nodes]);
  const activeNode = useMemo(
    () => (activeDrag ? findNode(nodes, activeDrag.id) : null),
    [activeDrag, nodes],
  );
  const collisionDetection = useMemo<CollisionDetection>(
    () => (args) => {
      const activeParentId = parentById.get(String(args.active.id));
      if (activeParentId === undefined) return closestCenter(args);

      const droppableContainers = args.droppableContainers.filter(
        (container) => parentById.get(String(container.id)) === activeParentId,
      );
      return droppableContainers.length ? closestCenter({ ...args, droppableContainers }) : [];
    },
    [parentById],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag({
      id: String(event.active.id),
      width: event.active.rect.current.initial?.width,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    if (!event.over || event.active.id === event.over.id) return;
    onReorder?.(String(event.active.id), String(event.over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className={cn("min-w-0 space-y-0.5", className)}>
        <Button
          data-testid="capture-domain-root"
          type="button"
          size="sm"
          variant="ghost"
          className={buttonClassName(selectedId === null)}
          onClick={() => onSelect(null)}
        >
          <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
            <Layers size={14} />
          </span>
          <span className="min-w-0 truncate">全部领域</span>
        </Button>

        <DomainNodeList
          nodes={nodes}
          level={0}
          selectedId={selectedId}
          expandedIds={expandedIds}
          canChat={canChat}
          reorderable={Boolean(onReorder)}
          onSelect={onSelect}
          onToggle={onToggle}
          onAction={onAction}
        />

        {nodes.length === 0 ? (
          <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">{emptyText}</div>
        ) : null}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <DragPreview
            node={activeNode.node}
            level={activeNode.level}
            expandedIds={expandedIds}
            width={activeDrag?.width}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
