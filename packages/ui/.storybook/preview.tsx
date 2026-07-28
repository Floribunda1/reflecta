import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "../src/styles/globals.css";
import { DrawerProvider, ModalProvider } from "../src/overlays";

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <ModalProvider>
      <DrawerProvider>
        <div className="min-h-screen bg-background p-6 text-foreground">
          <Story />
        </div>
      </DrawerProvider>
    </ModalProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Global theme",
      toolbar: {
        icon: "paintbrush",
        items: ["light", "dark"],
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
  },
};

export default preview;
