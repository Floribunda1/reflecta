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
  /** 领域 id → name 映射（用于按领域排名） */
  domainList: { id: string; name: string }[];
};

/** 回顾页数据：理解/画布/领域沿用现有服务，会话/上下文/画布元素的参与数据来自 insights 服务。 */
export function useRecapData() {
  return useQuery<RecapDataQuery>({
    queryKey: recapQueryKeys.data,
    queryFn: async () => {
      const [understandings, canvases, recap, domains] = await Promise.all([
        ipcClient.understanding.listUnderstandings(),
        ipcClient.understandingCanvas.listCanvases(),
        ipcClient.insights.getRecapData(),
        ipcClient.domain.listDomains(),
      ]);
      return {
        understandings,
        canvases,
        recap,
        domainList: domains.map((domain) => ({ id: domain.id, name: domain.name })),
      };
    },
  });
}
