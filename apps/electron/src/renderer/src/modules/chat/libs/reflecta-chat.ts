import { AbstractChat, type ChatInit, type UIMessage } from "ai";
import { ReflectaReactChatState } from "./react-chat-state";

export class ReflectaChat<UI_MESSAGE extends UIMessage> extends AbstractChat<UI_MESSAGE> {
  readonly reactState: ReflectaReactChatState<UI_MESSAGE>;

  constructor({ messages, ...init }: ChatInit<UI_MESSAGE>) {
    const state = new ReflectaReactChatState(messages);
    super({ ...init, state });
    this.reactState = state;
  }
}
