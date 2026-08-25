import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState } from "react";
import { StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { CanvasLibraryPanel, type CanvasLibrarySortBy } from "./canvas-library-panel";
import { CanvasSearchOverlay } from "./canvas-search-overlay";
import {
  CanvasEmptyState,
  CanvasSaveStatus,
  CanvasTextTool,
  CanvasUnderstandingTool,
} from "./canvas-workspace-chrome";
import { CanvasZoomControls } from "./CanvasZoomControls";
import { CanvasReadOnlyView } from "./CanvasReadOnlyView";
import { GraphFrame, StoryCaseSwitch } from "./canvas-story-graph";
import {
  agentScenarioInputs,
  type AgentLayoutScenarioInput,
  denseCanvasDocument,
  typicalCanvasDocument,
  typicalLibraryDomains,
  typicalLibraryItems,
  typicalSearchIndex,
  typicalShapeData,
} from "./canvas-story-fixtures";
import {
  EMPTY_CANVAS_DOCUMENT,
  normalizeCanvasChanges,
  type CanvasDocument,
  type CanvasElementDTO,
} from "@reflecta/shared";
import { Effect } from "effect";

function newTextElement(): CanvasElementDTO {
  return {
    id: crypto.randomUUID(),
    canvasId: "story",
    parentId: null,
    x: 0,
    y: 0,
    width: 220,
    height: 120,
    zIndex: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: "" },
  };
}

function WorkspaceShell({
  document,
  libraryOpen = false,
  searchOpen = false,
  saveStatus = "clean",
}: {
  document: CanvasDocument;
  libraryOpen?: boolean;
  searchOpen?: boolean;
  saveStatus?: "clean" | "dirty" | "saving" | "error";
}) {
  const graphRef = useRef<CanvasGraphHandle>(null);
  const [library, setLibrary] = useState(libraryOpen);
  const [search, setSearch] = useState(searchOpen);
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState("all");
  const [isEmpty, setIsEmpty] = useState(document.elements.length === 0);
  const [sortBy, setSortBy] = useState<CanvasLibrarySortBy>("updatedAt");
  useEffect(() => {
    setIsEmpty(document.elements.length === 0);
  }, [document]);
  const [status, setStatus] = useState(saveStatus);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return typicalLibraryItems;
    return typicalLibraryItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex h-[640px] w-full overflow-hidden rounded-lg border bg-background">
      <div className="relative min-h-0 min-w-0 flex-1">
        <CanvasGraph
          ref={graphRef}
          document={document}
          viewportReady
          shapeData={typicalShapeData}
          createElementForDrop={(source) => ({
            ...source,
            id: crypto.randomUUID(),
            x: 0,
            y: 0,
          })}
          onDocumentChange={(next) => setIsEmpty(next.elements.length === 0)}
          className="absolute inset-0"
        />
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm">
          <CanvasTextTool
            onStartDrag={(event) => graphRef.current?.startDrag(newTextElement(), undefined, event)}
            onClick={() => {
              const text = newTextElement();
              text.x = 120;
              text.y = 120;
              graphRef.current?.addElement(text);
            }}
          />
          <CanvasUnderstandingTool open={library} onClick={() => setLibrary((open) => !open)} />
        </div>
        <CanvasSaveStatus saveStatus={status} onRetry={() => setStatus("clean")} />
        {isEmpty ? <CanvasEmptyState /> : null}
        <CanvasZoomControls
          className="absolute bottom-4 left-4 z-20"
          onZoomIn={() => graphRef.current?.zoomIn()}
          onZoomOut={() => graphRef.current?.zoomOut()}
          onFit={() => graphRef.current?.fitView()}
        />
        {search ? (
          <CanvasSearchOverlay
            index={typicalSearchIndex}
            onSelect={() => setSearch(false)}
            onClose={() => setSearch(false)}
          />
        ) : null}
      </div>
      {library ? (
        <CanvasLibraryPanel
          items={items}
          domainTree={typicalLibraryDomains}
          canvases={[]}
          tab="understandings"
          searchQuery={query}
          selectedDomainId={domainId}
          includeDescendants
          sortBy={sortBy}
          onTabChange={() => undefined}
          onSearchQueryChange={setQuery}
          onSelectedDomainIdChange={setDomainId}
          onIncludeDescendantsChange={() => undefined}
          onSortByChange={setSortBy}
          onClose={() => setLibrary(false)}
          onStartDragUnderstanding={(id, _title, event) =>
            graphRef.current?.startDrag(
              {
                ...newTextElement(),
                kind: "understanding",
                understandingId: id,
                canvasRefId: null,
                props: {},
                width: 260,
                height: 220,
              },
              undefined,
              event,
            )
          }
          onPickUnderstanding={(id, _title) =>
            graphRef.current?.addElement({
              ...newTextElement(),
              kind: "understanding",
              understandingId: id,
              canvasRefId: null,
              props: {},
              width: 260,
              height: 220,
            })
          }
          onStartDragCanvas={(id, _title, event) =>
            graphRef.current?.startDrag(
              {
                ...newTextElement(),
                kind: "canvas_ref",
                canvasRefId: id,
                understandingId: null,
                props: {},
                width: 240,
                height: 140,
              },
              undefined,
              event,
            )
          }
          onPickCanvas={(id) =>
            graphRef.current?.addElement({
              ...newTextElement(),
              kind: "canvas_ref",
              canvasRefId: id,
              understandingId: null,
              props: {},
              width: 240,
              height: 140,
            })
          }
        />
      ) : null}
    </div>
  );
}

function ReadonlySizeCase() {
  return (
    <StoryCaseSwitch
      cases={[
        {
          title: "工作区",
          content: (
            <GraphFrame height="h-[360px]">
              <CanvasReadOnlyView
                document={typicalCanvasDocument}
                shapeData={typicalShapeData}
                className="absolute inset-0"
              />
            </GraphFrame>
          ),
        },
        {
          title: "弹层",
          content: (
            <GraphFrame height="h-[240px]">
              <CanvasReadOnlyView
                document={typicalCanvasDocument}
                shapeData={typicalShapeData}
                showZoomControls
                className="absolute inset-0"
              />
            </GraphFrame>
          ),
        },
        {
          title: "缩略",
          content: (
            <GraphFrame height="h-[160px]">
              <CanvasReadOnlyView
                document={typicalCanvasDocument}
                shapeData={typicalShapeData}
                className="absolute inset-0"
              />
            </GraphFrame>
          ),
        },
      ]}
    />
  );
}

function AgentScenarioGraph({ input }: { input: AgentLayoutScenarioInput }) {
  const [doc, setDoc] = useState<CanvasDocument | null>(null);
  useEffect(() => {
    // 现场跑真实 normalizeCanvasChanges（shared，ELK）——几何与 server 一致，无静态快照。
    // 尺寸即 shared 的确定性估算（校准版），布局/存储/渲染同一逻辑，所见即所存。
    let mounted = true;
    const promise = Effect.runPromise(
      normalizeCanvasChanges({ layout: input.layout, changes: input.changes }),
    ).then((result) => {
      if (mounted) setDoc(result.document);
    });
    return () => {
      mounted = false;
      promise.catch(() => undefined);
    };
  }, [input]);
  if (!doc)
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        生成中…
      </div>
    );
  return (
    <CanvasReadOnlyView
      document={doc}
      shapeData={{
        understandingRefs: input.understandingRefs ?? new Map(),
        referencedCanvases: new Map(),
      }}
      showZoomControls
      className="absolute inset-0"
    />
  );
}

function AgentDocumentShowcase() {
  return (
    <StoryShowcase
      title="Agent 生成文档：布局场景"
      description="逐场景用真实 normalizeCanvasChanges（ELK）现场生成，验收分支、分组、连线与首次 fitView。几何无静态快照，与 server 永远一致。x6-react-shape portal 为单例，同一页一次只挂一张图，用切换逐场景查看。"
    >
      <StoryCaseSwitch
        cases={agentScenarioInputs.map((scenario) => ({
          title: scenario.title,
          description: scenario.description,
          content: (
            <GraphFrame height="h-[420px]">
              <AgentScenarioGraph input={scenario} />
            </GraphFrame>
          ),
        }))}
      />
    </StoryShowcase>
  );
}

function CanvasCompositionShowcase() {
  return (
    <StoryShowcase
      title="画布工作区核心组合"
      description="验收图与工具条、空态、理解库、搜索、只读嵌入叠在一起时的密度与层级。同一时间只挂一张图。"
    >
      <StoryCaseSwitch
        cases={[
          {
            title: "空工作区",
            description: "空态、文本工具、理解库入口和缩放控件同时出现。",
            content: <WorkspaceShell document={EMPTY_CANVAS_DOCUMENT} />,
          },
          {
            title: "有内容的工作区",
            description: "典型文档 + 工具条 + 缩放。保存失败提示可点重试。",
            content: <WorkspaceShell document={typicalCanvasDocument} saveStatus="error" />,
          },
          {
            title: "理解库打开",
            description: "右侧库面板与主画布相邻；工具条上的理解库按钮为按下态。",
            content: <WorkspaceShell document={typicalCanvasDocument} libraryOpen />,
          },
          {
            title: "搜索浮层",
            description: "搜索叠在图上方中央，不挡住左上工具条和左下缩放。",
            content: <WorkspaceShell document={typicalCanvasDocument} searchOpen />,
          },
          {
            title: "只读与嵌入尺寸",
            description: "同一份工作区文档在工作区、弹层和缩略尺寸下的只读呈现。",
            content: <ReadonlySizeCase />,
          },
          {
            title: "规模边界",
            description: "多卡片与连线时，工具条、缩放和画布密度是否还能同屏阅读。",
            content: <WorkspaceShell document={denseCanvasDocument} />,
          },
        ]}
      />
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/组合场景样式",
  component: CanvasGraph,
  parameters: {
    layout: "padded",
  },
  args: {
    document: typicalCanvasDocument,
    viewportReady: true,
  },
} satisfies Meta<typeof CanvasGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasCompositionStory: Story = {
  name: "画布工作区核心组合",
  render: () => <CanvasCompositionShowcase />,
};

export const AgentGeneratedDocumentStory: Story = {
  name: "Agent 生成文档",
  render: () => <AgentDocumentShowcase />,
};
