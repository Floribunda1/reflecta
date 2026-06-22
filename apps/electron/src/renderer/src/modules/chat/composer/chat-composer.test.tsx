// @vitest-environment happy-dom

import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ChatComposer } from "./chat-composer";
import type { InspectableContextRef } from "../context/context-reference";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const noop = vi.fn();

function renderComposer(onInspectContextRef: (ref: InspectableContextRef) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ChatComposer
          isBusy={false}
          canStop={false}
          editingMessage={{
            id: "user-1",
            text: "热爱是高效前进的强驱动力",
            contextRefs: [{ type: "thought", id: "thought-1", title: "热爱是高效前进的强驱动力" }],
            files: [],
            composerContent: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "mention",
                      attrs: {
                        id: "thought:thought-1",
                        label: "热爱是高效前进的强驱动力",
                      },
                    },
                  ],
                },
              ],
            },
          }}
          focusRequest={0}
          modelOptions={[]}
          activeModel={null}
          messages={[]}
          modelSelectorDisabled={false}
          onSend={noop}
          onSelectModel={noop}
          onCancelEdit={noop}
          onStop={noop}
          onInspectContextRef={onInspectContextRef}
        />
      </QueryClientProvider>,
    );
  });

  return { container, root };
}

describe("ChatComposer", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    noop.mockClear();
  });

  test("opens inspector when clicking an inspectable mention", () => {
    const onInspectContextRef = vi.fn();
    const rendered = renderComposer(onInspectContextRef);
    root = rendered.root;
    container = rendered.container;

    const mention = container.querySelector(
      '[data-slot="composer-context-mention"]',
    ) as HTMLElement | null;

    expect(mention?.textContent).toBe("✦ 热爱是高效前进的强驱动力");

    act(() => {
      mention?.click();
    });

    expect(onInspectContextRef).toHaveBeenCalledWith({
      type: "thought",
      id: "thought-1",
      title: "热爱是高效前进的强驱动力",
    });
  });
});
