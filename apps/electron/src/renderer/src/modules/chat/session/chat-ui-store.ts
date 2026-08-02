import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { InspectableContextRef } from "../context/context-reference";

const CHAT_UI_STORAGE_KEY = "reflecta.chat-session:v3";

export type ChatUiState = {
  activeThreadId: string | null;
  inspectedRef: InspectableContextRef | null;
  focusNonceByThread: Record<string, number>;
  collapsedToolIds: Record<string, boolean>;
};

export type ChatUiActions = {
  selectThread(threadId: string | null): void;
  clearThread(threadId: string): void;
  openInspector(ref: InspectableContextRef): void;
  closeInspector(): void;
  requestComposerFocus(threadId: string): void;
  setToolCollapsed(toolCallId: string, collapsed: boolean): void;
};

export type ChatUiStore = ChatUiState & ChatUiActions;

const initialChatUiState: ChatUiState = {
  activeThreadId: null,
  inspectedRef: null,
  focusNonceByThread: {},
  collapsedToolIds: {},
};

function createChatUiState(
  initialState: ChatUiState = initialChatUiState,
): StateCreator<ChatUiStore> {
  return (set) => ({
    ...initialState,
    selectThread: (threadId) =>
      set({
        activeThreadId: threadId,
        inspectedRef: null,
      }),
    clearThread: (threadId) =>
      set((state) => {
        const { [threadId]: _removedFocus, ...focusNonceByThread } = state.focusNonceByThread;
        return {
          activeThreadId: state.activeThreadId === threadId ? null : state.activeThreadId,
          inspectedRef: state.activeThreadId === threadId ? null : state.inspectedRef,
          focusNonceByThread,
        };
      }),
    openInspector: (ref) => set({ inspectedRef: ref }),
    closeInspector: () => set({ inspectedRef: null }),
    requestComposerFocus: (threadId) =>
      set((state) => ({
        focusNonceByThread: {
          ...state.focusNonceByThread,
          [threadId]: (state.focusNonceByThread[threadId] ?? 0) + 1,
        },
      })),
    setToolCollapsed: (toolCallId, collapsed) =>
      set((state) => {
        const collapsedToolIds = { ...state.collapsedToolIds };
        if (collapsed) collapsedToolIds[toolCallId] = true;
        else delete collapsedToolIds[toolCallId];
        return { collapsedToolIds };
      }),
  });
}

export const chatUiStore = create<ChatUiStore>()(
  persist(createChatUiState(), {
    name: CHAT_UI_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ activeThreadId: state.activeThreadId }),
  }),
);

export function useActiveThreadId() {
  return chatUiStore((state) => state.activeThreadId);
}

export function useInspectorRef() {
  return chatUiStore((state) => state.inspectedRef);
}

export function useThreadFocusNonce(threadId: string) {
  return chatUiStore((state) => state.focusNonceByThread[threadId] ?? 0);
}

export function useAgentUiActions() {
  return chatUiStore(
    useShallow((state) => ({
      selectThread: state.selectThread,
      clearThread: state.clearThread,
      openInspector: state.openInspector,
      closeInspector: state.closeInspector,
      requestComposerFocus: state.requestComposerFocus,
      setToolCollapsed: state.setToolCollapsed,
    })),
  );
}
