import { useCallback, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  entityKey,
  type ChatEntityPresentation,
  type ChatEntityReference,
  type ResolveChatEntity,
} from "@reflecta/ui/chat";
import { collectEntityReferences } from "@reflecta/shared";
import { captureQueryKeys, getEntityDisplay } from "./queries";

/**
 * 将一段 markdown 里的实体引用（[[u:id]] 等）批量解析为「id → 展示信息」的稳定回调：
 * collect → 批量拉取 title → 聚合成 Map → 生成 memo 化的 resolveWikiLink。
 * 各渲染面（MarkdownPreview / SimpleMarkdownPreview / 编辑器）作为 prop 接收，
 * 不再各自实现这套装配。
 */
export function useEntityDisplayResolver(referenceSource: string): ResolveChatEntity {
  const entityReferences = useMemo(
    () => collectEntityReferences(referenceSource),
    [referenceSource],
  );
  const entityQueries = useQueries({
    queries: entityReferences.map((reference) => ({
      queryKey: captureQueryKeys.entityDisplay(reference),
      queryFn: () => getEntityDisplay(reference),
    })),
  });
  const entityPresentations = useMemo(() => {
    const result = new Map<string, ChatEntityPresentation>();
    entityReferences.forEach((reference, index) => {
      const title = entityQueries[index]?.data?.title;
      if (title) {
        result.set(entityKey(reference), {
          state: "ready",
          label: title,
          canOpen: reference.type !== "domain",
        });
      }
    });
    return result;
  }, [entityQueries, entityReferences]);
  return useCallback(
    (reference: ChatEntityReference) => entityPresentations.get(entityKey(reference)),
    [entityPresentations],
  );
}
