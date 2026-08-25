// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Effect } from "effect";
import { rpc } from "@renderer/lib/effect-rpc";
import { MarkdownPreview, SimpleMarkdownPreview } from "./resolved-markdown";

vi.mock("@renderer/lib/effect-rpc", () => ({
  rpc: {
    understandingGetById: vi.fn(),
    contextGetById: vi.fn(),
    canvasGet: vi.fn(),
    domainGetDomainById: vi.fn(),
  },
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

function render(node: ReactNode): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function compactHtml(container: HTMLDivElement): string {
  return container.querySelector(".markdown-preview-compact")?.innerHTML ?? "";
}

test("resolved SimpleMarkdownPreview fetches titles via rpc and re-labels refs", async () => {
  vi.mocked(rpc.understandingGetById).mockReturnValue(
    Effect.succeed({ id: "abc-1", title: "标题A", body: "" }) as never,
  );

  const next = render(
    <QueryClientProvider client={queryClient}>
      <SimpleMarkdownPreview value="见 [[u:abc-1]]" />
    </QueryClientProvider>,
  );

  // 数据未就绪时回退裸 id
  expect(compactHtml(next)).toContain("abc-1");

  // 查询落定 → wrapper 重渲染 → 引用显示标题
  await vi.waitFor(() => {
    expect(compactHtml(next)).toContain("标题A");
  });
  expect(rpc.understandingGetById).toHaveBeenCalledWith("abc-1");
});

test("resolved MarkdownPreview (milkdown) re-labels wiki links after rpc data arrives", async () => {
  vi.mocked(rpc.understandingGetById).mockReturnValue(
    Effect.succeed({ id: "abc-1", title: "标题A", body: "" }) as never,
  );

  const next = render(
    <QueryClientProvider client={queryClient}>
      <MarkdownPreview value="见 [[u:abc-1]]" />
    </QueryClientProvider>,
  );

  await vi.waitFor(
    () => {
      const link = next.querySelector<HTMLAnchorElement>("a[data-wiki-link]");
      expect(link?.textContent).toContain("标题A");
    },
    { timeout: 5000 },
  );
  expect(rpc.understandingGetById).toHaveBeenCalledWith("abc-1");
});

test("resolved MarkdownPreview resolves inside a portal (x6 foContent 等价渲染)", async () => {
  vi.mocked(rpc.understandingGetById).mockReturnValue(
    Effect.succeed({ id: "abc-1", title: "标题A", body: "" }) as never,
  );

  const portalTarget = document.createElement("div");
  container?.appendChild(portalTarget);
  render(
    <QueryClientProvider client={queryClient}>
      {createPortal(<MarkdownPreview value="见 [[u:abc-1]]" />, portalTarget)}
    </QueryClientProvider>,
  );

  await vi.waitFor(
    () => {
      const link = portalTarget.querySelector<HTMLAnchorElement>("a[data-wiki-link]");
      expect(link?.textContent).toContain("标题A");
    },
    { timeout: 5000 },
  );
  expect(rpc.understandingGetById).toHaveBeenCalledWith("abc-1");
});
