import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockElectron = vi.hoisted(() => ({
  appData: "",
  userData: "",
  showSaveDialog: vi.fn(),
  showItemInFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return false;
    },
    getPath(name: string) {
      if (name === "appData") return mockElectron.appData;
      if (name === "userData") return mockElectron.userData;
      throw new Error(`Unexpected app path: ${name}`);
    },
  },
  shell: {
    showItemInFolder: mockElectron.showItemInFolder,
  },
  dialog: {
    showSaveDialog: mockElectron.showSaveDialog,
  },
}));

vi.mock("electron-ipc-decorator", () => ({
  getIpcContext: () => ({ sender: {} }),
  IpcMethod: () => () => undefined,
  IpcService: class {},
}));

vi.mock("./core", () => ({ piAgentHost: {} }));

let tempDir: string;
const originalArgv = process.argv;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-chat-service-"));
  mockElectron.appData = path.join(tempDir, "app-data");
  mockElectron.userData = path.join(tempDir, "user-data");
  mockElectron.showSaveDialog.mockReset();
  mockElectron.showItemInFolder.mockClear();
  process.argv = [
    "electron",
    "app",
    "--reflecta-app-config-dir",
    path.join(tempDir, "config"),
    "--reflecta-content-root",
    path.join(tempDir, "content"),
  ];
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.argv = originalArgv;
});

describe("ChatService export", () => {
  test("writes Markdown to the selected path and reveals the exported file", async () => {
    const { ChatService } = await import("./ChatService");
    const service = new ChatService();
    const selectedPath = path.join(tempDir, "selected", "A-B.md");
    mockElectron.showSaveDialog.mockResolvedValue({ canceled: false, filePath: selectedPath });

    const filePath = await service.exportMarkdown("A/B.md", "# Export\n");

    expect(mockElectron.showSaveDialog).toHaveBeenCalledWith({
      title: "导出 Markdown",
      defaultPath: "A-B.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(filePath).toBe(selectedPath);
    expect(fs.readFileSync(filePath!, "utf-8")).toBe("# Export\n");
    expect(mockElectron.showItemInFolder).toHaveBeenCalledWith(filePath);
  });

  test("returns null without writing when the save dialog is cancelled", async () => {
    const { ChatService } = await import("./ChatService");
    const service = new ChatService();
    mockElectron.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });

    await expect(service.exportMarkdown("A/B.md", "# Export\n")).resolves.toBeNull();
    expect(fs.existsSync(path.join(tempDir, "selected"))).toBe(false);
    expect(mockElectron.showItemInFolder).not.toHaveBeenCalled();
  });
});
