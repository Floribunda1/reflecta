import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText } from "lucide-react";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "../components/empty";
import {
  cardsForDomain,
  denseCards,
  denseDomains,
  denseExpandedIds,
  resolveStoryWikiLink,
  typicalCards,
  typicalDomains,
  typicalExpandedIds,
  type CaptureStoryCard,
} from "./capture-story-fixtures";
import { DomainTree, type DomainTreeNodeView } from "./domain-tree";
import { UnderstandingCard } from "./understanding-card";

function CaptureDashboard({
  domains,
  cards,
  initialDomainId = null,
  initialUnderstandingId = null,
  initialExpandedIds,
}: {
  domains: DomainTreeNodeView[];
  cards: CaptureStoryCard[];
  initialDomainId?: string | null;
  initialUnderstandingId?: string | null;
  initialExpandedIds: readonly string[];
}) {
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(initialDomainId);
  const [expandedIds, setExpandedIds] = useState([...initialExpandedIds]);
  const [selectedUnderstandingId, setSelectedUnderstandingId] = useState(initialUnderstandingId);
  const visible = cardsForDomain(cards, domains, selectedDomainId);

  return (
    <div className="grid h-[680px] min-w-0 grid-cols-[248px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background">
      <aside className="min-h-0 min-w-0 overflow-auto border-r">
        <div className="flex h-10 shrink-0 items-center px-5 text-sm font-medium">领域</div>
        <DomainTree
          className="px-2"
          nodes={domains}
          selectedId={selectedDomainId}
          expandedIds={expandedIds}
          canChat
          onSelect={setSelectedDomainId}
          onToggle={(id) =>
            setExpandedIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          onAction={() => undefined}
        />
      </aside>

      <section className="min-h-0 min-w-0 overflow-auto p-4">
        {visible.length === 0 ? (
          <Empty className="h-full">
            <EmptyContent>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyDescription>暂时没有内容</EmptyDescription>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((understanding) => (
              <UnderstandingCard
                key={understanding.id}
                understanding={understanding}
                selected={selectedUnderstandingId === understanding.id}
                canChat
                resolveWikiLink={resolveStoryWikiLink}
                onSelect={setSelectedUnderstandingId}
                onAction={() => undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CaptureCompositionShowcase() {
  return (
    <StoryShowcase
      title="Capture 组合场景"
      description="验收领域树与理解卡片网格相邻时的选择、过滤、空态和密度。对应生产里的 Capture dashboard，不含详情面板与足迹。"
    >
      <StoryCase
        title="典型仪表盘"
        description="左侧领域树，右侧卡片网格。选领域会带上子孙理解；点卡片高亮当前项。"
      >
        <CaptureDashboard
          domains={typicalDomains}
          cards={typicalCards}
          initialUnderstandingId="acceptance"
          initialExpandedIds={typicalExpandedIds}
        />
      </StoryCase>
      <StoryCase title="空网格" description="领域还在，当前筛选下没有理解。">
        <CaptureDashboard
          domains={typicalDomains}
          cards={[]}
          initialDomainId="storybook"
          initialExpandedIds={typicalExpandedIds}
        />
      </StoryCase>
      <StoryCase
        title="高密度边界"
        description="深层领域、长标题、长摘要和大量卡片同时压入窄侧栏与网格。"
      >
        <div className="max-w-[980px] overflow-auto">
          <CaptureDashboard
            domains={denseDomains}
            cards={denseCards}
            initialDomainId="night-shift"
            initialUnderstandingId="dense-understanding-0"
            initialExpandedIds={denseExpandedIds}
          />
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/组合场景样式",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompositionStory: Story = {
  name: "捕获仪表盘核心组合",
  render: () => <CaptureCompositionShowcase />,
};
