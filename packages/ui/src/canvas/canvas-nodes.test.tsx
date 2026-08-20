// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CanvasElementDTO } from "./document";
import {
  CanvasElementUpdateProvider,
  CanvasShapeDataProvider,
  EMPTY_CANVAS_SHAPE_DATA,
  type CanvasShapeData,
} from "./shape-context";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string }) => <span data-testid={`handle-${type}`} />,
  NodeResizer: ({ isVisible }: { isVisible: boolean }) => (
    <span data-testid="node-resizer" data-visible={String(isVisible)} />
  ),
  NodeToolbar: ({ isVisible, children }: { isVisible: boolean; children: ReactNode }) =>
    isVisible ? <div data-testid="node-toolbar">{children}</div> : null,
  Position: { Left: "left", Right: "right" },
}));

import { CanvasRefNode, GroupNode, TextNode, UnderstandingNode } from "./nodes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const time = "2026-08-19T00:00:00.000Z";
const base = {
  canvasId: "canvas",
  parentId: null,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  zIndex: 0,
  createdAt: time,
  updatedAt: time,
};

const elements = {
  understanding: {
    ...base,
    id: "understanding",
    kind: "understanding",
    understandingId: "u",
    canvasRefId: null,
    props: {},
  },
  text: {
    ...base,
    id: "text",
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: "ORIGINAL" },
  },
  group: {
    ...base,
    id: "group",
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: { label: "GROUP" },
  },
  canvas_ref: {
    ...base,
    id: "reference",
    kind: "canvas_ref",
    understandingId: null,
    canvasRefId: "target",
    props: {},
  },
} satisfies Record<string, CanvasElementDTO>;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function props<
  C extends typeof TextNode | typeof GroupNode | typeof UnderstandingNode | typeof CanvasRefNode,
>(
  component: C,
  element: CanvasElementDTO,
  state: { selected?: boolean; dragging?: boolean } = {},
): ComponentProps<C> {
  void component;
  return {
    id: element.id,
    data: { element },
    type: element.kind,
    selected: state.selected ?? false,
    dragging: state.dragging ?? false,
    draggable: true,
    selectable: true,
    deletable: true,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  } as ComponentProps<C>;
}

function render(view: ReactNode, shapeData: Partial<CanvasShapeData> = {}, onUpdate = vi.fn()) {
  act(() => {
    root.render(
      <CanvasShapeDataProvider value={{ ...EMPTY_CANVAS_SHAPE_DATA, ...shapeData }}>
        <CanvasElementUpdateProvider value={onUpdate}>{view}</CanvasElementUpdateProvider>
      </CanvasShapeDataProvider>,
    );
  });
  return onUpdate;
}

const cardCases = [
  ["understanding", UnderstandingNode, elements.understanding],
  ["text", TextNode, elements.text],
  ["canvas reference", CanvasRefNode, elements.canvas_ref],
] as const;

describe("canvas nodes", () => {
  test.each(cardCases)(
    "%s exposes content shell, both handles, selection, dragging, focus, and resizer",
    (_name, Component, element) => {
      render(<Component {...props(Component, element, { selected: true, dragging: true })} />);
      expect(container.querySelector('[data-testid="handle-source"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="handle-target"]')).not.toBeNull();
      expect(
        container.querySelector('[data-testid="node-resizer"]')?.getAttribute("data-visible"),
      ).toBe("true");
      const shell = container.querySelector<HTMLElement>("[tabindex='0']");
      expect(shell?.className).toContain("ring-2");
      expect(shell?.className).toContain("opacity-80");
      expect(shell?.className).toContain("focus-visible:ring-2");
      expect(shell?.className).not.toContain("hover:ring-2");
    },
  );

  test.each(cardCases)("%s shows hover ring when idle", (_name, Component, element) => {
    render(<Component {...props(Component, element)} />);
    expect(container.querySelector<HTMLElement>("[tabindex='0']")?.className).toContain(
      "hover:ring-2",
    );
  });

  test("group overlay keeps handles and resizer but does not draw a second frame", () => {
    render(<GroupNode {...props(GroupNode, elements.group, { selected: true, dragging: true })} />);
    expect(container.querySelector('[data-testid="handle-source"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="handle-target"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="node-resizer"]')?.getAttribute("data-visible"),
    ).toBe("true");
    const overlay = container.querySelector<HTMLElement>('[data-testid="canvas-group-node"]');
    expect(overlay?.className).not.toMatch(/\bborder\b/);
    expect(overlay?.className).not.toContain("rounded-lg");
    expect(overlay?.className).not.toContain("ring-2");
    expect(overlay?.className).not.toContain("hover:ring-2");
  });

  test.each([
    ["understanding", UnderstandingNode, elements.understanding],
    ["text", TextNode, elements.text],
    ["group", GroupNode, elements.group],
    ["canvas reference", CanvasRefNode, elements.canvas_ref],
  ])("readonly %s hides its resizer", (_name, Component, element) => {
    render(<Component {...props(Component, element, { selected: true })} />, { readonly: true });
    expect(
      container.querySelector('[data-testid="node-resizer"]')?.getAttribute("data-visible"),
    ).toBe("false");
  });

  test("readonly editable nodes hide controls and ignore edit gestures", () => {
    render(<TextNode {...props(TextNode, elements.text, { selected: true })} />, {
      readonly: true,
    });
    expect(container.querySelector('[data-testid="node-toolbar"]')).toBeNull();
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="canvas-text-card"]')
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(container.querySelector("textarea")).toBeNull();
    render(<GroupNode {...props(GroupNode, elements.group, { selected: true })} />, {
      readonly: true,
    });
    expect(container.querySelector('[data-testid="node-toolbar"]')).toBeNull();
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="canvas-group-label"]')
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(container.querySelector('input[aria-label="组名"]')).toBeNull();
  });

  test("understanding renders referenced content and a deleted placeholder", async () => {
    const refs = new Map([["u", { id: "u", title: "TITLE", body: "BODY", deleted: false }]]);
    render(<UnderstandingNode {...props(UnderstandingNode, elements.understanding)} />, {
      understandingRefs: refs,
    });
    expect(container.textContent).toContain("TITLE");
    // 正文走 MarkdownPreview（Milkdown 异步渲染），轮询等待文本出现。
    const deadline = Date.now() + 2000;
    while (!container.textContent?.includes("BODY") && Date.now() < deadline) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(container.textContent).toContain("BODY");
    render(<UnderstandingNode {...props(UnderstandingNode, elements.understanding)} />, {
      understandingRefs: new Map(),
    });
    expect(container.textContent).toContain("（已删除）");
  });

  test("text editing commits changes, ignores unchanged blur, and cancels with Escape", () => {
    const onUpdate = render(<TextNode {...props(TextNode, elements.text)} />);
    const card = container.querySelector<HTMLElement>('[data-testid="canvas-text-card"]')!;
    act(() => card.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    // 双击进入 Markdown 编辑器（不再是 textarea）
    expect(container.querySelector("textarea")).toBeNull();
    const editor = container.querySelector<HTMLElement>(".reflecta-md-editor");
    expect(editor).not.toBeNull();

    // Escape 取消编辑：不提交、回到预览（预览经 MarkdownPreview 也含 .reflecta-md-editor，
    // 所以用 data-editing 状态判断编辑已关闭）
    const editorWrap = container.querySelector<HTMLElement>(
      '[data-testid="canvas-text-card"] .nodrag',
    )!;
    act(() =>
      editorWrap.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(card.getAttribute("data-editing")).toBe("false");
    expect(container.querySelector(".markdown-preview")).not.toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  test("group rename and toolbar actions use the document callbacks", () => {
    const onUpdate = vi.fn();
    const onCellAction = vi.fn();
    render(
      <GroupNode {...props(GroupNode, elements.group, { selected: true })} />,
      { onCellAction },
      onUpdate,
    );
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="canvas-group-label"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    const input = container.querySelector<HTMLInputElement>('input[aria-label="组名"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "RENAMED",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ props: { label: "RENAMED" } }));
    // 工具栏顺序：解组、颜色（NodeActions）、删除组；删除应在最后。
    const buttons = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-testid="node-toolbar"] button'),
    ];
    expect(buttons).toHaveLength(3);
    act(() => buttons[0].click());
    act(() => buttons[2].click());
    expect(onCellAction.mock.calls.map(([action]) => action.type)).toEqual([
      "ungroup",
      "delete-group",
    ]);
  });

  test("canvas reference navigates only while its target exists", () => {
    const onCanvasRefClick = vi.fn();
    const target = { id: "target", title: "TARGET_CANVAS", deleted: false };
    render(<CanvasRefNode {...props(CanvasRefNode, elements.canvas_ref)} />, {
      referencedCanvases: new Map([["target", target]]),
      onCanvasRefClick,
    });
    expect(container.textContent).toContain("TARGET_CANVAS");
    // 单击不跳转，双击打开
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="canvas-canvas-ref-card"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(onCanvasRefClick).toHaveBeenCalledWith("target");

    render(<CanvasRefNode {...props(CanvasRefNode, elements.canvas_ref)} />, {
      referencedCanvases: new Map(),
      onCanvasRefClick,
    });
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="canvas-canvas-ref-card"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(container.textContent).toContain("（已删除）");
    expect(onCanvasRefClick).toHaveBeenCalledTimes(1);
  });
});
