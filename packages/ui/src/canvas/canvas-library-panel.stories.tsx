import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import type { DomainTreeNodeView } from "../capture/domain-tree";
import {
  CanvasLibraryPanel,
  type CanvasLibraryItemView,
  type CanvasLibrarySortBy,
  type CanvasLibraryTab,
} from "./canvas-library-panel";
import { typicalLibraryDomains, typicalLibraryItems } from "./canvas-story-fixtures";

const typicalLibraryCanvases: CanvasLibraryItemView[] = [
  { id: "cvx-irrigation", title: "分区灌溉主图" },
  { id: "cvx-night-shift", title: "夜班联调接线图" },
  { id: "cvx-sensors", title: "传感器拓扑" },
];

function LibraryFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[620px] w-72 overflow-hidden rounded-lg border bg-background">{children}</div>
  );
}

function LibraryDemo({
  items = typicalLibraryItems,
  domains = typicalLibraryDomains,
  canvases = typicalLibraryCanvases,
  loading = false,
  initialQuery = "",
}: {
  items?: readonly CanvasLibraryItemView[];
  domains?: readonly DomainTreeNodeView[];
  canvases?: readonly CanvasLibraryItemView[];
  loading?: boolean;
  initialQuery?: string;
}) {
  const [tab, setTab] = useState<CanvasLibraryTab>("understandings");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedDomainId, setSelectedDomainId] = useState("all");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [sortBy, setSortBy] = useState<CanvasLibrarySortBy>("updatedAt");
  const [lastAction, setLastAction] = useState("点击或拖拽条目；过滤器由本页本地状态驱动");
  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, searchQuery]);

  return (
    <div className="grid gap-2">
      <LibraryFrame>
        <CanvasLibraryPanel
          tab={tab}
          items={visibleItems}
          domainTree={domains}
          canvases={canvases}
          loading={loading}
          searchQuery={searchQuery}
          selectedDomainId={selectedDomainId}
          includeDescendants={includeDescendants}
          sortBy={sortBy}
          onTabChange={setTab}
          onSearchQueryChange={setSearchQuery}
          onSelectedDomainIdChange={setSelectedDomainId}
          onIncludeDescendantsChange={setIncludeDescendants}
          onSortByChange={setSortBy}
          onClose={() => setLastAction("关闭")}
          onStartDragUnderstanding={(id) => setLastAction(`开始拖拽理解：${id}`)}
          onPickUnderstanding={(id) => setLastAction(`点选理解：${id}`)}
          onStartDragCanvas={(id) => setLastAction(`开始拖拽画布：${id}`)}
          onPickCanvas={(id) => setLastAction(`点选画布：${id}`)}
        />
      </LibraryFrame>
      <p className="text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function CanvasLibraryShowcase() {
  return (
    <StoryShowcase
      title="Canvas Library"
      description="验收理解库的搜索、领域缩进、排序、加载/空状态、长标题截断和列表滚动。过滤在页面内可直接操作。"
    >
      <StoryCase
        title="典型列表"
        description="顶部 Tab 切换理解 / 画布；搜索即时过滤标题；领域选择展示层级缩进；条目可点选。"
      >
        <LibraryDemo />
      </StoryCase>

      <StoryCase title="加载与空状态">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">加载中</span>
            <LibraryDemo items={[]} loading />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">空库</span>
            <LibraryDemo items={[]} />
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">搜索无匹配</span>
            <LibraryDemo items={[]} initialQuery="不存在的理解" />
          </div>
        </div>
      </StoryCase>

      <StoryCase
        title="领域层级"
        description="DomainTreeSelect 展示领域树，深层名称也可很长；支持直接输入搜索。"
      >
        <LibraryDemo
          domains={[
            ...typicalLibraryDomains,
            {
              id: "night-shift",
              name: "夜班联调",
              children: [
                {
                  id: "night-shift-deep",
                  name: "异常复验与下一观察窗（超长领域名）",
                  children: [],
                },
              ],
            },
          ]}
        />
      </StoryCase>

      <StoryCase title="长标题与滚动" description="固定 288×620 容器内保持单行截断和垂直滚动。">
        <LibraryDemo
          items={Array.from({ length: 24 }, (_, index) => ({
            id: `item-${index}`,
            title:
              index % 4 === 0
                ? `第 ${index + 1} 条理解使用非常长的标题来检查固定宽度下的单行截断`
                : `现场复核记录 ${index + 1}`,
          }))}
        />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/基本组件",
  component: CanvasLibraryPanel,
  parameters: {
    layout: "padded",
  },
  args: {
    items: typicalLibraryItems,
    domainTree: typicalLibraryDomains,
    canvases: typicalLibraryCanvases,
    tab: "understandings",
    searchQuery: "",
    selectedDomainId: "all",
    includeDescendants: true,
    sortBy: "updatedAt",
    onTabChange: () => undefined,
    onSearchQueryChange: () => undefined,
    onSelectedDomainIdChange: () => undefined,
    onIncludeDescendantsChange: () => undefined,
    onSortByChange: () => undefined,
    onClose: () => undefined,
    onStartDragUnderstanding: () => undefined,
    onPickUnderstanding: () => undefined,
    onStartDragCanvas: () => undefined,
    onPickCanvas: () => undefined,
  },
} satisfies Meta<typeof CanvasLibraryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasLibraryStory: Story = {
  name: "Canvas Library",
  render: () => <CanvasLibraryShowcase />,
};
