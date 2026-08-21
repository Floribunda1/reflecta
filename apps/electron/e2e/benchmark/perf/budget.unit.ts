import { afterEach, describe, expect, test } from "bun:test";
import { checkBudget, checkFrameBudget, sampleInteractions } from "./budget";
import type { StepResult } from "./perf-utils";

function result(elapsedMs: number, count: number, totalMs: number, maxMs: number): StepResult {
  return { name: "interaction", elapsedMs, count, totalMs, maxMs, items: [] };
}

const previousReportOnly = process.env.REFLECTA_BENCH_REPORT_ONLY;

afterEach(() => {
  if (previousReportOnly == null) delete process.env.REFLECTA_BENCH_REPORT_ONLY;
  else process.env.REFLECTA_BENCH_REPORT_ONLY = previousReportOnly;
});

describe("benchmark budgets", () => {
  test("summarizes warmed long tasks per interaction instead of adding samples together", async () => {
    const samples = [
      result(999, 9, 900, 90),
      result(30, 1, 100, 60),
      result(10, 3, 300, 80),
      result(20, 2, 200, 70),
    ];

    const run = await sampleInteractions(async (index) => samples[index]!);

    expect(run.elapsedMedianMs).toBe(20);
    expect(run.longTaskCount).toBe(2);
    expect(run.longTaskTotalMs).toBe(200);
    expect(run.longTaskMaxMs).toBe(80);
  });

  test("fails an exceeded budget unless report-only mode is explicit", () => {
    delete process.env.REFLECTA_BENCH_REPORT_ONLY;
    const run = {
      name: "interaction",
      samples: [30, 40, 50],
      elapsedMedianMs: 40,
      longTaskCount: 0,
      longTaskTotalMs: 0,
      longTaskMaxMs: 0,
      raw: [],
    };

    expect(() => checkBudget(run, { elapsedMsSoft: 10 })).toThrow("budget exceeded");
  });

  test("fails when a rare long frame is hidden below p95", () => {
    delete process.env.REFLECTA_BENCH_REPORT_ONLY;
    expect(() =>
      checkFrameBudget(
        "scroll",
        { frames: 100, avgMs: 10, p95Ms: 12, maxMs: 80, longFrameCount: 1 },
        { p95Ms: 34, maxMs: 60, longFrameCount: 0 },
      ),
    ).toThrow("frame budget exceeded");
  });
});
