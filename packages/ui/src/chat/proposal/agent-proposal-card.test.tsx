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
    expect(card?.querySelector("svg.lucide-chevron-down")).not.toBeNull();

    render(proposal("pending"), rendered.onDecision);
    expect(rendered.container.querySelector('[data-proposal-id="approval-1"]')).toBe(card);
    expect(card?.getAttribute("data-proposal-open")).toBe("true");
  });

  test("understanding update with only a domain move shows the change instead of a generation placeholder", () => {
    const view: AgentProposalView = {
      id: "approval-update-1",
      kind: "understanding-update",
      title: "修改 Understanding",
      lifecycle: "pending",
      decisionEnabled: true,
      content: {
        beforeHeading: "认知边界：判断力在我，知识面在 AI",
        beforeBody: "内容不变",
        beforeDomainPaths: ["Agent Skill"],
        domainPaths: ["AI 直属"],
        reason: "移到 AI 直属 domain 与主干归拢。",
      },
    };
    const rendered = render(view);
    expect(rendered.container.textContent).toContain("仅调整所属 Domain：Agent Skill → AI 直属");
    expect(rendered.container.textContent).toContain("认知边界：判断力在我，知识面在 AI");
    expect(rendered.container.textContent).toContain("内容不变");
    expect(rendered.container.textContent).not.toContain("正在生成修改");
  });

  test("understanding update with content change shows title, domain and body on each side", () => {
    const view: AgentProposalView = {
      id: "approval-update-4",
      kind: "understanding-update",
      title: "修改 Understanding",
      lifecycle: "pending",
      decisionEnabled: true,
      content: {
        beforeHeading: "旧标题",
        afterHeading: "新标题",
        beforeBody: "旧正文",
        afterBody: "新正文",
        beforeDomainPaths: ["Agent Skill"],
        domainPaths: ["AI 直属"],
      },
    };
    const rendered = render(view);
    const text = rendered.container.textContent ?? "";
    expect(text).toContain("旧标题");
    expect(text).toContain("新标题");
    expect(text).toContain("旧正文");
    expect(text).toContain("新正文");
    expect(text).toContain("Agent Skill");
    expect(text).toContain("AI 直属");
    expect(text).not.toContain("正在生成修改");
  });

  test("understanding update keeps the placeholder only while the preview is streaming", () => {
    const base = {
      id: "approval-update-2",
      kind: "understanding-update" as const,
      title: "修改 Understanding",
      content: {
        beforeHeading: "认知边界：判断力在我，知识面在 AI",
        beforeBody: "内容不变",
        beforeDomainPaths: ["Agent Skill"],
        domainPaths: ["AI 直属"],
      },
    };
    const streaming: AgentProposalView = { ...base, lifecycle: "preview" };
    expect(render(streaming).container.textContent).toContain("正在生成修改…");

    const completed: AgentProposalView = { ...base, lifecycle: "completed" };
    const rendered = render(completed);
    const trigger = rendered.container.querySelector<HTMLButtonElement>(
      '[data-slot="collapsible-trigger"]',
    );
    act(() => trigger?.click());
    expect(rendered.container.textContent).toContain("仅调整所属 Domain：Agent Skill → AI 直属");
    expect(rendered.container.textContent).not.toContain("正在生成修改");
  });

  test("context update with only a medium change shows the change instead of a generation placeholder", () => {
    const view: AgentProposalView = {
      id: "approval-context-update-1",
      kind: "context-update",
      title: "修改 Context",
      lifecycle: "pending",
      decisionEnabled: true,
      content: {
        targetLabel: "AI 输出的困惑",
        beforeTitle: "标题不变",
        beforeBody: "内容不变",
        beforeMediumLabel: "经验",
        mediumLabel: "视频",
      },
    };
    const rendered = render(view);
    expect(rendered.container.textContent).toContain("仅调整类型：经验 → 视频");
    expect(rendered.container.textContent).not.toContain("正在生成修改");
  });

  test("understanding update without any visible change reports unchanged content", () => {
    const view: AgentProposalView = {
      id: "approval-update-3",
      kind: "understanding-update",
      title: "修改 Understanding",
      lifecycle: "pending",
      decisionEnabled: true,
      content: {
        beforeHeading: "认知边界",
        beforeBody: "内容不变",
      },
    };
    const rendered = render(view);
    expect(rendered.container.textContent).toContain("标题与正文不变");
    expect(rendered.container.textContent).not.toContain("正在生成修改");
  });
});
