import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useRef, useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { CanvasReadOnlyView } from "./CanvasReadOnlyView";
import { CanvasZoomControls } from "./CanvasZoomControls";
import {
  denseCanvasDocument,
  edgeStyleDocument,
  typicalCanvasDocument,
  typicalShapeData,
} from "./canvas-story-fixtures";
import { EMPTY_CANVAS_DOCUMENT, type CanvasDocument } from "./document";
import type { CanvasShapeData } from "./shape-context";

function GraphFrame({
  height = "h-[480px]",
  children,
}: {
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative w-full overflow-hidden rounded-lg border bg-background ${height}`}>
      {children}
    </div>
  );
}

function InteractiveGraph({
  document,
  readonly = false,
  shapeData = typicalShapeData,
}: {
  document: CanvasDocument;
  readonly?: boolean;
  shapeData?: CanvasShapeData;
}) {
  const graphRef = useRef<CanvasGraphHandle>(null);
  const [selection, setSelection] = useState("尚未选中");
  const liveShapeData = useMemo<CanvasShapeData>(
    () => ({
      ...shapeData,
      onCanvasRefClick: (canvasId) => setSelection(`打开引用画布：${canvasId}`),
      onElementEdit: (element) => setSelection(`编辑：${element.id}`),
    }),
    [shapeData],
  );

  return (
    <div className="grid gap-2">
      <GraphFrame>
        <CanvasGraph
          ref={graphRef}
          document={document}
          readonly={readonly}
          viewportReady
          shapeData={liveShapeData}
          onSelectionChange={(ids) =>
            setSelection(ids.length ? `选中 ${ids.length} 项：${ids.join(", ")}` : "未选中")
          }
          className="absolute inset-0"
        />
        {readonly ? null : (
          <CanvasZoomControls
            className="absolute bottom-4 left-4 z-20"
            onZoomIn={() => graphRef.current?.zoomIn()}
            onZoomOut={() => graphRef.current?.zoomOut()}
            onFit={() => graphRef.current?.fitView()}
          />
        )}
      </GraphFrame>
      <p className="text-xs text-muted-foreground">
        {readonly
          ? "只读：可平移缩放，不能编辑。"
          : `${selection}。单击选中，拖拽移动，从右侧磁吸点拉出连线，框选后可打组。`}
      </p>
    </div>
  );
}

function CanvasGraphShowcase() {
  return (
    <StoryShowcase
      title="Canvas Graph"
      description="验收无限画布的空间关系、连线、分组、选中工具条和只读嵌入。卡片内部状态见 Canvas Cards；本页只判断图上的相邻关系与交互。"
    >
      <StoryCase
        title="可编辑工作区"
        description="理解卡、文本、组、画布引用和一条依赖连线。可直接选中、连线、缩放。"
      >
        <InteractiveGraph document={typicalCanvasDocument} />
      </StoryCase>

      <StoryCase title="空画布" description="没有元素时仍保留网格与缩放，不显示业务空态。">
        <InteractiveGraph document={EMPTY_CANVAS_DOCUMENT} />
      </StoryCase>

      <StoryCase
        title="只读与嵌入尺寸"
        description="同一份文档在工作区、弹层和缩略尺寸下的只读呈现。交互仅保留平移缩放。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px_240px]">
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">工作区</span>
            <GraphFrame height="h-[360px]">
              <CanvasReadOnlyView
                document={typicalCanvasDocument}
                shapeData={typicalShapeData}
                className="absolute inset-0"
              />
            </GraphFrame>
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">弹层</span>
            <GraphFrame height="h-[240px]">
              <CanvasReadOnlyView
                document={typicalCanvasDocument}
                shapeData={typicalShapeData}
                className="absolute inset-0"
              />
            </GraphFrame>
          </div>
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">缩略</span>
            <GraphFrame height="h-[160px]">
              <CanvasReadOnlyView
                document={typicalCanvasDocument}
                shapeData={typicalShapeData}
                className="absolute inset-0"
              />
            </GraphFrame>
          </div>
        </div>
      </StoryCase>

      <StoryCase
        title="连线样式"
        description="曲线实线与正交虚线并排出现，用来比较路由、线型、线宽、颜色和箭头。"
      >
        <GraphFrame height="h-[320px]">
          <CanvasReadOnlyView document={edgeStyleDocument} className="absolute inset-0" />
        </GraphFrame>
      </StoryCase>

      <StoryCase
        title="规模边界"
        description="多卡片与连线时的网格、碰撞和缩略图密度。可缩放检查可读性。"
      >
        <InteractiveGraph document={denseCanvasDocument} />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/基本组件",
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

export const CanvasGraphStory: Story = {
  name: "Canvas Graph",
  render: () => <CanvasGraphShowcase />,
};
