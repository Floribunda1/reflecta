import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useRef, useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
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
import {
  typicalCanvasDocument,
  typicalLibraryDomains,
  typicalLibraryItems,
  typicalSearchIndex,
  typicalShapeData,
} from "./canvas-story-fixtures";
import { EMPTY_CANVAS_DOCUMENT, type CanvasDocument, type CanvasElementDTO } from "./document";

function newTextElement(): CanvasElementDTO {
  return {
    id: crypto.randomUUID(),
    canvasId: "story",
    parentId: null,
    x: 120,
    y: 120,
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
  empty = false,
  libraryOpen = false,
  searchOpen = false,
  saveStatus = "clean",
}: {
  document: CanvasDocument;
  empty?: boolean;
  libraryOpen?: boolean;
  searchOpen?: boolean;
  saveStatus?: "clean" | "dirty" | "saving" | "error";
}) {
  const graphRef = useRef<CanvasGraphHandle>(null);
  const [library, setLibrary] = useState(libraryOpen);
  const [search, setSearch] = useState(searchOpen);
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState("all");
  const [sortBy, setSortBy] = useState<CanvasLibrarySortBy>("updatedAt");
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
          createElementForDrop={(source) => ({ ...source, id: crypto.randomUUID() })}
          className="absolute inset-0"
        />
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm">
          <CanvasTextTool
            onStartDrag={(event) => graphRef.current?.startDrag(newTextElement(), event)}
            onClick={() => graphRef.current?.addElement(newTextElement())}
          />
          <CanvasUnderstandingTool open={library} onClick={() => setLibrary((open) => !open)} />
        </div>
        <CanvasSaveStatus saveStatus={status} onRetry={() => setStatus("clean")} />
        {empty ? <CanvasEmptyState /> : null}
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
          domains={typicalLibraryDomains}
          searchQuery={query}
          selectedDomainId={domainId}
          sortBy={sortBy}
          onSearchQueryChange={setQuery}
          onSelectedDomainIdChange={setDomainId}
          onSortByChange={setSortBy}
          onClose={() => setLibrary(false)}
          onOpenCanvasRefPicker={() => undefined}
          onStartDragUnderstanding={(id, event) =>
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
              event,
            )
          }
          onPickUnderstanding={(id) =>
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
        />
      ) : null}
    </div>
  );
}

function CanvasCompositionShowcase() {
  return (
    <StoryShowcase
      title="画布工作区核心组合"
      description="验收图、工具条、缩放、空态、理解库和搜索浮层叠在一起时的密度与层级。不复制保存、路由或详情面板。"
    >
      <StoryCase title="空工作区" description="空态、文本工具、理解库入口和缩放控件同时出现。">
        <WorkspaceShell document={EMPTY_CANVAS_DOCUMENT} empty />
      </StoryCase>

      <StoryCase
        title="有内容的工作区"
        description="典型文档 + 工具条 + 缩放。保存失败提示可点重试。"
      >
        <WorkspaceShell document={typicalCanvasDocument} saveStatus="error" />
      </StoryCase>

      <StoryCase
        title="理解库打开"
        description="右侧库面板与主画布相邻；工具条上的理解库按钮为按下态。"
      >
        <WorkspaceShell document={typicalCanvasDocument} libraryOpen />
      </StoryCase>

      <StoryCase title="搜索浮层" description="搜索叠在图上方中央，不挡住左上工具条和左下缩放。">
        <WorkspaceShell document={typicalCanvasDocument} searchOpen />
      </StoryCase>
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
