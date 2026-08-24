import { arrayMove } from "@dnd-kit/sortable";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { deepDomains, typicalDomains, typicalExpandedIds } from "./capture-story-fixtures";
import { DomainTree, type DomainTreeAction, type DomainTreeNodeView } from "./domain-tree";

function reorderSiblings(
  nodes: readonly DomainTreeNodeView[],
  activeId: string,
  overId: string,
): DomainTreeNodeView[] {
  const activeIndex = nodes.findIndex((node) => node.id === activeId);
  const overIndex = nodes.findIndex((node) => node.id === overId);
  if (activeIndex >= 0 && overIndex >= 0) return arrayMove([...nodes], activeIndex, overIndex);
  return nodes.map((node) => ({
    ...node,
    children: reorderSiblings(node.children, activeId, overId),
  }));
}

function InteractiveTree({
  initialNodes = typicalDomains,
  initialSelectedId = null,
  initialExpandedIds = [...typicalExpandedIds],
  canChat = true,
}: {
  initialNodes?: DomainTreeNodeView[];
  initialSelectedId?: string | null;
  initialExpandedIds?: string[];
  canChat?: boolean;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [expandedIds, setExpandedIds] = useState(initialExpandedIds);
  const [lastAction, setLastAction] = useState("尚未执行菜单操作");

  const handleToggle = (id: string) => {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleAction = (action: DomainTreeAction) => {
    const labels = {
      chat: "和 AI 聊聊",
      "create-child": "新建子领域",
      edit: "编辑",
      delete: "删除",
    };
    setLastAction(`${labels[action.type]}：${action.node.name}`);
  };

  return (
    <div className="grid w-72 max-w-full gap-3">
      <DomainTree
        nodes={nodes}
        selectedId={selectedId}
        expandedIds={expandedIds}
        canChat={canChat}
        onSelect={setSelectedId}
        onToggle={handleToggle}
        onAction={handleAction}
        onReorder={(activeId, overId) =>
          setNodes((current) => reorderSiblings(current, activeId, overId))
        }
      />
      <p className="px-2 text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function DomainTreeShowcase() {
  return (
    <StoryShowcase
      title="Domain Tree"
      description="在一个页面内验收全部领域、节点选择、展开、菜单、拖拽、空状态，以及深层级和长名称边界。"
    >
      <StoryCase
        title="选择、展开与拖拽"
        description="默认选中「全部领域」。选择节点、展开层级、右键菜单和同级拖拽都可以直接操作。"
      >
        <InteractiveTree />
      </StoryCase>
      <StoryCase title="节点菜单" description="并排比较允许与不允许“和 AI 聊聊”的真实菜单结构。">
        <div className="grid items-start gap-8 md:grid-cols-2">
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">允许聊天</span>
            <InteractiveTree initialSelectedId="storybook" />
          </div>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">不允许聊天</span>
            <InteractiveTree initialSelectedId="storybook" canChat={false} />
          </div>
        </div>
      </StoryCase>
      <StoryCase title="空树" description="没有 Domain 时仍保留「全部领域」和稳定的树容器。">
        <div className="w-72 max-w-full">
          <DomainTree
            nodes={[]}
            selectedId={null}
            expandedIds={[]}
            onSelect={() => undefined}
            onToggle={() => undefined}
            onAction={() => undefined}
          />
        </div>
      </StoryCase>
      <StoryCase
        title="深层级与长名称"
        description="窄容器内保持层级可读、文字截断和父子 Hover 关系。"
      >
        <InteractiveTree
          initialNodes={deepDomains}
          initialSelectedId="level-4"
          initialExpandedIds={["root-long", "level-2", "level-3"]}
        />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: DomainTree,
  args: {
    nodes: typicalDomains,
    selectedId: "storybook",
    expandedIds: [...typicalExpandedIds],
    onSelect: () => undefined,
    onToggle: () => undefined,
    onAction: () => undefined,
  },
} satisfies Meta<typeof DomainTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DomainTreeStory: Story = {
  name: "Domain Tree",
  render: () => <DomainTreeShowcase />,
};
