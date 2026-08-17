import { useQuery } from "@tanstack/react-query";
import { ipcClient } from "@renderer/utils/ipc";
import type { RecapData } from "@shared/recap";
import type { CanvasDTO } from "@reflecta/server";
import type { UnderstandingSummaryDTO } from "@shared/understanding";

export const recapQueryKeys = {
  data: ["recap.data"] as const,
};

export type RecapDataQuery = {
  understandings: UnderstandingSummaryDTO[];
  canvases: CanvasDTO[];
  recap: RecapData;
};

/** 回顾页数据：理解/画布沿用现有服务，会话/上下文/画布元素的参与数据来自 insights 服务。 */
export function useRecapData() {
  return useQuery<RecapDataQuery>({
    queryKey: recapQueryKeys.data,
    queryFn: async () => {
      const [understandings, canvases, recap] = await Promise.all([
        ipcClient.understanding.listUnderstandings(),
        ipcClient.understandingCanvas.listCanvases(),
        ipcClient.insights.getRecapData(),
      ]);
      return { understandings, canvases, recap };
    },
  });
}
