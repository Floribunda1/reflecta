/**
 * 四类卡片的统一连线端口。port id 直接使用 X6 路由方向名，
 * 避免 terminal 与 startDirections/endDirections 之间再做映射。
 */
export const CANVAS_PORTS = {
  groups: {
    left: {
      position: "left",
      zIndex: 2,
      attrs: {
        circle: { r: 4, magnet: true, fill: "transparent", stroke: "var(--border)" },
      },
    },
    top: {
      position: "top",
      zIndex: 2,
      attrs: {
        circle: { r: 4, magnet: true, fill: "transparent", stroke: "var(--border)" },
      },
    },
    right: {
      position: "right",
      zIndex: 2,
      attrs: {
        circle: { r: 4, magnet: true, fill: "transparent", stroke: "var(--border)" },
      },
    },
    bottom: {
      position: "bottom",
      zIndex: 2,
      attrs: {
        circle: { r: 4, magnet: true, fill: "transparent", stroke: "var(--border)" },
      },
    },
  },
  items: [
    { group: "left", id: "left" },
    { group: "top", id: "top" },
    { group: "right", id: "right" },
    { group: "bottom", id: "bottom" },
  ],
} as const;
