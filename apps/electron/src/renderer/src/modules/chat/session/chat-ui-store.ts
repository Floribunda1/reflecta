import { Effect } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { useAtomValue } from "@effect/atom-react";
import { kvsRuntime, runAtom } from "@renderer/lib/atoms";
import type { InspectableContextRef } from "../context/context-reference";

const CHAT_UI_STORAGE_KEY = "reflecta.chat-session:v3";

/** 仅 `activeThreadId` 持久化（对齐旧 zustand `partialize`）；其余为 UI 瞬态。 */
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

/** 持久化（localStorage）的 active thread。 */
export const activeThreadIdAtom: Atom.Writable<string | null, string | null> = Atom.keepAlive(
  Atom.kvs({
    runtime: kvsRuntime,
    key: CHAT_UI_STORAGE_KEY,
    schema: S.NullOr(S.String),
    defaultValue: () => initialChatUiState.activeThreadId,
  }),
);
/** 以下为 UI 瞬态（不持久化）。 */
export const inspectedRefAtom: Atom.Writable<
  InspectableContextRef | null,
  InspectableContextRef | null
> = Atom.keepAlive(Atom.make<InspectableContextRef | null>(initialChatUiState.inspectedRef));
export const focusNonceByThreadAtom: Atom.Writable<
  Record<string, number>,
  Record<string, number>
> = Atom.keepAlive(Atom.make<Record<string, number>>(initialChatUiState.focusNonceByThread));
export const collapsedToolIdsAtom: Atom.Writable<
  Record<string, boolean>,
  Record<string, boolean>
> = Atom.keepAlive(Atom.make<Record<string, boolean>>(initialChatUiState.collapsedToolIds));

export const chatUiActions: ChatUiActions = {
  selectThread: (threadId) =>
    runAtom(
      Effect.gen(function* () {
        yield* Atom.set(activeThreadIdAtom, threadId);
        yield* Atom.set(inspectedRefAtom, null);
      }),
    ),
  clearThread: (threadId) =>
    runAtom(
      Effect.gen(function* () {
        const active = yield* Atom.get(activeThreadIdAtom);
        if (active === threadId) {
          yield* Atom.set(activeThreadIdAtom, null);
          yield* Atom.set(inspectedRefAtom, null);
        }
        yield* Atom.update(focusNonceByThreadAtom, (nonces) => {
          const { [threadId]: _removed, ...rest } = nonces;
          return rest;
        });
      }),
    ),
  openInspector: (ref) => runAtom(Atom.set(inspectedRefAtom, ref)),
  closeInspector: () => runAtom(Atom.set(inspectedRefAtom, null)),
  requestComposerFocus: (threadId) =>
    runAtom(
      Atom.update(focusNonceByThreadAtom, (nonces) => ({
        ...nonces,
        [threadId]: (nonces[threadId] ?? 0) + 1,
      })),
    ),
  setToolCollapsed: (toolCallId, collapsed) =>
    runAtom(
      Atom.update(collapsedToolIdsAtom, (collapsedIds) => {
        const next = { ...collapsedIds };
        if (collapsed) next[toolCallId] = true;
        else delete next[toolCallId];
        return next;
      }),
    ),
};

export function useActiveThreadId(): string | null {
  return useAtomValue(activeThreadIdAtom);
}

export function useInspectorRef(): InspectableContextRef | null {
  return useAtomValue(inspectedRefAtom);
}

export function useThreadFocusNonce(threadId: string): number {
  return useAtomValue(focusNonceByThreadAtom)[threadId] ?? 0;
}

export function useAgentUiActions(): ChatUiActions {
  return chatUiActions;
}
