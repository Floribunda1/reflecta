// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AgentProposalCard } from "./agent-proposal-card";
import type { AgentProposalView } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function proposal(lifecycle: AgentProposalView["lifecycle"]): AgentProposalView {
  return {
    id: "approval-1",
    kind: "understanding-create",
    title: "候选 Understanding",
    lifecycle,
    decisionEnabled: lifecycle === "pending",
    content: { heading: "组件边界", body: "稳定 snapshot" },
  };
}

function render(view: AgentProposalView, onDecision = vi.fn()) {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => root?.render(<AgentProposalCard proposal={view} onDecision={onDecision} />));
  return { container, onDecision };
}

describe("AgentProposalCard", () => {
  test("shows decisions only for the final pending snapshot", () => {
    const rendered = render(proposal("preview"));
    expect(
      rendered.container.querySelector('[data-testid="agent-proposal-confirm-button"]'),
    ).toBeNull();

    render(proposal("pending"), rendered.onDecision);
    const confirm = rendered.container.querySelector<HTMLButtonElement>(
      '[data-testid="agent-proposal-confirm-button"]',
    );
    expect(confirm).not.toBeNull();
    act(() => confirm?.click());
    expect(rendered.onDecision).toHaveBeenCalledWith({
      proposalId: "approval-1",
      decision: "approve",
    });

    render(proposal("running"), rendered.onDecision);
    expect(
      rendered.container.querySelector('[data-testid="agent-proposal-confirm-button"]'),
    ).toBeNull();
  });

  test("rejects immediately and forwards an optional reason", () => {
    const rendered = render(proposal("pending"));
    const reject = rendered.container.querySelector<HTMLButtonElement>(
      '[data-testid="agent-proposal-reject-button"]',
    );
    const input = rendered.container.querySelector<HTMLInputElement>(
      '[data-testid="agent-proposal-rejection-reason"]',
    );
    expect(input).not.toBeNull();

    act(() => reject?.click());
    expect(rendered.onDecision).toHaveBeenCalledWith({
      proposalId: "approval-1",
      decision: "reject",
    });

    act(() => {
      if (!input) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "这个结论缺少适用边界",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => reject?.click());

    expect(rendered.onDecision).toHaveBeenLastCalledWith({
      proposalId: "approval-1",
      decision: "reject",
      reason: "这个结论缺少适用边界",
    });
  });

  test("keeps card identity but reveals the card when ownership moves to the user", () => {
    const rendered = render(proposal("preview"));
    const card = rendered.container.querySelector('[data-proposal-id="approval-1"]');
    const trigger = rendered.container.querySelector<HTMLButtonElement>(
      '[aria-label="折叠 Proposal"]',
    );
    expect(trigger?.textContent).toContain("新增 Understanding");
    act(() => trigger?.click());
    expect(card?.getAttribute("data-proposal-open")).toBe("false");

    render(proposal("pending"), rendered.onDecision);
    expect(rendered.container.querySelector('[data-proposal-id="approval-1"]')).toBe(card);
    expect(card?.getAttribute("data-proposal-open")).toBe("true");
  });
});
