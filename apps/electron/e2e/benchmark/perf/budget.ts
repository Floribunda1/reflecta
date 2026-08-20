import type { StepResult } from "./perf-utils";

/**
 * 预算报告器。
 *
 * Benchmark suite 默认「只报告不阻塞」（独立 suite，不进 CI 门禁，符合本地/按需跑）。
 * 当 `REFLECTA_BENCH_ENFORCE=1` 时，把超预算当作断言失败，用于想人工设门禁的场景。
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
  raw: StepResult[];
};

const enforce = () => process.env.REFLECTA_BENCH_ENFORCE === "1";

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
  const elapsed = warmed.map((r) => r.elapsedMs).sort((a, b) => a - b);
  const median = elapsed.length ? elapsed[Math.floor(elapsed.length / 2)]! : 0;
  return {
    name: results[0]!.name,
    samples: warmed.map((r) => r.elapsedMs),
    elapsedMedianMs: median,
    longTaskCount: warmed.reduce((a, r) => a + r.count, 0),
    longTaskTotalMs: warmed.reduce((a, r) => a + r.totalMs, 0),
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
    `  longtask count=${run.longTaskCount}  total=${run.longTaskTotalMs.toFixed(0)}ms`,
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
  const elapsedSoft = budget.elapsedMsSoft;
  if (elapsedSoft != null && run.elapsedMedianMs > elapsedSoft) {
    violations.push(`elapsed median ${run.elapsedMedianMs.toFixed(0)}ms > budget ${elapsedSoft}ms`);
  }
  for (const line of lines) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
  if (violations.length) {
    if (enforce()) {
      throw new Error(`[bench] budget exceeded: ${violations.join("; ")}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[bench] (report-only) soft budget exceeded: ${violations.join("; ")}`);
  }
}
