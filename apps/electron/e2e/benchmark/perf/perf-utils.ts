import type { CDPSession, Page } from "@playwright/test";

/**
 * 性能采集工具（Electron renderer 内测量主线程卡顿与交互延迟）。
 *
 * 设计目标：把「用户能感知的卡」量化为可对比的指标——
 * - Long Task（主线程 >50ms 阻塞）：PerformanceObserver 采集，直接对应「卡顿」。
 * - 交互延迟：interaction 前后在 renderer 里打点 performance.now() 的墙钟差。
 * - 帧间隔：requestAnimationFrame 采样，评估滚动/动画流畅度。
 * - CDP Performance metrics：脚本/布局总耗时等 Chromium 汇总指标。
 *
 * 噪音控制（CI/本机性能测量固有噪声）：
 * - 每次测量前 drain 掉既有 long task，只统计「本次交互」产生的。
 * - 场景统一 warmup + 多次采样，用中位数/最大值做结论（见 budget.ts）。
 */

export type LongTaskStat = {
  count: number;
  totalMs: number;
  maxMs: number;
  /** 按 startTime 排序的明细，用于诊断时看分布 */
  items: Array<{ startTime: number; duration: number }>;
};

type PerfWindow = Window & {
  __perfInstalled?: boolean;
  __perfLongTasks?: Array<{ startTime: number; duration: number }>;
};

const PERF_INSTALL = /* js */ `
  (() => {
    const win = window;
    if (win.__perfInstalled) return;
    win.__perfInstalled = true;
    win.__perfLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          win.__perfLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      /* longtask 不可用时静默跳过 —— 指标降级为纯交互延迟 */
    }
  })();
`;

/** 注入 longtask observer 到 renderer。注意：页面导航后需重新调用。 */
export async function installPerf(page: Page): Promise<void> {
  await page.evaluate(PERF_INSTALL);
}

/** 清空已采集的 long task —— 每次交互测量前调用，保证只统计本次。 */
export async function drainLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as PerfWindow;
    if (win.__perfLongTasks) win.__perfLongTasks.length = 0;
  });
}

/** 读取本次交互累计的 long task（drain 之后新增的）。 */
export async function collectLongTasks(page: Page): Promise<LongTaskStat> {
  const items = await page.evaluate(() => {
    const win = window as PerfWindow;
    return (win.__perfLongTasks ?? []).map((e) => ({ ...e }));
  });
  items.sort((a, b) => a.startTime - b.startTime);
  return {
    count: items.length,
    totalMs: items.reduce((sum, e) => sum + e.duration, 0),
    maxMs: items.reduce((max, e) => Math.max(max, e.duration), 0),
    items,
  };
}

/**
 * 等页面「稳定」：让出主线程让渲染/副作用跑完。
 * networkidle 对常驻连接不可靠，这里用固定 settle + 两帧静默兜底。
 */
export async function settle(page: Page, settleMs = 250): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(settleMs);
}

export type StepResult = {
  name: string;
  /** renderer 墙钟：从交互开始到 settle 完成（含 action 与 settle 的等待） */
  elapsedMs: number;
} & LongTaskStat;

/**
 * 测一次带名称的交互：
 * - drain 旧 long task → 打 t0 → 执行 action（可含 Playwright 点击/导航）→ settle → 打 t1。
 * - 返回 elapsedMs（交互到稳定）+ 本次新增 long task 统计。
 */
export async function measureStep(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  opts: { settleMs?: number } = {},
): Promise<StepResult> {
  await drainLongTasks(page);
  const t0 = await page.evaluate(() => performance.now());
  await action();
  await settle(page, opts.settleMs);
  const t1 = await page.evaluate(() => performance.now());
  const longTasks = await collectLongTasks(page);
  return { name, elapsedMs: t1 - t0, ...longTasks };
}

export type FrameStat = {
  frames: number;
  avgMs: number;
  /** 相邻两帧间隔的 95 分位，接近「滚动掉帧」线（>50ms 即卡） */
  p95Ms: number;
  maxMs: number;
};

/**
 * 在 renderer 里用 requestAnimationFrame 采样 windowMs 的帧间隔。
 * 返回一个 pending promise；测试侧可在其 pending 期间派发 CDP 滚动/动画事件。
 */
export function sampleFrames(page: Page, windowMs: number): Promise<FrameStat> {
  return page.evaluate(
    (ms) =>
      new Promise<FrameStat>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const start = last;
        const tick = () => {
          const now = performance.now();
          deltas.push(now - last);
          last = now;
          if (now - start < ms) requestAnimationFrame(tick);
          else {
            deltas.sort((a, b) => a - b);
            const p95 = deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))];
            resolve({
              frames: deltas.length,
              avgMs: deltas.reduce((a, b) => a + b, 0) / deltas.length,
              p95Ms: p95,
              maxMs: deltas[deltas.length - 1] ?? 0,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    windowMs,
  );
}

/** 经 CDP 派发真实滚轮事件（触发合成滚动），用于评估虚拟列表滚动性能。 */
export async function wheelScroll(
  cdp: CDPSession,
  params: { x: number; y: number; deltaY: number; deltaX?: number; steps?: number },
): Promise<void> {
  const steps = params.steps ?? 40;
  const stepY = params.deltaY / steps;
  const stepX = (params.deltaX ?? 0) / steps;
  for (let i = 0; i < steps; i++) {
    await cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: params.x,
      y: params.y,
      deltaX: stepX,
      deltaY: stepY,
    });
  }
}

/** Chromium 汇总性能指标（脚本/布局/样式耗时等），供诊断模式取绝对值。 */
export async function getRendererMetrics(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((m: { name: string; value: number }) => [m.name, m.value]));
}

export function fmtStep(r: StepResult): string {
  return [
    `${r.name}: ${r.elapsedMs.toFixed(0)}ms`,
    `longtask=${r.count} (${r.totalMs.toFixed(0)}ms, max ${r.maxMs.toFixed(0)}ms)`,
  ].join(" / ");
}
