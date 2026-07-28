import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles/globals.css";
import { DrawerProvider, ModalProvider } from "../src/overlays";
import { ThemeProvider } from "../src/theme-provider";

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";

  return (
    <ThemeProvider forcedTheme={theme} enableSystem={false}>
      <ModalProvider>
        <DrawerProvider>
          <div className="min-h-screen bg-background p-6 text-foreground">
            <Story />
          </div>
        </DrawerProvider>
      </ModalProvider>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "全局主题",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "浅色" },
          { value: "dark", title: "深色" },
        ],
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: [
          "Capture",
          [
            "基本组件",
            ["Markdown Editor", "Domain Tree", "Domain Tree Select", "Understanding Row"],
            "组合场景样式",
          ],
          "Agent",
          ["基本组件", ["Composer", "Message", "Markdown", "Tool"], "组合场景样式"],
          "Knowledge Wander",
          ["基本组件", ["Knowledge Graph"]],
        ],
      },
    },
  },
};

export default preview;
