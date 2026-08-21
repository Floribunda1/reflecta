/**
 * 四类卡片的统一连线端口：左 = 入（target/port `in`），右 = 出（source/port `out`）。
 * 与旧 React Flow「左 target / 右 source」语义一致；`magnet:true` 才能被连线吸附。
 */
export const CANVAS_PORTS = {
  groups: {
    in: {
      position: "left",
      zIndex: 2,
      attrs: {
        circle: { r: 4, magnet: true, fill: "transparent", stroke: "var(--border)" },
      },
    },
    out: {
      position: "right",
      zIndex: 2,
      attrs: {
        circle: { r: 4, magnet: true, fill: "transparent", stroke: "var(--border)" },
      },
    },
  },
  items: [
    { group: "in", id: "in" },
    { group: "out", id: "out" },
  ],
} as const;
