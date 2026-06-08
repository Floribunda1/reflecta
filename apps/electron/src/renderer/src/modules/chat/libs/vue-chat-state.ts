import type { ChatState, ChatStatus, UIMessage } from "ai";
import { ref, type Ref } from "vue";

function cloneUiMessage<UI_MESSAGE extends UIMessage>(message: UI_MESSAGE): UI_MESSAGE {
  return {
    ...message,
    parts: message.parts.map((part) => ({ ...part })),
  } as UI_MESSAGE;
}

export class ReflectaVueChatState<UI_MESSAGE extends UIMessage> implements ChatState<UI_MESSAGE> {
  readonly messagesRef: Ref<UI_MESSAGE[]>;
  readonly statusRef = ref<ChatStatus>("ready");
  readonly errorRef = ref<Error | undefined>(undefined);

  constructor(messages?: UI_MESSAGE[]) {
    this.messagesRef = ref(messages ?? []) as Ref<UI_MESSAGE[]>;
  }

  get messages(): UI_MESSAGE[] {
    return this.messagesRef.value;
  }

  set messages(messages: UI_MESSAGE[]) {
    this.messagesRef.value = messages.map(cloneUiMessage);
  }

  get status(): ChatStatus {
    return this.statusRef.value;
  }

  set status(status: ChatStatus) {
    this.statusRef.value = status;
  }

  get error(): Error | undefined {
    return this.errorRef.value;
  }

  set error(error: Error | undefined) {
    this.errorRef.value = error;
  }

  pushMessage = (message: UI_MESSAGE) => {
    this.messagesRef.value = [...this.messagesRef.value, cloneUiMessage(message)];
  };

  popMessage = () => {
    this.messagesRef.value = this.messagesRef.value.slice(0, -1);
  };

  replaceMessage = (index: number, message: UI_MESSAGE) => {
    const next = this.messagesRef.value.slice();
    next[index] = cloneUiMessage(message);
    this.messagesRef.value = next;
  };

  snapshot = <T>(value: T): T => value;
}
