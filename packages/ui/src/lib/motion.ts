// 动效令牌（v1.5.0，Beautiful UI 启发）—— 组件统一引用，不写死参数。
// 缓动的 CSS 形态定义在 tokens.css（--ease-* / --duration-*），
// 这里提供 motion/react 可直接使用的 spring 与数组形态。

export const EASE_OUT_EXPO = [0.23, 1, 0.32, 1] as const;
export const EASE_DRAWER = [0.16, 1, 0.3, 1] as const;

/** 进入动画统一参数（Beautiful UI：fade-up 300ms / 位移 8px，pop-in 300ms / 起点 .95）。 */
export const ENTER_DURATION = 0.3;
export const FADE_UP_Y = 8;
export const POP_IN_SCALE = 0.95;

/** 内容交换（图标/标签切换）。 */
export const SPRING_SWAP = {
  type: "spring",
  stiffness: 460,
  damping: 30,
  mass: 0.55,
} as const;

/** 按压反馈（按钮/可点行）。 */
export const SPRING_PRESS = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const;

/** 共享布局位移（行重排/指示器滑动）。 */
export const SPRING_LAYOUT = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  mass: 0.6,
} as const;
