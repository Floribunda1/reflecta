import { getProvider } from "@antv/x6-react-shape";

/**
 * `@antv/x6-react-shape` 的单例 portal host。
 *
 * 所有画布卡片的 React 子树都挂进这唯一一份 provider——每个使用 `CanvasGraph` 的应用入口
 * （electron main / storybook preview）都要在根挂一次。多 Graph 并存时，卡片经自家 graph 的
 * 桥取数据（见 canvas-bridge / nodes），不再依赖「落进谁的子树」，因此单例 portal 不再造成
 * context 被抢；同一 provider 也消除了多 provider 抢全局 dispatch 的 dev 双挂载重复 key。
 */
export const CanvasPortalHost = getProvider() as React.FC<{ children?: React.ReactNode }>;
