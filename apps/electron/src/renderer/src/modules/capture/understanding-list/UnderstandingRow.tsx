import {
  UnderstandingRow as UnderstandingRowView,
  type UnderstandingRowAction,
} from "@reflecta/ui/capture";
import { useModal } from "@reflecta/ui/overlays";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getUnderstandingTitle } from "../understanding-title";
import { useCaptureStore, type CaptureAgentScope } from "../store";
import { useUnderstandingListActions } from "./hooks";

export function UnderstandingRow({
  understanding,
  selected = false,
  onChat,
}: {
  understanding: UnderstandingSummaryDTO;
  selected?: boolean;
  onChat?: (scope: CaptureAgentScope) => void;
}) {
  const selectUnderstanding = useCaptureStore((state) => state.selectUnderstanding);
  const { deleteUnderstanding } = useUnderstandingListActions();
  const { confirm } = useModal();
  const title = getUnderstandingTitle(understanding);

  const handleAction = (action: UnderstandingRowAction) => {
    if (action.type === "chat") {
      selectUnderstanding(understanding.id);
      onChat?.({ type: "understanding", id: understanding.id, title });
      return;
    }

    confirm({
      title: "删除理解",
      message: `确定要删除「${title}」吗？此操作不可撤销。`,
      acceptLabel: "删除",
      danger: true,
      onAccept: () => deleteUnderstanding(understanding.id),
    });
  };

  return (
    <UnderstandingRowView
      understanding={{
        id: understanding.id,
        title,
        body: understanding.body,
        updatedLabel: formatDistanceToNow(understanding.updatedAt, {
          addSuffix: true,
          locale: zhCN,
        }),
        contextCount: understanding.contextCount,
        connectionCount: understanding.connectionCount,
      }}
      selected={selected}
      canChat={Boolean(onChat)}
      onSelect={selectUnderstanding}
      onAction={handleAction}
    />
  );
}
