import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryShowcase } from "../../.storybook/story-showcase";
import { Button } from "../components/button";
import { CanvasGraph, type CanvasGraphHandle } from "./CanvasGraph";
import { GraphFrame, InteractiveGraph, StoryCaseSwitch } from "./canvas-story-graph";
import {
  edgeArrowheadDocument,
  edgeColorDocument,
  edgeLabelDocument,
  edgeLineStyleDocument,
  edgeRoutingDocument,
  edgeWidthDocument,
  typicalCanvasDocument,
  typicalShapeData,
} from "./canvas-story-fixtures";
import type { CanvasDocument, CanvasEdgeDTO, CanvasEdgePortId } from "./document";
import { edgeToEdge } from "./graph-document";

const PATH_OPTIONS = [
  { value: "curve", label: "曲线" },
  { value: "straight", label: "直线" },
  { value: "orthogonal", label: "正交" },
] as const;
type Path = (typeof PATH_OPTIONS)[number]["value"];

const PORTS = ["top", "right", "bottom", "left"] as const satisfies ReadonlyArray<CanvasEdgePortId>;

const POSITIONS = [
  { label: "上", source: [322, 250], target: [322, 40] },
  { label: "右上", source: [322, 250], target: [620, 40] },
  { label: "右", source: [322, 250], target: [620, 250] },
  { label: "右下", source: [322, 250], target: [620, 460] },
  { label: "下", source: [322, 250], target: [322, 460] },
  { label: "左下", source: [322, 250], target: [24, 460] },
  { label: "左", source: [322, 250], target: [24, 250] },
  { label: "左上", source: [322, 250], target: [24, 40] },
] as const;

function pathConfig(
  path: Path,
  sourcePort: CanvasEdgePortId,
  targetPort: CanvasEdgePortId,
): Pick<CanvasEdgeDTO, "router" | "connector"> {
  if (path === "curve") return { router: null, connector: { name: "smooth" } };
  if (path === "straight") return { router: null, connector: { name: "normal" } };
  return {
    router: {
      name: "manhattan",
      args: {
        padding: 20,
        startDirections: [sourcePort],
        endDirections: [targetPort],
      },
    },
    connector: { name: "rounded", args: { radius: 8 } },
  };
}

const pathDemoSource = edgeRoutingDocument.elements[0];
const pathDemoTarget = edgeRoutingDocument.elements[1];
if (pathDemoSource?.kind !== "text" || pathDemoTarget?.kind !== "text") {
  throw new Error("Edge path Story requires two text elements");
}

const PATH_DEMO_DOCUMENT: CanvasDocument = {
  elements: [
    {
      ...pathDemoSource,
      x: POSITIONS[3].source[0],
      y: POSITIONS[3].source[1],
      width: 220,
      height: 120,
      props: { ...pathDemoSource.props, text: "起点" },
    },
    {
      ...pathDemoTarget,
      x: POSITIONS[3].target[0],
      y: POSITIONS[3].target[1],
      width: 220,
      height: 120,
      props: { ...pathDemoTarget.props, text: "终点" },
    },
  ],
  edges: [{ ...edgeRoutingDocument.edges[0], label: null }],
};

function EdgeRoutingLab() {
  const graphRef = useRef<CanvasGraphHandle>(null);
  const [path, setPath] = useState<Path>("curve");
  const [position, setPosition] = useState(3);
  const [currentEdge, setCurrentEdge] = useState(PATH_DEMO_DOCUMENT.edges[0]!);

  const edgeCell = () => {
    const cell = graphRef.current?.graph?.getCellById(currentEdge.id);
    return cell?.isEdge() ? cell : null;
  };
  const fit = () => requestAnimationFrame(() => graphRef.current?.fitView());
  const selectPath = (nextPath: Path) => {
    const cell = edgeCell();
    if (!cell) return;
    const edge = edgeToEdge(cell);
    graphRef.current?.updateEdge({
      ...edge,
      ...pathConfig(nextPath, edge.source.port, edge.target.port),
    });
    setPath(nextPath);
    setCurrentEdge(edgeToEdge(cell));
    fit();
  };
  const reconnect = (terminal: "source" | "target", port: CanvasEdgePortId) => {
    const cell = edgeCell();
    if (!cell) return;
    if (terminal === "source") cell.setSource({ cell: currentEdge.source.cell, port });
    else cell.setTarget({ cell: currentEdge.target.cell, port });
    setCurrentEdge(edgeToEdge(cell));
    fit();
  };
  const moveNodes = (index: number) => {
    const graph = graphRef.current?.graph;
    const next = POSITIONS[index];
    if (!graph || !next) return;
    const source = graph.getCellById(pathDemoSource.id);
    const target = graph.getCellById(pathDemoTarget.id);
    if (source?.isNode()) source.position(next.source[0], next.source[1]);
    if (target?.isNode()) target.position(next.target[0], next.target[1]);
    setPosition(index);
    fit();
  };
  const directions = currentEdge.router?.args;
  const aligned =
    currentEdge.router?.name !== "manhattan" ||
    (Array.isArray(directions?.startDirections) &&
      directions.startDirections[0] === currentEdge.source.port &&
      Array.isArray(directions.endDirections) &&
      directions.endDirections[0] === currentEdge.target.port);

  return (
    <StoryShowcase
      title="Edge Routing Lab"
      description="切换节点位置、连接桩和路径；正交线重连后应始终沿当前连接桩方向出入。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
            <span className="px-2 text-sm text-muted-foreground">路径</span>
            {PATH_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={path === option.value ? "secondary" : "ghost"}
                onClick={() => selectPath(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
            <span className="px-2 text-sm text-muted-foreground">起点桩</span>
            {PORTS.map((port) => (
              <Button
                key={port}
                type="button"
                size="sm"
                variant={currentEdge.source.port === port ? "secondary" : "ghost"}
                aria-label={`起点:${port}`}
                onClick={() => reconnect("source", port)}
              >
                {port}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
            <span className="px-2 text-sm text-muted-foreground">终点桩</span>
            {PORTS.map((port) => (
              <Button
                key={port}
                type="button"
                size="sm"
                variant={currentEdge.target.port === port ? "secondary" : "ghost"}
                aria-label={`终点:${port}`}
                onClick={() => reconnect("target", port)}
              >
                {port}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1">
            <span className="px-2 text-sm text-muted-foreground">位置</span>
            {POSITIONS.map((item, index) => (
              <Button
                key={item.label}
                type="button"
                size="sm"
                variant={position === index ? "secondary" : "ghost"}
                onClick={() => moveNodes(index)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <GraphFrame height="h-[620px]">
            <CanvasGraph
              ref={graphRef}
              document={PATH_DEMO_DOCUMENT}
              readonly
              viewportReady
              shapeData={typicalShapeData}
              className="absolute inset-0"
            />
          </GraphFrame>
        </div>
        <div className="grid content-start gap-2 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">{aligned ? "方向一致" : "方向不一致"}</p>
          <pre className="overflow-auto rounded-md border bg-background p-3 text-xs">
            {JSON.stringify(
              {
                source: currentEdge.source,
                target: currentEdge.target,
                router: currentEdge.router,
                connector: currentEdge.connector,
              },
              null,
              2,
            )}
          </pre>
          <p className="text-xs text-muted-foreground">
            连接桩按钮直接调用 X6 setSource / setTarget，用于验收重连后的原生配置。
          </p>
        </div>
      </div>
    </StoryShowcase>
  );
}

function CanvasEdgesShowcase() {
  return (
    <StoryShowcase
      title="Canvas Edges"
      description="验收连线的路径、线型、线宽、颜色、箭头和标签。同一时间只挂一张图。单击连线打开底部配置工具条。"
    >
      <StoryCaseSwitch
        cases={[
          {
            title: "路径",
            description: "曲线 / 直线 / 正交。",
            content: <InteractiveGraph document={edgeRoutingDocument} height="h-[360px]" />,
          },
          {
            title: "线型",
            description: "实线 / 虚线 / 点线。",
            content: <InteractiveGraph document={edgeLineStyleDocument} height="h-[360px]" />,
          },
          {
            title: "线宽",
            description: "细 / 中 / 粗。",
            content: <InteractiveGraph document={edgeWidthDocument} height="h-[360px]" />,
          },
          {
            title: "颜色",
            description: "默认色与五档 chart token。",
            content: <InteractiveGraph document={edgeColorDocument} height="h-[620px]" />,
          },
          {
            title: "箭头",
            description: "classic / block / circle / diamond / cross / ellipse / 无。",
            content: <InteractiveGraph document={edgeArrowheadDocument} height="h-[700px]" />,
          },
          {
            title: "标签",
            description: "无标签、短标签、长标签。双击连线就地编辑标签。",
            content: <InteractiveGraph document={edgeLabelDocument} height="h-[360px]" />,
          },
        ]}
      />
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

export const CanvasEdgesStory: Story = {
  name: "Canvas Edges",
  render: () => <CanvasEdgesShowcase />,
};

export const EdgePathEditorProposalStory: Story = {
  name: "Edge Routing Lab",
  render: () => <EdgeRoutingLab />,
};
