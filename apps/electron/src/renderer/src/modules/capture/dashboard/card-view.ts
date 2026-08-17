import type { UnderstandingCardView } from "@reflecta/ui/capture";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getUnderstandingTitle } from "../understanding-title";

export function buildUnderstandingCardView(
  understanding: UnderstandingSummaryDTO,
  domainNameById: ReadonlyMap<string, string>,
): UnderstandingCardView {
  return {
    id: understanding.id,
    title: getUnderstandingTitle(understanding),
    body: understanding.body,
    updatedLabel: formatDistanceToNow(understanding.updatedAt, {
      addSuffix: true,
      locale: zhCN,
    }),
    contextCount: understanding.contextCount,
    mentionCount: understanding.mentionCount,
    domainNames: understanding.domainIds
      .map((domainId) => domainNameById.get(domainId))
      .filter((name): name is string => Boolean(name)),
  };
}
