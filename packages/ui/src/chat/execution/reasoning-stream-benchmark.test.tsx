// @vitest-environment happy-dom
// Benchmark: reasoning (Thinking) block expand/collapse cost while streaming tokens.
// Measures per-update render cost (React.Profiler actualDuration + wall clock) for:
//   A. streaming while collapsed
//   B. streaming while expanded
//   C. toggle-open / toggle-close latency mid-stream
import { Profiler, act, type ProfilerOnRenderCallback } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { AgentExecutionBlock } from "./agent-execution-block";
import type { ChatEntityBindings } from "../entity";
import type { AgentExecutionBlockView } from "./types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

class ImmediateIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);

function reasoningBlock(markdown: string, streaming = true): AgentExecutionBlockView {
  return {
    kind: "reasoning",
    reasoning: { id: "a1:r0", status: streaming ? "streaming" : "done", markdown },
  };
}

// Fresh bindings object per update — mirrors the real adapter which returns a new
// ChatEntityBindings every token batch (defeats reference-equality memo checks).
function freshBindings(): ChatEntityBindings {
  return {
    resolveEntity: () => undefined,
    onEntityOpen: () => undefined,
  };
}

const CHUNK = Number(process.env.BENCH_CHUNK ?? 200);
const UPDATES = Number(process.env.BENCH_UPDATES ?? 400); // 80_000 chars total
const WARMUP_UPDATES = 20;

function thinkingCorpus(totalChars: number): string {
  const paragraphs = [
    "我需要先弄清楚用户的真实意图。用户提到的问题表面上是关于 X,但背后可能隐藏着对 Y 的担忧。让我先列出几个关键的假设:",
    "第一,用户可能已经尝试过某些方案但没有成功。第二,当前实现里可能存在性能瓶颈。第三,团队对验收标准的理解可能不一致。",
    "这里有个细节需要特别留意:`-` 开头的列表项会被解析成列表,而缩进会影响嵌套关系。我应该先验证一下这个假设,再给出结论。",
    "从**产品价值**的角度看,这个改动不应该只解决眼前的问题,还要考虑**长期可维护性**。如果只打补丁,后续会越来越难改。",
    "综合以上分析,我倾向于方案 B,但需要先跟用户确认两个前提:一是他们是否接受重构带来的风险,二是时间窗口是否足够。",
  ];
  let out = "";
  let index = 0;
  while (out.length < totalChars) {
    out += paragraphs[index % paragraphs.length] + "\n\n";
    index += 1;
  }
  return out.slice(0, totalChars);
}

const corpus = thinkingCorpus(UPDATES * CHUNK);
const chunks: string[] = [];
for (let i = 0; i < UPDATES; i += 1) chunks.push(corpus.slice(i * CHUNK, (i + 1) * CHUNK));

function trigger(): Element | null {
  return (
    container?.querySelector('[data-testid="agent-reasoning"] [data-slot="collapsible-trigger"]') ??
    null
  );
}

function summary(name: string, samples: number[], unit = "ms") {
  const sorted = [...samples].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const line = `${name.padEnd(38)} avg ${avg.toFixed(2).padStart(8)}  p50 ${q(0.5).toFixed(2).padStart(8)}  p95 ${q(0.95).toFixed(2).padStart(8)}  p99 ${q(0.99).toFixed(2).padStart(8)}  n=${sorted.length}`;
  console.log(`  ${line} ${unit}`);
}

function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

test("benchmark: closed streaming (A)", () => {
  mount();
  const profilerDurations: number[] = [];
  const wallTimes: number[] = [];
  let commitDurations = 0;

  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    commitDurations += actualDuration;
  };

  act(() =>
    root?.render(
      <Profiler id="reasoning" onRender={onRender}>
        <AgentExecutionBlock block={reasoningBlock("")} entityBindings={freshBindings()} />
      </Profiler>,
    ),
  );

  for (let i = 0; i < UPDATES; i += 1) {
    commitDurations = 0;
    const text = corpus.slice(0, (i + 1) * CHUNK);
    const t0 = performance.now();
    act(() =>
      root?.render(
        <Profiler id="reasoning" onRender={onRender}>
          <AgentExecutionBlock block={reasoningBlock(text)} entityBindings={freshBindings()} />
        </Profiler>,
      ),
    );
    const wall = performance.now() - t0;
    if (i >= WARMUP_UPDATES) {
      profilerDurations.push(commitDurations);
      wallTimes.push(wall);
    }
  }

  console.log(
    `[A] streaming while COLLAPSED (${UPDATES - WARMUP_UPDATES} updates, ${(UPDATES - WARMUP_UPDATES) * CHUNK} chars)`,
  );
  summary("profiler render/update", profilerDurations);
  summary("wall clock/update", wallTimes);
  expect(trigger()).toBeTruthy();
});

test("benchmark: open streaming (B)", () => {
  mount();
  const profilerDurations: number[] = [];
  const wallTimes: number[] = [];
  let commitDurations = 0;

  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    commitDurations += actualDuration;
  };

  act(() =>
    root?.render(
      <Profiler id="reasoning" onRender={onRender}>
        <AgentExecutionBlock block={reasoningBlock("")} entityBindings={freshBindings()} />
      </Profiler>,
    ),
  );
  // expand before streaming, like a user who opened the Thinking panel early
  act(() => trigger()?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(container?.querySelector('[data-testid="agent-reasoning-detail"]')).toBeTruthy();

  for (let i = 0; i < UPDATES; i += 1) {
    commitDurations = 0;
    const text = corpus.slice(0, (i + 1) * CHUNK);
    const t0 = performance.now();
    act(() =>
      root?.render(
        <Profiler id="reasoning" onRender={onRender}>
          <AgentExecutionBlock block={reasoningBlock(text)} entityBindings={freshBindings()} />
        </Profiler>,
      ),
    );
    const wall = performance.now() - t0;
    if (i >= WARMUP_UPDATES) {
      profilerDurations.push(commitDurations);
      wallTimes.push(wall);
    }
  }

  console.log(
    `[B] streaming while EXPANDED (${UPDATES - WARMUP_UPDATES} updates, ${(UPDATES - WARMUP_UPDATES) * CHUNK} chars)`,
  );
  summary("profiler render/update", profilerDurations);
  summary("wall clock/update", wallTimes);
  const detail = container?.querySelector('[data-testid="agent-reasoning-detail"]');
  expect(detail?.textContent?.length).toBeGreaterThan(0);
});

test("benchmark: toggle latency mid-stream (C)", () => {
  mount();
  const openLatency: number[] = [];
  const closeLatency: number[] = [];
  let commitDurations = 0;

  const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    commitDurations += actualDuration;
  };

  act(() =>
    root?.render(
      <Profiler id="reasoning" onRender={onRender}>
        <AgentExecutionBlock block={reasoningBlock("")} entityBindings={freshBindings()} />
      </Profiler>,
    ),
  );

  // stream to full length while collapsed
  for (let i = 0; i < UPDATES; i += 1) {
    act(() =>
      root?.render(
        <Profiler id="reasoning" onRender={onRender}>
          <AgentExecutionBlock
            block={reasoningBlock(corpus.slice(0, (i + 1) * CHUNK))}
            entityBindings={freshBindings()}
          />
        </Profiler>,
      ),
    );
  }

  const ROUNDS = 6;
  const rawRounds: string[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    commitDurations = 0;
    const t0 = performance.now();
    act(() =>
      trigger()?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    );
    openLatency.push(performance.now() - t0);
    const detail = container?.querySelector('[data-testid="agent-reasoning-detail"]');
    expect(detail?.getAttribute("hidden")).toBeNull();

    // a few more tokens stream in while open
    for (let i = 0; i < 3; i += 1) {
      act(() =>
        root?.render(
          <Profiler id="reasoning" onRender={onRender}>
            <AgentExecutionBlock
              block={reasoningBlock(`${corpus}\n\n补充分析 ${round} ${i}`)}
              entityBindings={freshBindings()}
            />
          </Profiler>,
        ),
      );
    }

    commitDurations = 0;
    const t1 = performance.now();
    act(() =>
      trigger()?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    );
    closeLatency.push(performance.now() - t1);
    expect(
      container?.querySelector('[data-testid="agent-reasoning-detail"]')?.getAttribute("hidden"),
    ).toBe("");
    rawRounds.push(
      `round ${round}: open=${(openLatency.at(-1) ?? 0).toFixed(2)}ms close=${(closeLatency.at(-1) ?? 0).toFixed(2)}ms`,
    );
  }

  console.log(`[C] toggle latency mid-stream (${ROUNDS} rounds, text ~${corpus.length} chars)`);
  rawRounds.forEach((line) => console.log(`  ${line}`));
  summary("open click -> commit", openLatency);
  summary("close click -> commit", closeLatency);
  expect(trigger()).toBeTruthy();
});

test("benchmark: many mounted-collapsed panels while one streams (D)", () => {
  mount();
  const PANELS = 24;
  const panelCorpus = thinkingCorpus(10_000); // ~10k chars per thinking block
  // Realistic: only the active (last) panel streams; the others are frozen
  // finished messages that stay mounted (row-level memo keeps them from re-rendering).
  const blocks = (streamingSuffix = "") =>
    Array.from({ length: PANELS }, (_, index) =>
      reasoningBlock(
        index === PANELS - 1
          ? `${panelCorpus}\n\n块 ${index}${streamingSuffix}`
          : `${panelCorpus}\n\n块 ${index}`,
      ),
    );

  const setupT0 = performance.now();
  act(() =>
    root?.render(
      <>
        {blocks().map((block, index) => (
          <AgentExecutionBlock key={index} block={block} entityBindings={freshBindings()} />
        ))}
      </>,
    ),
  );
  // open + close every panel once so keepMounted activates (mirrors a user who peeked at each)
  const triggers = Array.from(
    container?.querySelectorAll(
      '[data-testid="agent-reasoning"] [data-slot="collapsible-trigger"]',
    ) ?? [],
  );
  expect(triggers).toHaveLength(PANELS);
  act(() =>
    triggers.forEach((trigger) =>
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    ),
  );
  act(() =>
    triggers.forEach((trigger) =>
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    ),
  );
  const setupMs = performance.now() - setupT0;
  const elementCount = container?.querySelectorAll("*").length ?? 0;
  const textNodeCount = Array.from(container?.querySelectorAll("*") ?? []).reduce(
    (count, node) =>
      count + Array.from(node.childNodes).filter((child) => child.nodeType === 3).length,
    0,
  );

  // one panel streams (index PANELS-1), the rest stay mounted + collapsed
  const perUpdate: number[] = [];
  const U = 80;
  for (let i = 0; i < U; i += 1) {
    const t0 = performance.now();
    act(() =>
      root?.render(
        <>
          {blocks(` LIVE_${i}`).map((block, index) => (
            <AgentExecutionBlock key={index} block={block} entityBindings={freshBindings()} />
          ))}
        </>,
      ),
    );
    if (i >= 10) perUpdate.push(performance.now() - t0);
  }

  console.log(
    `[D] ${PANELS} mounted-collapsed panels (each ~10k chars) while 1 streams (${U - 10} updates)`,
  );
  console.log(`  setup (mount + open/close all) = ${setupMs.toFixed(1)}ms`);
  console.log(
    `  DOM: ${elementCount} elements, ${textNodeCount} text nodes (all panels collapsed)`,
  );
  summary("wall clock/update", perUpdate);
  expect(container?.querySelectorAll('[data-testid="agent-reasoning-detail"]')).toHaveLength(
    PANELS,
  );
}, 180_000);

test("benchmark: unmount cost of a large panel (keepMounted=false close) (E)", () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  const large = corpus.slice(0, 80_000);
  act(() =>
    root?.render(
      <div>
        <AgentExecutionBlock block={reasoningBlock(large)} entityBindings={freshBindings()} />
      </div>,
    ),
  );
  act(() =>
    container
      ?.querySelector('[data-testid="agent-reasoning"] [data-slot="collapsible-trigger"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
  );

  // simulate collapsing without keepMounted: unmount the panel subtree
  const samples: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    act(() =>
      root?.render(
        <div>
          <AgentExecutionBlock block={reasoningBlock(large)} entityBindings={freshBindings()} />
        </div>,
      ),
    );
    act(() =>
      container
        ?.querySelector('[data-testid="agent-reasoning"] [data-slot="collapsible-trigger"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
    );
    const t1 = performance.now();
    act(() => root?.render(<div />)); // unmount subtree (open panel)
    samples.push(performance.now() - t1);
    act(() => root?.render(<div />));
  }

  console.log(`[E] unmount cost of an open 80k-char panel (3 samples)`);
  samples.forEach((sample, index) => console.log(`  unmount #${index}: ${sample.toFixed(2)}ms`));
  summary("unmount", samples);
  expect(container?.querySelector('[data-testid="agent-reasoning"]')).toBeNull();
}, 180_000);
