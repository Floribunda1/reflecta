import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import {
  CanvasLibraryPanel,
  type CanvasLibraryDomainOption,
  type CanvasLibraryItemView,
  type CanvasLibrarySortBy,
} from "./canvas-library-panel";
import { typicalLibraryDomains, typicalLibraryItems } from "./canvas-story-fixtures";

function LibraryFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[620px] w-72 overflow-hidden rounded-lg border bg-background">{children}</div>
  );
}

function LibraryDemo({
  items = typicalLibraryItems,
  domains = typicalLibraryDomains,
  loading = false,
  initialQuery = "",
}: {
  items?: readonly CanvasLibraryItemView[];
  domains?: readonly CanvasLibraryDomainOption[];
  loading?: boolean;
  initialQuery?: string;
}) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedDomainId, setSelectedDomainId] = useState("all");
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
          items={visibleItems}
          domains={domains}
          loading={loading}
          searchQuery={searchQuery}
          selectedDomainId={selectedDomainId}
          sortBy={sortBy}
          onSearchQueryChange={setSearchQuery}
          onSelectedDomainIdChange={setSelectedDomainId}
          onSortByChange={setSortBy}
          onClose={() => setLastAction("关闭")}
          onOpenCanvasRefPicker={() => setLastAction("打开画布引用选择")}
          onStartDragUnderstanding={(id) => setLastAction(`开始拖拽：${id}`)}
          onPickUnderstanding={(id) => setLastAction(`点选：${id}`)}
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
        description="搜索即时过滤标题；领域选择展示层级缩进；条目可点选。"
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

      <StoryCase title="领域层级" description="深层领域名称带缩进；名称本身也可以很长。">
        <LibraryDemo
          domains={[
            ...typicalLibraryDomains,
            {
              id: "night-shift",
              name: "夜班联调、异常复验与下一观察窗",
              depth: 3,
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
    domains: typicalLibraryDomains,
    searchQuery: "",
    selectedDomainId: "all",
    sortBy: "updatedAt",
    onSearchQueryChange: () => undefined,
    onSelectedDomainIdChange: () => undefined,
    onSortByChange: () => undefined,
    onClose: () => undefined,
    onOpenCanvasRefPicker: () => undefined,
    onStartDragUnderstanding: () => undefined,
    onPickUnderstanding: () => undefined,
  },
} satisfies Meta<typeof CanvasLibraryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasLibraryStory: Story = {
  name: "Canvas Library",
  render: () => <CanvasLibraryShowcase />,
};
