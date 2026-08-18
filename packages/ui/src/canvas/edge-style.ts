import type { Edge } from "@antv/x6";
import type { CanvasEdgeStyle } from "./document";

/**
 * 连线样式映射（F2 / 计划 M4-7）：社区四维模型 → X6 边配置。
 * - 拐点 routing → connector / router（straight / curve / orthographic）
 * - 线型 lineStyle → strokeDasharray
 * - 箭头 arrowhead → targetMarker
 * - 粗细 width → strokeWidth
 * - 颜色 → 预设色板（避免魔法色值）
 * 一键重置 = 回默认样式映射（style 置 null）。
 */

export const EDGE_COLOR_PALETTE = {
  default: "#94a3b8",
  slate: "#64748b",
  blue: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
} as const;

const WIDTH_TO_STROKE = { thin: 1.5, medium: 2.5, thick: 4 } as const;

// X6 3.x 的 targetMarker 接受内置 marker 名（classic/block/circle/diamond）或已注册 marker；
// 传 SVG 字符串会被当作 marker 名称去查找而报错。v1 用内置名（颜色随 line.stroke 默认）。
const MARKER = { arrow: "classic", block: "block" } as const;

const LINE_STYLE_TO_DASHARRAY = {
  solid: "none",
  dashed: "5 5",
  dotted: "2 2",
} as const;

type EdgeX6Config = {
  router?: { name: string; args?: Record<string, unknown> };
  connector?: { name: string; args?: Record<string, unknown> };
  attrs?: {
    line?: Partial<{
      stroke: string;
      strokeWidth: number;
      strokeDasharray: string;
      targetMarker: string;
    }>;
  };
  targetMarker?: string;
  zIndex?: number;
};

/** 默认连线渲染 attrs（X6 3.x 边无 line attrs 不渲染连接路径）。 */
export const DEFAULT_EDGE_LINE_ATTRS = {
  line: { stroke: EDGE_COLOR_PALETTE.default, strokeWidth: 2.5, strokeDasharray: "none" },
} as const;

/** EdgeStyle → X6 边配置（null/undefined 为默认样式）。 */
export function edgeStyleToX6(style: CanvasEdgeStyle | null | undefined): EdgeX6Config {
  const s = style ?? {};
  const routing = s.routing ?? "straight";
  const config: EdgeX6Config = {};
  if (routing === "curve") config.connector = { name: "smooth" };
  else if (routing === "orthogonal") config.router = { name: "manhattan", args: { padding: 12 } };
  else config.connector = { name: "normal" };

  const lineStyle = s.lineStyle ?? "solid";
  const width = s.width ?? "medium";
  const color = s.color ?? "default";
  const colorValue =
    EDGE_COLOR_PALETTE[color as keyof typeof EDGE_COLOR_PALETTE] ?? EDGE_COLOR_PALETTE.default;

  const arrowhead = s.arrowhead ?? "arrow";
  let targetMarker: string | undefined;
  if (arrowhead === "none") targetMarker = undefined;
  else targetMarker = MARKER[arrowhead === "block" ? "block" : "arrow"];

  config.attrs = {
    line: {
      stroke: colorValue,
      strokeWidth: WIDTH_TO_STROKE[width as keyof typeof WIDTH_TO_STROKE],
      strokeDasharray: LINE_STYLE_TO_DASHARRAY[lineStyle as keyof typeof LINE_STYLE_TO_DASHARRAY],
      targetMarker,
    },
  };
  return config;
}

/** 现有 X6 边应用标签（M4-3）：label → edge labels 渲染。 */
export function applyEdgeLabel(edge: Edge, label: string | null): void {
  if (label) {
    edge.setLabels([
      {
        position: 0.5,
        attrs: {
          label: {
            text: label,
            fill: "#475569",
            textAnchor: "middle",
            textVerticalAnchor: "middle",
            fontSize: 12,
            stroke: "#ffffff",
            strokeWidth: 3,
            paintOrder: "stroke",
          },
          body: { fill: "#ffffff", rx: 4, ry: 4 },
        },
      },
    ]);
  } else {
    edge.setLabels([]);
  }
}

/** 对现有 X6 边应用样式（交互时写回）。 */
export function applyEdgeStyle(edge: Edge, style: CanvasEdgeStyle | null): void {
  const x6 = edgeStyleToX6(style);
  const data = edge.getData<{ style?: CanvasEdgeStyle | null }>();
  edge.setData({ ...data, style }, { overwrite: false });
  if (x6.router) edge.setRouter(x6.router.name, x6.router.args);
  else edge.setRouter(null as never as string);
  if (x6.connector) edge.setConnector(x6.connector.name, x6.connector.args);
  else edge.setConnector("normal");
  const line = x6.attrs?.line;
  if (line) edge.attr("line", line);
  else edge.attr("line", edgeStyleToX6(null).attrs!.line!);
}
