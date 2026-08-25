import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal(config) {
    config.plugins ??= [];
    config.plugins.push(tailwindcss());
    // elkjs 声明了 optional 的 web-worker 依赖，rolldown 无法解析；与 electron
    // 构建一致地 externalize（elkjs 选择非 worker 路径执行，功能不受影响）。
    config.build ??= {};
    config.build.rolldownOptions ??= {};
    config.build.rolldownOptions.external = ["web-worker"];
    return config;
  },
};

export default config;
