import { useEffect, useState } from "react";

/** 秒表格式化（Beautiful UI「量化等待」心智）：`3.2s` / `3m 12s`，tabular 友好。 */
export function formatElapsed(milliseconds: number): string {
  const totalSeconds = milliseconds / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/** 长操作计时：每 100ms 更新（reduced-motion 下仍显示文字）。
 *  start 为 true 时从挂载时刻计时；为 ISO 时间戳时从该时刻（真实起点）计时；
 *  为 false/null 时不计时并保留现值（完成态冻结耗时）。 */
export function useElapsed(start: boolean | string | null): string {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (start === false || start === null) return;
    const startMs = start === true ? Date.now() : new Date(start).getTime();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Date.now() - startMs), 100);
    return () => window.clearInterval(timer);
  }, [start]);

  return formatElapsed(elapsed);
}
