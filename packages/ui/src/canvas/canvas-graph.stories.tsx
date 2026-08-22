import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useRef, useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { CanvasReadOnlyView } from "./CanvasReadOnlyView";
import { CanvasZoomControls } from "./CanvasZoomControls";
import {
  canvasRefCardsDocument,
  denseCanvasDocument,
  edgeArrowheadDocument,
  edgeColorDocument,
  edgeLabelDocument,
  edgeLineStyleDocument,
  edgeRoutingDocument,
  edgeWidthDocument,
  groupCardsDocument,
  textCardsDocument,
  typicalCanvasDocument,
  typicalShapeData,
  understandingCardsDocument,
} from "./canvas-story-fixtures";
import { EMPTY_CANVAS_DOCUMENT, type CanvasDocument } from "./document";
import type { CanvasShapeData } from "./shape-context";

function GraphFrame({
  height = "h-[420px]",
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
  height,
  hint,
}: {
  document: CanvasDocument;
  readonly?: boolean;
  shapeData?: CanvasShapeData;
  height?: string;
  hint?: string;
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
      <GraphFrame height={height}>
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
        {hint ??
          (readonly
            ? "只读：可平移缩放，不能编辑。"
            : `${selection}。单击选中卡片或连线；选中连线后底部出现样式工具条。`)}
      </p>
    </div>
  );
}

function CanvasGraphShowcase() {
  return (
    <StoryShowcase
      title="Canvas Graph"
      description="验收无限画布上的卡片、连线、分组和只读嵌入。卡片与连线都在图里比较，不脱离画布单独摆放。"
    >
      <StoryCase
        title="可编辑工作区"
        description="理解、文本、组、画布引用和一条依赖连线。可直接选中、连线、缩放。"
      >
        <InteractiveGraph document={typicalCanvasDocument} height="h-[520px]" />
      </StoryCase>

      <StoryCase
        title="理解卡"
        description="从左到右：典型正文、无标题、引用已删除；下一行是长标题滚动和着色。单击选中后出现操作条。"
      >
        <InteractiveGraph document={understandingCardsDocument} height="h-[560px]" />
      </StoryCase>

      <StoryCase title="文本卡" description="预览、空白、长正文和着色。双击进入编辑，失焦提交。">
        <InteractiveGraph document={textCardsDocument} height="h-[400px]" />
      </StoryCase>

      <StoryCase title="组" description="含成员的命名组、未命名组、长名称着色组。双击组名可编辑。">
        <InteractiveGraph document={groupCardsDocument} height="h-[320px]" />
      </StoryCase>

      <StoryCase
        title="画布引用卡"
        description="内嵌预览、仅标题、目标已删除、着色。双击打开由上层处理。"
      >
        <InteractiveGraph document={canvasRefCardsDocument} height="h-[420px]" />
      </StoryCase>

      <StoryCase title="连线形状" description="曲线 / 直线 / 正交。单击连线打开底部样式工具条。">
        <InteractiveGraph document={edgeRoutingDocument} height="h-[360px]" />
      </StoryCase>

      <StoryCase title="连线线型" description="实线 / 虚线 / 点线。">
        <InteractiveGraph document={edgeLineStyleDocument} height="h-[360px]" />
      </StoryCase>

      <StoryCase title="连线线宽" description="细 / 中 / 粗。">
        <InteractiveGraph document={edgeWidthDocument} height="h-[360px]" />
      </StoryCase>

      <StoryCase title="连线颜色" description="默认色与五档 chart token。">
        <InteractiveGraph document={edgeColorDocument} height="h-[620px]" />
      </StoryCase>

      <StoryCase
        title="连线箭头"
        description="classic / block / circle / diamond / cross / ellipse / 无。"
      >
        <InteractiveGraph document={edgeArrowheadDocument} height="h-[700px]" />
      </StoryCase>

      <StoryCase title="连线标签" description="无标签、短标签、长标签。选中后可在工具条里改标签。">
        <InteractiveGraph document={edgeLabelDocument} height="h-[360px]" />
      </StoryCase>

      <StoryCase title="空画布" description="没有元素时仍保留网格与缩放，不显示业务空态。">
        <InteractiveGraph document={EMPTY_CANVAS_DOCUMENT} height="h-[280px]" />
      </StoryCase>

      <StoryCase
        title="只读与嵌入尺寸"
        description="同一份文档在工作区、弹层和缩略尺寸下的只读呈现。"
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
        title="规模边界"
        description="多卡片与连线时的网格、碰撞和缩略图密度。可缩放检查可读性。"
      >
        <InteractiveGraph document={denseCanvasDocument} height="h-[480px]" />
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
