import { AbstractChat, type ChatInit, type UIMessage } from "ai";
import { ReflectaVueChatState } from "./vue-chat-state";

export class ReflectaChat<UI_MESSAGE extends UIMessage> extends AbstractChat<UI_MESSAGE> {
  readonly vueState: ReflectaVueChatState<UI_MESSAGE>;

  constructor({ messages, ...init }: ChatInit<UI_MESSAGE>) {
    const state = new ReflectaVueChatState(messages);
    super({ ...init, state });
    this.vueState = state;
  }
}
