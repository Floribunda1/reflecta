import type { FrameStat, StepResult } from "./perf-utils";

/**
 * 预算报告器。
 *
 * Benchmark 默认把超预算当失败；显式设置 `REFLECTA_BENCH_REPORT_ONLY=1` 时只报告。
 *
 * 预算策略：CI/本机性能测量噪声大，阈值一律宽松——
 * - longtask 次数/总时长 给 soft 值，判 2x 才超。
 * - 交互延迟取多次采样中位数，超上界才判。
 * 这样避免「全量测试因噪声 flaky」，只拦明显回退。
 */

export type Budget = {
  /** 单次交互累计 long task 次数 soft 上限（判 2x） */
  longTaskCountSoft?: number;
  /** 单次交互累计 long task 总时长 soft 上限（ms，判 2x） */
  longTaskTotalMsSoft?: number;
  /** 单个 long task soft 上限（ms，判 2x） */
  longTaskMaxMsSoft?: number;
  /** 交互延迟多次采样中位数上限（ms） */
  elapsedMsSoft?: number;
};

export type BudgetRun = {
  name: string;
  /** 去掉 warmup 后的采样（ms） */
  samples: number[];
  elapsedMedianMs: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
  raw: StepResult[];
};

const reportOnly = () => process.env.REFLECTA_BENCH_REPORT_ONLY === "1";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 0;
}

/**
 * 对同一交互做 n 次复测，返回去 warmup 后的统计。
 * 首采样视为 warmup（缓存/渲染管线尚未热），不计入。
 */
export async function sampleInteractions(
  run: (i: number) => Promise<StepResult>,
  samples = 4,
): Promise<BudgetRun> {
  const results: StepResult[] = [];
  for (let i = 0; i < samples; i++) {
    results.push(await run(i));
  }
  const warmed = results.slice(1);
  return {
    name: results[0]!.name,
    samples: warmed.map((r) => r.elapsedMs),
    elapsedMedianMs: median(warmed.map((r) => r.elapsedMs)),
    longTaskCount: median(warmed.map((r) => r.count)),
    longTaskTotalMs: median(warmed.map((r) => r.totalMs)),
    longTaskMaxMs: Math.max(0, ...warmed.map((r) => r.maxMs)),
    raw: results,
  };
}

/** 评估一次预算，打印报告；若超出且处于 enforce 模式则抛错。 */
export function checkBudget(run: BudgetRun, budget: Budget): void {
  const lines = [
    `[bench] ${run.name}`,
    `  elapsed median=${run.elapsedMedianMs.toFixed(0)}ms  samples=[${run.samples
      .map((s) => `${s.toFixed(0)}ms`)
      .join(", ")}]`,
    `  longtask count median=${run.longTaskCount}  total median=${run.longTaskTotalMs.toFixed(0)}ms  max=${run.longTaskMaxMs.toFixed(0)}ms`,
  ];
  const violations: string[] = [];
  const countSoft = budget.longTaskCountSoft;
  const totalSoft = budget.longTaskTotalMsSoft;
  if (countSoft != null && run.longTaskCount > countSoft * 2) {
    violations.push(`longtask count ${run.longTaskCount} > soft ${countSoft}*2`);
  }
  if (totalSoft != null && run.longTaskTotalMs > totalSoft * 2) {
    violations.push(`longtask total ${run.longTaskTotalMs.toFixed(0)}ms > soft ${totalSoft}*2`);
  }
  const maxSoft = budget.longTaskMaxMsSoft;
  if (maxSoft != null && run.longTaskMaxMs > maxSoft * 2) {
    violations.push(`longtask max ${run.longTaskMaxMs.toFixed(0)}ms > soft ${maxSoft}*2`);
  }
  const elapsedSoft = budget.elapsedMsSoft;
  if (elapsedSoft != null && run.elapsedMedianMs > elapsedSoft) {
    violations.push(`elapsed median ${run.elapsedMedianMs.toFixed(0)}ms > budget ${elapsedSoft}ms`);
  }
  for (const line of lines) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
  if (violations.length) {
    const message = `[bench] budget exceeded: ${violations.join("; ")}`;
    if (!reportOnly()) throw new Error(message);
    // eslint-disable-next-line no-console
    console.warn(`[bench] (report-only) ${message}`);
  }
}

export function checkFrameBudget(
  name: string,
  frames: FrameStat,
  budget: { p95Ms: number; maxMs: number; longFrameCount: number },
): void {
  const violations = [
    frames.p95Ms > budget.p95Ms ? `p95 ${frames.p95Ms.toFixed(1)}ms > ${budget.p95Ms}ms` : null,
    frames.maxMs > budget.maxMs ? `max ${frames.maxMs.toFixed(1)}ms > ${budget.maxMs}ms` : null,
    frames.longFrameCount > budget.longFrameCount
      ? `long frames ${frames.longFrameCount} > ${budget.longFrameCount}`
      : null,
  ].filter(Boolean);
  // eslint-disable-next-line no-console
  console.log(
    `[bench] ${name}: frames=${frames.frames} avg=${frames.avgMs.toFixed(1)}ms p95=${frames.p95Ms.toFixed(1)}ms max=${frames.maxMs.toFixed(1)}ms long=${frames.longFrameCount}`,
  );
  if (violations.length) {
    const message = `[bench] frame budget exceeded: ${violations.join("; ")}`;
    if (!reportOnly()) throw new Error(message);
    // eslint-disable-next-line no-console
    console.warn(`[bench] (report-only) ${message}`);
  }
}
