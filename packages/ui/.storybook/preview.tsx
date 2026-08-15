import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "../src/styles/globals.css";
import { DrawerProvider, ModalProvider } from "../src/overlays";
import { ThemeProvider } from "../src/theme-provider";
import { applyGhosttyScheme, DEFAULT_PRIMARY_SLOT } from "../src/styles/apply-ghostty-scheme";
import { DEFAULT_GHOSTTY_SCHEME, PAIRED_THEMES } from "../src/styles/ghostty-themes";

function resolvePairedTheme(scheme: string) {
  return (
    PAIRED_THEMES.find((item) => item.name === scheme) ??
    PAIRED_THEMES.find((item) => item.name === DEFAULT_GHOSTTY_SCHEME)
  );
}

/** 按 Storybook 工具栏选中的配色方案注入 base + accent（跟随当前明暗）。 */
function SchemeBridge({ scheme, theme }: { scheme: string; theme: "light" | "dark" }) {
  useEffect(() => {
    applyGhosttyScheme(
      document.documentElement,
      resolvePairedTheme(scheme),
      theme,
      scheme === DEFAULT_GHOSTTY_SCHEME ? DEFAULT_PRIMARY_SLOT : null,
    );
  }, [scheme, theme]);

  return null;
}

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  const scheme =
    typeof context.globals.scheme === "string" && context.globals.scheme
      ? context.globals.scheme
      : DEFAULT_GHOSTTY_SCHEME;

  return (
    <ThemeProvider forcedTheme={theme} enableSystem={false}>
      <SchemeBridge scheme={scheme} theme={theme} />
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
    scheme: {
      description: "配色方案（Ghostty 配对主题）",
      toolbar: {
        icon: "mirror",
        items: [...PAIRED_THEMES]
          .sort((left, right) => {
            if (left.name === DEFAULT_GHOSTTY_SCHEME) return -1;
            if (right.name === DEFAULT_GHOSTTY_SCHEME) return 1;
            return 0;
          })
          .map((theme) => ({ value: theme.name, title: theme.name })),
      },
    },
  },
  initialGlobals: {
    theme: "light",
    scheme: DEFAULT_GHOSTTY_SCHEME,
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
        includeNames: true,
        order: [
          "Capture",
          ["基本组件", ["Domain Tree", "Domain Tree Select", "Understanding Row"], "组合场景样式"],
          "Editor",
          ["基本组件", ["Markdown Editor", "Markdown Preview", "Markdown 摘要预览"]],
          "Agent",
          [
            "基本组件",
            [
              "Composer",
              "Context Picker",
              "Chat Markdown",
              "Chat Message Row",
              "Execution",
              "Tool",
              "Proposal Card",
              "Thread Sidebar",
              "Message Jump Nav",
            ],
            "组合场景样式",
          ],
          "Styles",
          ["Design Tokens"],
        ],
      },
    },
  },
};

export default preview;
