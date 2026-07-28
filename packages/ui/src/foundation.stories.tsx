import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "#components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/card";
import { Input } from "#components/input";
import { useDrawer, useModal } from "./overlays";

function FoundationPreview() {
  const { confirm } = useModal();
  const { openDrawer } = useDrawer();

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Reflecta UI</CardTitle>
        <CardDescription>Shared tokens, components, and overlays.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input aria-label="Sample input" placeholder="Capture a thought…" />
        <div className="flex gap-2">
          <Button
            onClick={() =>
              confirm({
                message: "This confirmation is rendered by the shared ModalProvider.",
                onAccept: () => undefined,
              })
            }
          >
            Confirm
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              openDrawer(
                { title: "Shared drawer" },
                <p className="text-sm text-muted-foreground">
                  This drawer uses the same provider in Storybook and Electron.
                </p>,
              )
            }
          >
            Open drawer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const meta = {
  title: "Foundation/Reflecta UI",
  component: FoundationPreview,
} satisfies Meta<typeof FoundationPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
