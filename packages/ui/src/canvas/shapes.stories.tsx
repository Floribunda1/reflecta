import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import { CanvasReadOnlyView } from "./CanvasReadOnlyView";
import type { CanvasDocument } from "./document";

const now = "2026-08-16T00:00:00.000Z";

const fullDocument: CanvasDocument = {
  elements: [
    {
      id: "ua-card",
      canvasId: "c",
      parentId: null,
      x: 40,
      y: 40,
      width: 260,
      height: 200,
      zIndex: 1,
      createdAt: now,
      updatedAt: now,
      kind: "understanding",
      understandingId: "th_1",
      canvasRefId: null,
      props: {},
    },
    {
      id: "text-card",
      canvasId: "c",
      parentId: null,
      x: 340,
      y: 40,
      width: 220,
      height: 120,
      zIndex: 1,
      createdAt: now,
      updatedAt: now,
      kind: "text",
      understandingId: null,
      canvasRefId: null,
      props: { text: "**一段简单的 markdown**：要点一、要点二。" },
    },
    {
      id: "rect-shape",
      canvasId: "c",
      parentId: null,
      x: 600,
      y: 40,
      width: 140,
      height: 90,
      zIndex: 1,
      createdAt: now,
      updatedAt: now,
      kind: "shape",
      understandingId: null,
      canvasRefId: null,
      props: { shapeType: "rect" },
    },
    {
      id: "circle-shape",
      canvasId: "c",
      parentId: null,
      x: 600,
      y: 170,
      width: 120,
      height: 120,
      zIndex: 1,
      createdAt: now,
      updatedAt: now,
      kind: "shape",
      understandingId: null,
      canvasRefId: null,
      props: { shapeType: "circle" },
    },
    {
      id: "group-node",
      canvasId: "c",
      parentId: null,
      x: 40,
      y: 300,
      width: 320,
      height: 220,
      zIndex: 1,
      createdAt: now,
      updatedAt: now,
      kind: "group",
      understandingId: null,
      canvasRefId: null,
      props: { label: "结构组" },
    },
    {
      id: "ref-card",
      canvasId: "c",
      parentId: null,
      x: 420,
      y: 320,
      width: 180,
      height: 72,
      zIndex: 1,
      createdAt: now,
      updatedAt: now,
      kind: "canvas_ref",
      understandingId: null,
      canvasRefId: "cv_2",
      props: {},
    },
  ],
  edges: [],
};

const shapeData = {
  understandingRefs: new Map([
    [
      "th_1",
      {
        id: "th_1",
        title: "React Server Components",
        body: "RSC 在服务端渲染，可将组件树序列化后增量传输到客户端，**只加载所需部分**，减少 bundle 体积。",
        deleted: false,
      },
    ],
  ]),
  referencedCanvases: new Map([["cv_2", { id: "cv_2", title: "知识结构总览", deleted: false }]]),
};

const deletedShapeData = {
  understandingRefs: new Map([["th_1", { id: "th_1", title: null, body: "", deleted: true }]]),
  referencedCanvases: new Map([["cv_2", { id: "cv_2", title: "（已删除）", deleted: true }]]),
};

function ShapesShowcase() {
  return (
    <StoryShowcase
      title="Canvas Shapes"
      description="理解画布五类元素（react-shape）的展示形态；经 CanvasReadOnlyView 纯展示。"
    >
      <StoryCase
        title="五种元素（含全类型）"
        description="理解卡 / 文本卡 / 图形（矩形·圆） / 组 / 画布引用。"
        contentClassName="h-[560px]"
      >
        <CanvasReadOnlyView document={fullDocument} shapeData={shapeData} />
      </StoryCase>
      <StoryCase
        title="占位态：引用已删除"
        description="理解或目标画布被删除后卡片显示「（已删除）」，内容不再展示。"
        contentClassName="h-[420px]"
      >
        <CanvasReadOnlyView document={fullDocument} shapeData={deletedShapeData} />
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/Shapes",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const ShapesShowcaseStory: Story = {
  render: () => <ShapesShowcase />,
};
